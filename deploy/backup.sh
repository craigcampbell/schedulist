#!/bin/bash

# Schedulist Database Backup Script
# Can be run standalone or scheduled via cron

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/schedulist}"
DB_NAME="${DB_NAME:-schedulist}"
DB_USER="${DB_USER:-schedulist_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
S3_BUCKET="${S3_BUCKET:-}"  # Optional S3 bucket for remote backups

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/schedulist-${TIMESTAMP}.sql"

# Perform database backup
log "Starting database backup..."

if [ -z "$DB_PASSWORD" ]; then
    # Try to read from .env file if password not in environment
    if [ -f "/var/www/schedulist/schedulist/.env" ]; then
        export $(grep DB_PASSWORD /var/www/schedulist/schedulist/.env | xargs)
    else
        read -sp "Enter database password: " DB_PASSWORD
        echo
    fi
fi

# Backup database
if PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    -f "$BACKUP_FILE"; then
    
    log "Database backed up to: $BACKUP_FILE"
    
    # Get backup size before compression
    SIZE_BEFORE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    # Compress the backup
    gzip -9 "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    # Get compressed size
    SIZE_AFTER=$(du -h "$BACKUP_FILE" | cut -f1)
    
    log "Backup compressed from $SIZE_BEFORE to $SIZE_AFTER"
else
    error "Database backup failed!"
fi

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
    log "Uploading backup to S3..."
    if aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/$(basename $BACKUP_FILE)"; then
        log "Backup uploaded to S3: s3://${S3_BUCKET}/backups/$(basename $BACKUP_FILE)"
    else
        error "Failed to upload backup to S3"
    fi
fi

# Clean up old backups
log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "schedulist-*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Clean up S3 backups if configured
if [ -n "$S3_BUCKET" ]; then
    log "Cleaning up old S3 backups..."
    aws s3 ls "s3://${S3_BUCKET}/backups/" | \
        awk '{print $4}' | \
        grep "^schedulist-" | \
        sort -r | \
        tail -n +$((RETENTION_DAYS + 1)) | \
        xargs -I {} aws s3 rm "s3://${S3_BUCKET}/backups/{}" 2>/dev/null || true
fi

# List remaining backups
log "Current backups:"
ls -lh "$BACKUP_DIR"/schedulist-*.sql.gz 2>/dev/null | tail -5

log "Backup completed successfully!"