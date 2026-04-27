#!/bin/bash

# Schedulist Deployment Script
# This script handles the full deployment process including:
# - Database backup
# - Code update from GitHub
# - Database migrations
# - Application rebuild and restart

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/schedulist"
BACKUP_DIR="/var/backups/schedulist"
LOG_DIR="/var/log/schedulist"
DEPLOY_LOG="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
GITHUB_REPO="https://github.com/YOUR_USERNAME/schedulist.git"  # Update this
BRANCH="main"
NODE_ENV="production"

# Database configuration (can be overridden by environment)
DB_NAME="${DB_NAME:-schedulist}"
DB_USER="${DB_USER:-schedulist_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOY_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOY_LOG"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOY_LOG"
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$APP_DIR"
}

# Backup database
backup_database() {
    log "Starting database backup..."
    
    local BACKUP_FILE="${BACKUP_DIR}/schedulist-$(date +%Y%m%d-%H%M%S).sql"
    
    if PGPASSWORD="${DB_PASSWORD}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"; then
        log "Database backed up to: $BACKUP_FILE"
        
        # Compress the backup
        gzip "$BACKUP_FILE"
        log "Backup compressed: ${BACKUP_FILE}.gz"
        
        # Keep only last 7 days of backups
        find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
        log "Old backups cleaned up (keeping last 7 days)"
    else
        error "Database backup failed!"
    fi
}

# Pull latest code from GitHub
update_code() {
    log "Updating code from GitHub..."
    
    cd "$APP_DIR"
    
    # Stash any local changes
    git stash
    
    # Fetch and pull latest changes
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    log "Code updated to latest version"
    
    # Log the current commit
    COMMIT=$(git rev-parse HEAD)
    log "Current commit: $COMMIT"
}

# Install/update dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Backend dependencies
    cd "$APP_DIR/schedulist"
    npm ci --production=false  # Install all deps for build
    
    # Frontend dependencies and build
    cd "$APP_DIR/client"
    npm ci
    npm run build
    
    log "Dependencies installed and frontend built"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$APP_DIR/schedulist"
    
    # Run Sequelize migrations
    if npx sequelize-cli db:migrate; then
        log "Database migrations completed successfully"
    else
        error "Database migrations failed!"
    fi
}

# Update environment files
update_env() {
    log "Updating environment configuration..."
    
    # Backend .env
    if [ ! -f "$APP_DIR/schedulist/.env" ]; then
        warning "Backend .env file not found. Creating from template..."
        cat > "$APP_DIR/schedulist/.env" << EOF
NODE_ENV=production
PORT=5050
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(openssl rand -base64 32)}
EOF
        log "Backend .env file created (update with your values)"
    fi
    
    # Frontend .env (if needed)
    if [ ! -f "$APP_DIR/client/.env.production" ]; then
        cat > "$APP_DIR/client/.env.production" << EOF
VITE_API_URL=/api
EOF
        log "Frontend .env.production file created"
    fi
}

# Restart services
restart_services() {
    log "Restarting application services..."
    
    # Restart backend service
    if systemctl is-active --quiet schedulist-backend; then
        systemctl restart schedulist-backend
        log "Backend service restarted"
    else
        warning "Backend service not found. Starting it..."
        systemctl start schedulist-backend
    fi
    
    # Restart nginx
    if systemctl is-active --quiet nginx; then
        systemctl reload nginx
        log "Nginx reloaded"
    fi
    
    # Check service status
    sleep 3
    if systemctl is-active --quiet schedulist-backend; then
        log "Backend service is running"
    else
        error "Backend service failed to start!"
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait a bit for services to fully start
    sleep 5
    
    # Check backend API
    if curl -f -s "http://localhost:5050/health" > /dev/null; then
        log "Backend API is responding"
    else
        warning "Backend API health check failed"
    fi
    
    # Check frontend
    if curl -f -s "http://localhost" > /dev/null; then
        log "Frontend is accessible"
    else
        warning "Frontend health check failed"
    fi
}

# Main deployment flow
main() {
    log "===== Starting Schedulist Deployment ====="
    
    # Check if running as appropriate user
    if [ "$EUID" -eq 0 ]; then 
        warning "Running as root. Consider using a dedicated user."
    fi
    
    # Prompt for database password if not set
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Enter database password: " DB_PASSWORD
        echo
        export DB_PASSWORD
    fi
    
    # Setup
    setup_directories
    
    # Pre-deployment backup
    backup_database
    
    # Update code
    update_code
    
    # Install dependencies and build
    install_dependencies
    
    # Update configuration
    update_env
    
    # Run migrations
    run_migrations
    
    # Restart services
    restart_services
    
    # Health check
    health_check
    
    log "===== Deployment Complete ====="
    log "Deployment log saved to: $DEPLOY_LOG"
    
    # Show summary
    echo -e "\n${GREEN}Deployment Summary:${NC}"
    echo "- Code updated to: $(cd $APP_DIR && git rev-parse --short HEAD)"
    echo "- Database backed up to: ${BACKUP_DIR}"
    echo "- Services restarted successfully"
    echo "- Application URL: http://$(hostname -I | awk '{print $1}')"
}

# Handle script arguments
case "${1:-}" in
    --rollback)
        # Rollback functionality (to be implemented)
        error "Rollback not yet implemented"
        ;;
    --backup-only)
        setup_directories
        backup_database
        ;;
    --migrate-only)
        run_migrations
        ;;
    *)
        main
        ;;
esac