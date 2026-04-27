#!/bin/bash

# Schedulist Ubuntu Server Setup Script
# This script sets up a fresh Ubuntu server for hosting Schedulist
# Tested on Ubuntu 22.04 LTS

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
APP_USER="schedulist"
APP_DIR="/var/www/schedulist"
NODE_VERSION="20"  # LTS version
GITHUB_REPO=""  # Will be set during setup

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "Please run as root (use sudo)"
fi

log "===== Starting Schedulist Server Setup ====="

# Get GitHub repository URL
read -p "Enter your GitHub repository URL (e.g., https://github.com/username/schedulist.git): " GITHUB_REPO
if [ -z "$GITHUB_REPO" ]; then
    error "GitHub repository URL is required"
fi

# Update system
log "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install essential packages
log "Installing essential packages..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    nginx \
    postgresql \
    postgresql-contrib \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban \
    htop \
    vim \
    unzip

# Install Node.js
log "Installing Node.js v${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node_version=$(node -v)
npm_version=$(npm -v)
log "Node.js installed: $node_version"
log "npm installed: $npm_version"

# Install PM2 globally
log "Installing PM2 process manager..."
npm install -g pm2

# Create application user
log "Creating application user: $APP_USER"
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    usermod -aG sudo "$APP_USER"
    log "User $APP_USER created"
else
    log "User $APP_USER already exists"
fi

# Setup PostgreSQL
log "Setting up PostgreSQL..."

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER schedulist_user WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE schedulist OWNER schedulist_user;
GRANT ALL PRIVILEGES ON DATABASE schedulist TO schedulist_user;
ALTER USER schedulist_user CREATEDB;
EOF

log "PostgreSQL database and user created"

# Create application directory
log "Creating application directory..."
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Clone repository
log "Cloning repository..."
cd "$APP_DIR"
sudo -u "$APP_USER" git clone "$GITHUB_REPO" .

# Create environment files
log "Creating environment configuration..."

# Backend .env
cat > "$APP_DIR/schedulist/.env" << EOF
NODE_ENV=production
PORT=5050
JWT_SECRET=${JWT_SECRET}
DATABASE_URL=postgresql://schedulist_user:${DB_PASSWORD}@localhost:5432/schedulist
DB_NAME=schedulist
DB_USER=schedulist_user
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=localhost
DB_PORT=5432
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

# Frontend .env.production
cat > "$APP_DIR/client/.env.production" << EOF
VITE_API_URL=/api
EOF

# Set proper permissions
chown "$APP_USER:$APP_USER" "$APP_DIR/schedulist/.env"
chown "$APP_USER:$APP_USER" "$APP_DIR/client/.env.production"
chmod 600 "$APP_DIR/schedulist/.env"

# Install dependencies and build
log "Installing application dependencies..."
cd "$APP_DIR/schedulist"
sudo -u "$APP_USER" npm ci --production=false

cd "$APP_DIR/client"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build

# Run database migrations
log "Running database migrations..."
cd "$APP_DIR/schedulist"
sudo -u "$APP_USER" npx sequelize-cli db:migrate

# Setup PM2
log "Setting up PM2 process manager..."
cd "$APP_DIR"

# Create PM2 ecosystem file
cat > "$APP_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'schedulist-backend',
    script: './schedulist/src/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5050
    },
    error_file: '/var/log/schedulist/pm2-error.log',
    out_file: '/var/log/schedulist/pm2-out.log',
    log_file: '/var/log/schedulist/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10
  }]
};
EOF

chown "$APP_USER:$APP_USER" "$APP_DIR/ecosystem.config.js"

# Create log directory
mkdir -p /var/log/schedulist
chown -R "$APP_USER:$APP_USER" /var/log/schedulist

# Start application with PM2
sudo -u "$APP_USER" pm2 start ecosystem.config.js
sudo -u "$APP_USER" pm2 save

# Setup PM2 startup script
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER"

# Configure Nginx
log "Configuring Nginx..."

# Get server IP or domain
read -p "Enter your domain name (or press Enter to use IP address): " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN=$(curl -s http://ipinfo.io/ip)
    warning "Using IP address: $DOMAIN"
fi

# Create Nginx configuration
cat > /etc/nginx/sites-available/schedulist << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    root $APP_DIR/client/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy
    location /api {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Auth routes
    location /auth {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Frontend routes (React Router)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml text/javascript application/x-javascript application/x-font-ttf application/vnd.ms-fontobject font/opentype;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/schedulist /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx
systemctl enable nginx

# Setup firewall
log "Configuring firewall..."
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP
ufw allow 443/tcp # HTTPS
ufw --force enable

# Setup fail2ban
log "Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Create backup directory
mkdir -p /var/backups/schedulist
chown "$APP_USER:$APP_USER" /var/backups/schedulist

# Setup cron for automatic backups
log "Setting up automatic backups..."
(crontab -u "$APP_USER" -l 2>/dev/null; echo "0 2 * * * $APP_DIR/deploy/backup.sh >> /var/log/schedulist/backup.log 2>&1") | crontab -u "$APP_USER" -

# Create deployment script symlink
ln -sf "$APP_DIR/deploy/deploy.sh" /usr/local/bin/schedulist-deploy
chmod +x /usr/local/bin/schedulist-deploy

# Save credentials
log "Saving credentials..."
cat > /root/schedulist-credentials.txt << EOF
===== Schedulist Credentials =====
Generated: $(date)

Database:
  Name: schedulist
  User: schedulist_user
  Password: ${DB_PASSWORD}

Application:
  JWT Secret: ${JWT_SECRET}
  Encryption Key: ${ENCRYPTION_KEY}

Access:
  URL: http://$DOMAIN
  Backend API: http://$DOMAIN/api

Deployment:
  Run: schedulist-deploy
  Logs: /var/log/schedulist/

IMPORTANT: Save these credentials securely and delete this file!
EOF

chmod 600 /root/schedulist-credentials.txt

# Final summary
log "===== Setup Complete ====="
echo
echo -e "${GREEN}Schedulist has been successfully installed!${NC}"
echo
echo "Next steps:"
echo "1. Review credentials in /root/schedulist-credentials.txt"
echo "2. Configure SSL certificate (if using domain):"
echo "   sudo certbot --nginx -d $DOMAIN"
echo "3. Create admin user:"
echo "   cd $APP_DIR/schedulist && npm run create-admin"
echo "4. Test the application:"
echo "   http://$DOMAIN"
echo
echo "Useful commands:"
echo "  Deploy updates: schedulist-deploy"
echo "  View logs: pm2 logs"
echo "  Monitor app: pm2 monit"
echo "  Backup database: $APP_DIR/deploy/backup.sh"
echo
warning "Remember to save and secure the credentials file!"