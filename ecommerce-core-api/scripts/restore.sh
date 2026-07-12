#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
file="${1:-}"
confirm="${2:-}"
if [[ -z "$file" || ! -f "$file" ]]; then
  echo "Usage: ./scripts/restore.sh <backup.dump> --yes" >&2
  exit 1
fi
if [[ "$confirm" != "--yes" ]]; then
  echo "Restore overwrites the target database. Pass --yes to continue." >&2
  exit 1
fi
pg_restore --list "$file" >/dev/null
pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner "$file"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS schema_objects FROM information_schema.tables WHERE table_schema='public';"
echo "Restore completed and verified."
