#!/bin/bash
# Backup PostgreSQL database and uploads directory.
# Keeps the last MAX_BACKUPS backup sets, removing older ones.
# Must be run from the deploy/ directory (where compose.yml lives).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
MAX_BACKUPS=5

# Load .env for DB credentials
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    # shellcheck disable=SC1090
    set -a; source "${SCRIPT_DIR}/.env"; set +a
fi
DB_USER="${DB_USER:-postgres}"

timestamp=$(date +%Y%m%d-%H%M%S)
backup_path="${BACKUP_DIR}/backup-${timestamp}"
backed_up=false

mkdir -p "$backup_path"

cd "$SCRIPT_DIR"

# Database: hot backup via pg_dump (works while the app is running)
if PGPASSWORD="$DB_PASSWORD" docker compose -f compose.yml exec -T postgres \
        pg_dump -U "$DB_USER" void_chat 2>/dev/null \
        | gzip > "${backup_path}/void_chat.sql.gz"; then
    echo "[INFO] Database backed up ($(du -h "${backup_path}/void_chat.sql.gz" | cut -f1))"
    backed_up=true
else
    rm -f "${backup_path}/void_chat.sql.gz"
fi

# Uploads: archive directly from the backend container's volume mount.
# No gzip — uploaded files (images, docs) are already compressed.
if docker compose -f compose.yml exec -T backend \
        tar -cf - -C /app uploads 2>/dev/null \
        > "${backup_path}/uploads.tar" && \
        [[ -s "${backup_path}/uploads.tar" ]]; then
    echo "[INFO] Uploads backed up ($(du -h "${backup_path}/uploads.tar" | cut -f1))"
    backed_up=true
else
    rm -f "${backup_path}/uploads.tar"
fi

if [[ "$backed_up" == false ]]; then
    rm -rf "$backup_path"
    echo "[INFO] Nothing to backup"
    exit 0
fi

echo "[INFO] Backup created: backup-${timestamp}"

# Rotate: keep only the most recent MAX_BACKUPS sets
count=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup-*" | wc -l)
if (( count > MAX_BACKUPS )); then
    to_delete=$(( count - MAX_BACKUPS ))
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup-*" | sort | head -n "$to_delete" | xargs rm -rf
    echo "[INFO] Removed $to_delete old backup(s), keeping ${MAX_BACKUPS}"
fi
