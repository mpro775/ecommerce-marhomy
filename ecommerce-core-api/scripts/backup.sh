#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
backup_dir="${BACKUP_DIR:-$(pwd)/backups}"
retention_days="${RETENTION_DAYS:-30}"
timestamp="$(date +%Y%m%d_%H%M%S)"
file="$backup_dir/catalog_rfq_${timestamp}.dump"
mkdir -p "$backup_dir"
pg_dump --dbname="$DATABASE_URL" --format=custom --clean --if-exists --file="$file"
pg_restore --list "$file" >/dev/null
find "$backup_dir" -name 'catalog_rfq_*.dump' -type f -mtime "+$retention_days" -delete
echo "Verified backup: $file"
