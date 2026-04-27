#!/bin/bash

# Schedulist Database Restore Script
# Restores database from a backup file

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/schedulist}"
DB_NAME="${DB_NAME:-schedulist}"
DB_USER="${DB_USER:-schedulist_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup-file> [--force]"
    echo
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -10
    exit 1
fi

BACKUP_FILE="$1"
FORCE_RESTORE="${2:-}"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
fi

log "Preparing to restore from: $BACKUP_FILE"

# Get database password
if [ -z "$DB_PASSWORD" ]; then
    if [ -f "/var/www/schedulist/schedulist/.env" ]; then
        export $(grep DB_PASSWORD /var/www/schedulist/schedulist/.env | xargs)
    else
        read -sp "Enter database password: " DB_PASSWORD
        echo
    fi
fi

# Confirm restoration
if [ "$FORCE_RESTORE" != "--force" ]; then
    warning "This will REPLACE all data in the database!"
    read -p "Are you sure you want to restore from this backup? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log "Restoration cancelled"
        exit 0
    fi
fi

# Create a current backup before restoring
log "Creating safety backup before restore..."
SAFETY_BACKUP="${BACKUP_DIR}/pre-restore-$(date +%Y%m%d-%H%M%S).sql"
if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SAFETY_BACKUP"; then
    gzip "$SAFETY_BACKUP"
    log "Safety backup created: ${SAFETY_BACKUP}.gz"
else
    error "Failed to create safety backup!"
fi

# Stop application services
log "Stopping application services..."
if systemctl is-active --quiet schedulist-backend; then
    systemctl stop schedulist-backend
    SERVICE_WAS_RUNNING=true
else
    SERVICE_WAS_RUNNING=false
fi

# If using PM2
if command -v pm2 &> /dev/null; then
    pm2 stop schedulist-backend 2>/dev/null || true
fi

# Decompress backup if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log "Decompressing backup..."
    TEMP_FILE="/tmp/schedulist-restore-$(date +%Y%m%d-%H%M%S).sql"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
fi

# Perform the restore
log "Restoring database..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$RESTORE_FILE"; then
    log "Database restored successfully!"
else
    error "Database restore failed!"
fi

# Clean up temp file
if [ -n "${TEMP_FILE:-}" ] && [ -f "$TEMP_FILE" ]; then
    rm "$TEMP_FILE"
fi

# Run any pending migrations
log "Running migrations (if any)..."
cd /var/www/schedulist/schedulist
npx sequelize-cli db:migrate || warning "Migration failed or no migrations to run"

# Restart services
if [ "$SERVICE_WAS_RUNNING" = true ]; then
    log "Restarting application services..."
    systemctl start schedulist-backend
fi

# If using PM2
if command -v pm2 &> /dev/null; then
    pm2 start schedulist-backend 2>/dev/null || true
fi

# Verify restoration
log "Verifying restoration..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
    log "Database is accessible and appears to be restored"
else
    error "Database verification failed!"
fi

log "===== Restore Complete ====="
log "Safety backup available at: ${SAFETY_BACKUP}.gz"