# Schedulist Deployment Guide

This directory contains scripts and configurations for deploying Schedulist to a Digital Ocean Ubuntu droplet.

## Quick Start

### 1. Initial Server Setup (Fresh Ubuntu 22.04 LTS)

SSH into your new droplet and run:

```bash
# Download and run the setup script
wget https://raw.githubusercontent.com/YOUR_USERNAME/schedulist/main/deploy/setup-ubuntu.sh
chmod +x setup-ubuntu.sh
sudo ./setup-ubuntu.sh
```

This script will:
- Install Node.js, PostgreSQL, Nginx, and other dependencies
- Create a dedicated user and database
- Clone your repository
- Build the application
- Configure Nginx as a reverse proxy
- Set up automatic backups
- Configure firewall and security

### 2. Post-Setup Configuration

After the setup script completes:

1. **Save your credentials** (found in `/root/schedulist-credentials.txt`)
2. **Set up SSL** (if using a domain):
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```
3. **Create an admin user**:
   ```bash
   cd /var/www/schedulist/schedulist
   npm run create-admin  # You'll need to create this script
   ```

## Deployment Commands

### Deploy Updates

After pushing changes to GitHub, deploy them with:

```bash
sudo schedulist-deploy
```

Or if not symlinked:
```bash
sudo /var/www/schedulist/deploy/deploy.sh
```

This will:
1. Backup the database
2. Pull latest code from GitHub
3. Install dependencies
4. Build the frontend
5. Run database migrations
6. Restart services

### Manual Backup

```bash
sudo /var/www/schedulist/deploy/backup.sh
```

Backups are stored in `/var/backups/schedulist/` and automatically cleaned up after 7 days.

### Deploy with Options

```bash
# Only backup database
sudo schedulist-deploy --backup-only

# Only run migrations
sudo schedulist-deploy --migrate-only
```

## File Structure

```
deploy/
├── README.md              # This file
├── deploy.sh             # Main deployment script
├── backup.sh             # Database backup script
├── setup-ubuntu.sh       # Initial server setup script
├── nginx.conf            # Nginx configuration template
└── schedulist-backend.service  # Systemd service file
```

## Configuration Files

### Environment Variables

Backend configuration is stored in `/var/www/schedulist/schedulist/.env`:
```env
NODE_ENV=production
PORT=5050
JWT_SECRET=<generated>
DATABASE_URL=postgresql://schedulist_user:password@localhost:5432/schedulist
ENCRYPTION_KEY=<generated>
```

### Database Connection

For using external databases (like Digital Ocean Managed Database):

1. Update the `DATABASE_URL` in `.env`
2. Update individual DB variables:
   ```env
   DB_HOST=your-db-host.db.ondigitalocean.com
   DB_PORT=25060
   DB_NAME=schedulist
   DB_USER=schedulist_user
   DB_PASSWORD=your-password
   DB_SSL=true  # For managed databases
   ```

## Monitoring

### View Application Logs

Using PM2:
```bash
pm2 logs schedulist-backend
pm2 monit  # Real-time monitoring
```

Using systemd (if using service file):
```bash
journalctl -u schedulist-backend -f
```

### Check Service Status

```bash
pm2 status
# or
systemctl status schedulist-backend
```

### Nginx Logs

```bash
# Access logs
tail -f /var/log/nginx/schedulist-access.log

# Error logs
tail -f /var/log/nginx/schedulist-error.log
```

## Troubleshooting

### Application Won't Start

1. Check logs:
   ```bash
   pm2 logs schedulist-backend --lines 100
   ```

2. Verify database connection:
   ```bash
   sudo -u schedulist psql -d schedulist -c "SELECT 1;"
   ```

3. Check port availability:
   ```bash
   lsof -i :5050
   ```

### Database Issues

1. Reset database (CAUTION: This will delete all data):
   ```bash
   cd /var/www/schedulist/schedulist
   npx sequelize-cli db:drop
   npx sequelize-cli db:create
   npx sequelize-cli db:migrate
   npm run db:seed  # Optional: add test data
   ```

2. Restore from backup:
   ```bash
   # Find latest backup
   ls -lh /var/backups/schedulist/

   # Restore
   gunzip -c /var/backups/schedulist/schedulist-YYYYMMDD-HHMMSS.sql.gz | \
     psql -U schedulist_user -d schedulist
   ```

### Nginx Issues

1. Test configuration:
   ```bash
   nginx -t
   ```

2. Reload configuration:
   ```bash
   systemctl reload nginx
   ```

### Permission Issues

Fix ownership:
```bash
chown -R schedulist:schedulist /var/www/schedulist
```

## Security Considerations

### Firewall Rules

The setup script configures UFW with:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)

### Fail2ban

Automatically installed to prevent brute force attacks.

### Database Security

- Database is only accessible locally by default
- Strong passwords are auto-generated during setup
- Regular backups are scheduled

### SSL/TLS

Use Certbot to set up free Let's Encrypt certificates:
```bash
sudo certbot --nginx -d your-domain.com
```

## Scaling Considerations

### Using Digital Ocean Managed Database

1. Create a managed PostgreSQL database in Digital Ocean
2. Update your `.env` file with the connection details
3. Run migrations:
   ```bash
   cd /var/www/schedulist/schedulist
   npx sequelize-cli db:migrate
   ```

### Horizontal Scaling

For multiple app servers:
1. Use Digital Ocean Load Balancer
2. Store sessions in Redis (requires code changes)
3. Use managed database
4. Use object storage for file uploads

### Monitoring

Consider adding:
- New Relic or DataDog for APM
- Sentry for error tracking
- CloudFlare for CDN and DDoS protection

## Backup Strategy

### Automatic Backups

Configured via cron to run daily at 2 AM:
```bash
crontab -u schedulist -l
```

### Manual Backup

```bash
/var/www/schedulist/deploy/backup.sh
```

### S3 Backups

To enable S3 backups:

1. Install AWS CLI:
   ```bash
   apt-get install awscli
   ```

2. Configure AWS credentials:
   ```bash
   aws configure
   ```

3. Set S3_BUCKET environment variable:
   ```bash
   export S3_BUCKET=your-backup-bucket
   ```

## Updates and Maintenance

### System Updates

```bash
apt-get update && apt-get upgrade -y
```

### Node.js Updates

```bash
# Check current version
node -v

# Update Node.js (if needed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### Database Updates

Always backup before migrations:
```bash
/var/www/schedulist/deploy/backup.sh
cd /var/www/schedulist/schedulist
npx sequelize-cli db:migrate
```

## Common Tasks

### Reset Demo Data

```bash
cd /var/www/schedulist/schedulist
npx sequelize-cli db:seed:undo:all
npx sequelize-cli db:seed:all
```

### Clear Application Cache

```bash
pm2 restart schedulist-backend
```

### Update Environment Variables

1. Edit the `.env` file:
   ```bash
   nano /var/www/schedulist/schedulist/.env
   ```

2. Restart the application:
   ```bash
   pm2 restart schedulist-backend
   ```

## Support

For issues specific to deployment:
1. Check application logs
2. Check system logs: `journalctl -xe`
3. Review this documentation
4. Check Digital Ocean's documentation

## Version Information

- Ubuntu: 22.04 LTS recommended
- Node.js: v20 LTS
- PostgreSQL: 14+
- Nginx: Latest stable
- PM2: Latest version