#!/usr/bin/env bash
# ==============================================================================
# MarketSphere Automated PostgreSQL Backup & Disaster Recovery Script
# Assessment 14: Private database access, backups, monitoring & disaster recovery
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/marketsphere}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-marketsphere_db}"
DB_USER="${DB_USER:-marketsphere_user}"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/marketsphere_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

backup() {
    echo "[Backup] Starting full PostgreSQL logical backup..."
    PGPASSWORD="${DB_PASSWORD:-marketsphere_secret_pass}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --clean --if-exists --create \
        | gzip > "${BACKUP_FILE}"

    echo "[Backup] Backup successfully written to ${BACKUP_FILE}"
    echo "[Backup] Size: $(du -sh "${BACKUP_FILE}" | cut -f1)"

    # Retention clean up
    echo "[Backup] Purging backups older than ${RETENTION_DAYS} days..."
    find "${BACKUP_DIR}" -name "marketsphere_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;
    echo "[Backup] Retention policy applied."
}

restore() {
    local target_file="${1:-}"
    if [[ -z "${target_file}" || ! -f "${target_file}" ]]; then
        echo "[Restore] Error: Please provide a valid backup archive path."
        exit 1
    fi

    echo "[Restore] Restoring database from ${target_file}..."
    PGPASSWORD="${DB_PASSWORD:-marketsphere_secret_pass}" gunzip -c "${target_file}" | psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d postgres

    echo "[Restore] Database restored successfully."
}

case "${1:-backup}" in
    backup)
        backup
        ;;
    restore)
        restore "${2:-}"
        ;;
    *)
        echo "Usage: $0 {backup|restore <path-to-backup.sql.gz>}"
        exit 1
        ;;
esac
