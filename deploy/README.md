# void-chat — Deployment

Host nginx + Docker deployment. nginx handles HTTPS and serves the React SPA; the Kotlin backend, PostgreSQL, and Redis run in Docker containers.

## Prerequisites

On the server:

- Docker with Compose plugin v2.21+
- nginx
- certbot
- git

## First-time Setup

SSH into the server and run everything from `deploy/`:

```bash
# Clone to any path you prefer; /opt/void-chat is the conventional choice.
# Non-root users typically lack write access to /opt — either use sudo
# or choose a user-writable location such as ~/void-chat.
sudo git clone https://github.com/cymoo/void-chat.git /opt/void-chat
# — or —
git clone https://github.com/cymoo/void-chat.git ~/void-chat

cd /opt/void-chat/deploy
cp .env.example .env      # edit: DOMAIN, DB_PASSWORD, INIT_ADMIN_PASSWORD
make setup
```

`make setup` will:

1. Build the React SPA and place the static files in `web/`
2. Build and start the backend, PostgreSQL, and Redis containers
3. Configure nginx with a temporary HTTP-only config
4. Obtain a TLS certificate via certbot (webroot mode)
5. Switch nginx to the full HTTPS config

Before running `make setup`, ensure:

- Your domain's DNS A record points to this server
- Ports 80 and 443 are open in your firewall
- nginx and certbot are installed (`apt install nginx certbot` or equivalent)

> **Note:** `make setup` automatically removes `/etc/nginx/sites-enabled/default` to avoid port 80 conflicts on Ubuntu/Debian.

## Daily Workflow

SSH into the server, `cd /opt/void-chat/deploy`, then:

```bash
make deploy    # backup → git pull → rebuild → restart
make backup    # manual backup
make logs      # tail backend logs
make ps        -- container status
make restart   # restart all containers
```

To deploy from a branch other than `main`:

```bash
make deploy BRANCH=my-feature
```

## Backup & Restore

Backups are stored in `/opt/void-chat/backups/`. Each backup set contains:

- `void_chat.sql.gz` — PostgreSQL database dump
- `uploads.tar.gz` — user-uploaded files

The last 5 backup sets are kept automatically.

**Restore database:**

```bash
# From /opt/void-chat/deploy on the server:
docker compose -f compose.yml stop backend
gunzip -c ../backups/backup-YYYYMMDD-HHMMSS/void_chat.sql.gz \
    | docker compose -f compose.yml exec -T postgres \
        psql -U postgres void_chat
docker compose -f compose.yml start backend
```

**Restore uploads:**

```bash
docker compose -f compose.yml exec -T backend \
    tar -xzf - -C /app < ../backups/backup-YYYYMMDD-HHMMSS/uploads.tar.gz
```

## Data Layout

| Path | Contents |
|------|----------|
| `/opt/void-chat/web/` | Built React SPA (served by host nginx) |
| `/opt/void-chat/backups/` | Backup sets |
| Docker volume `void-chat_uploads` | User-uploaded files (mounted at `/app/uploads` in backend) |
| Docker volume `void-chat_postgres_data` | PostgreSQL data |
| Docker volume `void-chat_redis_data` | Redis data |

## TLS / HTTPS

Certbot obtains and auto-renews the certificate via its systemd timer. On each renewal, the deploy hook `systemctl reload nginx` runs automatically. Certificates are stored in `/etc/letsencrypt/live/<DOMAIN>/`.

To verify renewal works:

```bash
certbot renew --dry-run
```

## Alternative: Simple HTTP Deployment

For a quick local or internal deployment without HTTPS, use the bundled `docker-compose.yml` which runs all services (including an nginx frontend container) in Docker:

```bash
cd /path/to/void-chat
cp deploy/.env.example deploy/.env   # edit as needed (no DOMAIN required)
docker compose -f deploy/docker-compose.yml up -d --build
```

The app will be available at `http://<host>` (port 80 by default, configurable via `HTTP_PORT`).
