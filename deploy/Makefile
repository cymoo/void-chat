# void-chat deployment Makefile — run directly on the server from deploy/
#
# First-time setup:
#   1. git clone https://github.com/cymoo/void-chat.git /opt/void-chat
#   2. cd /opt/void-chat/deploy
#   3. cp .env.example .env  # edit: DOMAIN, DB_PASSWORD, INIT_ADMIN_PASSWORD
#   4. sudo make setup
#
# Usage (setup/deploy require sudo; others run as a regular user):
#   sudo make setup     -- first-time: build, start containers, configure nginx + TLS
#   sudo make deploy    -- backup, pull latest, rebuild, restart
#   make backup         -- manual backup
#   make logs           -- tail backend logs
#   make ps             -- container status
#   make restart        -- restart all containers

GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m

APP_DIR         := $(abspath ..)
WEB_DIR         := $(APP_DIR)/web
NGINX_CONF      := /etc/nginx/conf.d/void-chat.conf
CERTBOT_WEBROOT := /var/www/certbot
# sed handles values that contain '=' (e.g. base64 passwords)
DOMAIN               := $(shell sed -n 's/^DOMAIN=//p' .env 2>/dev/null)
DB_PASSWORD          := $(shell sed -n 's/^DB_PASSWORD=//p' .env 2>/dev/null)
INIT_ADMIN_PASSWORD  := $(shell sed -n 's/^INIT_ADMIN_PASSWORD=//p' .env 2>/dev/null)
BRANCH          ?= main
# When invoked via sudo, SUDO_USER/UID/GID are set automatically.
# When running directly as root (no sudo), they are empty.
REAL_UID        := $(or $(SUDO_UID),$(shell id -u))
REAL_GID        := $(or $(SUDO_GID),$(shell id -g))
GIT_EXEC        := $(if $(SUDO_USER),sudo -u "$(SUDO_USER)" -H,)

.PHONY: help setup deploy _deploy backup logs ps restart

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[0;33m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## First-time: build images, start containers, configure nginx + TLS
	@[ "$$(id -u)" = "0" ] || { printf '$(RED)ERROR: run as: sudo make $@$(NC)\n' >&2; exit 1; }
	@test -f .env || { echo "$(RED)ERROR: create .env from .env.example first$(NC)" >&2; exit 1; }
	@test -n "$(DOMAIN)"               || { echo "$(RED)ERROR: DOMAIN not set in .env$(NC)" >&2; exit 1; }
	@test -n "$(DB_PASSWORD)"          || { echo "$(RED)ERROR: DB_PASSWORD not set in .env$(NC)" >&2; exit 1; }
	@test -n "$(INIT_ADMIN_PASSWORD)"  || { echo "$(RED)ERROR: INIT_ADMIN_PASSWORD not set in .env$(NC)" >&2; exit 1; }
	@[ "$(DB_PASSWORD)"         != "change-me" ] || { echo "$(RED)ERROR: change DB_PASSWORD from the default$(NC)" >&2; exit 1; }
	@[ "$(INIT_ADMIN_PASSWORD)" != "change-me" ] || { echo "$(RED)ERROR: change INIT_ADMIN_PASSWORD from the default$(NC)" >&2; exit 1; }
	@command -v nginx   > /dev/null 2>&1 || { echo "$(RED)ERROR: nginx not installed$(NC)" >&2; exit 1; }
	@command -v certbot > /dev/null 2>&1 || { echo "$(RED)ERROR: certbot not installed$(NC)" >&2; exit 1; }
	@echo "$(YELLOW)-> Creating directories...$(NC)"
	@mkdir -p $(WEB_DIR) $(CERTBOT_WEBROOT)
	@echo "$(YELLOW)-> Building frontend...$(NC)"
	@docker build -t void-chat-frontend -f Dockerfile.frontend ..
	@docker run --rm -v $(WEB_DIR):/dist void-chat-frontend \
	    sh -c 'rm -rf /dist/* && cp -r /app/dist/. /dist/'
	@chown -R $(REAL_UID):$(REAL_GID) $(WEB_DIR)
	@echo "$(YELLOW)-> Building and starting backend containers...$(NC)"
	@mkdir -p /etc/sysctl.d
	@echo 'vm.overcommit_memory = 1' | tee /etc/sysctl.d/99-redis.conf > /dev/null
	@sysctl -p /etc/sysctl.d/99-redis.conf > /dev/null
	@docker compose -f compose.yml build backend
	@docker compose -f compose.yml up -d --wait
	@echo "$(YELLOW)-> Configuring nginx (HTTP only for ACME challenge)...$(NC)"
	@rm -f /etc/nginx/sites-enabled/default
	@sed 's|__DOMAIN__|$(DOMAIN)|g' nginx-init.conf | tee $(NGINX_CONF) > /dev/null
	@nginx -t && systemctl reload-or-restart nginx
	@echo "$(YELLOW)-> Obtaining TLS certificate...$(NC)"
	@certbot certonly --webroot -w $(CERTBOT_WEBROOT) -d $(DOMAIN) \
	    --agree-tos --non-interactive --register-unsafely-without-email \
	    --keep-until-expiring \
	    --deploy-hook "systemctl reload nginx"
	@echo "$(YELLOW)-> Enabling HTTPS nginx config...$(NC)"
	@sed -e 's|__DOMAIN__|$(DOMAIN)|g' \
	     -e 's|__APP_DIR__|$(APP_DIR)|g' \
	     nginx.conf | tee $(NGINX_CONF) > /dev/null
	@nginx -t && systemctl reload-or-restart nginx
	@echo "$(GREEN)Setup complete — visit https://$(DOMAIN)$(NC)"

deploy: ## Backup, git pull, rebuild images, restart, refresh nginx config
	@[ "$$(id -u)" = "0" ] || { printf '$(RED)ERROR: run as: sudo make $@$(NC)\n' >&2; exit 1; }
	@echo "$(YELLOW)-> Backing up...$(NC)"
	@$(MAKE) -s backup
	@echo "$(YELLOW)-> Pulling latest code (branch: $(BRANCH))...$(NC)"
	@$(GIT_EXEC) git -C $(APP_DIR) pull origin $(BRANCH)
	@$(MAKE) -s _deploy

# Internal: runs after git pull so make re-reads the latest Makefile
_deploy:
	@echo "$(YELLOW)-> Building frontend...$(NC)"
	@docker build -t void-chat-frontend -f Dockerfile.frontend ..
	@docker run --rm -v $(WEB_DIR):/dist void-chat-frontend \
	    sh -c 'rm -rf /dist/* && cp -r /app/dist/. /dist/'
	@chown -R $(REAL_UID):$(REAL_GID) $(WEB_DIR)
	@echo "$(YELLOW)-> Rebuilding and restarting backend...$(NC)"
	@docker compose -f compose.yml build backend
	@docker compose -f compose.yml up -d --remove-orphans --wait
	@echo "$(YELLOW)-> Refreshing nginx config...$(NC)"
	@sed -e 's|__DOMAIN__|$(DOMAIN)|g' \
	     -e 's|__APP_DIR__|$(APP_DIR)|g' \
	     nginx.conf | tee $(NGINX_CONF) > /dev/null
	@nginx -t && systemctl reload-or-restart nginx
	@echo "$(GREEN)Deploy complete$(NC)"

backup: ## Backup database and uploads
	@bash backup.sh

logs: ## Tail backend container logs
	@docker compose -f compose.yml logs -f backend

ps: ## Show container status
	@docker compose -f compose.yml ps

restart: ## Restart all containers
	@docker compose -f compose.yml restart

.DEFAULT_GOAL := help
