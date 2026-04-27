# Schedulist Deployment Instructions

This guide will walk you through deploying Schedulist to a Digital Ocean Ubuntu droplet for development and demo purposes.

## Prerequisites

- A Digital Ocean account
- A fresh Ubuntu 22.04 LTS droplet (minimum 2GB RAM recommended)
- Your code pushed to a GitHub repository
- SSH access to your droplet

## Step 1: Create a Digital Ocean Droplet

1. Log into Digital Ocean
2. Create a new droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic (minimum 2GB RAM / 1 vCPU)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password
   - **Hostname**: `schedulist-demo` (or your preference)

3. Note your droplet's IP address once created

## Step 2: Initial Server Setup

1. **SSH into your droplet:**
   ```bash
   ssh root@your-droplet-ip
   ```

2. **Download and run the setup script:**
   ```bash
   # Download the setup script
   wget https://raw.githubusercontent.com/YOUR_USERNAME/schedulist/main/deploy/setup-ubuntu.sh
   
   # Make it executable
   chmod +x setup-ubuntu.sh
   
   # Run the setup
   sudo ./setup-ubuntu.sh
   ```

3. **During setup, you'll be prompted for:**
   - Your GitHub repository URL (e.g., `https://github.com/yourusername/schedulist.git`)
   - Your domain name (or press Enter to use the IP address)

4. **The setup script will automatically:**
   - Install Node.js v20 LTS, PostgreSQL, Nginx, and PM2
   - Create a dedicated `schedulist` user
   - Set up the PostgreSQL database with secure credentials
   - Clone your repository
   - Build the application
   - Configure Nginx as a reverse proxy
   - Set up firewall rules
   - Configure automatic daily backups
   - Start the application

5. **Save your credentials:**
   After setup completes, you'll find generated credentials in:
   ```bash
   cat /root/schedulist-credentials.txt
   ```
   **⚠️ IMPORTANT: Save these credentials securely and then delete this file!**

## Step 3: Post-Setup Configuration

### Set Up SSL (if using a domain)

#### Prerequisites for SSL

1. **Point your domain to the droplet IP:**
   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Add an A record pointing to your droplet's IP address
   - Example: `A record: @ -> your.droplet.ip.address`
   - For www subdomain: `A record: www -> your.droplet.ip.address`
   - Wait for DNS propagation (5-30 minutes typically)

2. **Verify DNS is working:**
   ```bash
   # From your local machine
   ping your-domain.com
   nslookup your-domain.com
   ```

#### Install Certbot (if not already installed)

```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx
```

#### Obtain SSL Certificate

1. **Run Certbot:**
   ```bash
   # For a single domain
   sudo certbot --nginx -d your-domain.com
   
   # For domain with www
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

2. **Follow the interactive prompts:**
   - Enter your email address (for renewal notifications)
   - Agree to terms of service (type 'A')
   - Choose whether to share email with EFF (optional)
   - Select option 2 to redirect all HTTP traffic to HTTPS (recommended)

3. **Certbot will automatically:**
   - Obtain the SSL certificate from Let's Encrypt
   - Configure Nginx to use the certificate
   - Set up automatic HTTP to HTTPS redirection
   - Reload Nginx

#### Verify SSL Installation

```bash
# Check certificate status
sudo certbot certificates

# Test SSL configuration
curl https://your-domain.com

# Check SSL grade (from local machine)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

#### Set Up Automatic Renewal

Let's Encrypt certificates expire after 90 days. Certbot sets up automatic renewal, but verify it:

```bash
# Test renewal process
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status snap.certbot.renew.timer
# or if installed via apt:
sudo systemctl status certbot.timer

# View renewal configuration
cat /etc/cron.d/certbot
```

#### Troubleshooting SSL Issues

If Certbot fails:

```bash
# Check Nginx configuration
sudo nginx -t

# View Certbot logs
sudo journalctl -u snap.certbot.renew.service
# or
sudo less /var/log/letsencrypt/letsencrypt.log

# Common issues and fixes:

# 1. Port 80 not accessible
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 2. Domain not pointing to server
# Verify with: dig your-domain.com

# 3. Nginx configuration issues
# Reset Nginx config and try again
sudo cp /var/www/schedulist/deploy/nginx.conf /etc/nginx/sites-available/schedulist
sudo nginx -t
sudo systemctl reload nginx
```

#### Manual Certificate Renewal

If automatic renewal fails:

```bash
# Manually renew
sudo certbot renew

# Force renewal (even if not expiring soon)
sudo certbot renew --force-renewal

# Renew specific certificate
sudo certbot renew --cert-name your-domain.com
```

### Create Initial Admin User

Since the app doesn't have a public registration, you'll need to create an admin user:

1. **Access the server:**
   ```bash
   ssh root@your-droplet-ip
   ```

2. **Navigate to the app directory:**
   ```bash
   cd /var/www/schedulist/schedulist
   ```

3. **Create an admin through the database:**
   ```bash
   # Option 1: Run the seed script for demo data
   npm run db:seed
   
   # Option 2: Create manually (you'll need to implement a create-admin script)
   # npm run create-admin
   ```

## Step 4: Accessing Your Application

After setup is complete:

- **Application URL**: `http://your-droplet-ip` (or `https://your-domain.com` if SSL is configured)
- **Default ports**:
  - Frontend: Served via Nginx on port 80/443
  - Backend API: Running on port 5050 (proxied through Nginx)

## Step 5: Deploying Updates

After making changes and pushing to GitHub:

1. **SSH into your server:**
   ```bash
   ssh root@your-droplet-ip
   ```

2. **Run the deployment script:**
   ```bash
   sudo schedulist-deploy
   ```

   This will:
   - Backup the database
   - Pull latest code from GitHub
   - Install any new dependencies
   - Build the frontend
   - Run database migrations
   - Restart the application
   - Perform health checks

### Deployment Options

```bash
# Full deployment (default)
sudo schedulist-deploy

# Only backup the database
sudo schedulist-deploy --backup-only

# Only run migrations
sudo schedulist-deploy --migrate-only
```

## Managing the Application

### View Application Status

```bash
# Using PM2
pm2 status
pm2 monit  # Real-time monitoring

# View logs
pm2 logs schedulist-backend
pm2 logs schedulist-backend --lines 100
```

### Restart Application

```bash
pm2 restart schedulist-backend
```

### Database Management

```bash
# Manual backup
/var/www/schedulist/deploy/backup.sh

# Restore from backup
/var/www/schedulist/deploy/restore.sh /var/backups/schedulist/schedulist-YYYYMMDD-HHMMSS.sql.gz

# Access PostgreSQL
sudo -u postgres psql -d schedulist
```

### View Logs

```bash
# Application logs
pm2 logs schedulist-backend

# Nginx logs
tail -f /var/log/nginx/schedulist-access.log
tail -f /var/log/nginx/schedulist-error.log

# Deployment logs
ls -la /var/log/schedulist/
```

## Updating Configuration

### Environment Variables

1. **Edit the environment file:**
   ```bash
   nano /var/www/schedulist/schedulist/.env
   ```

2. **Restart the application:**
   ```bash
   pm2 restart schedulist-backend
   ```

### Using External Database (e.g., Digital Ocean Managed Database)

1. **Update `.env` file:**
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
   DB_HOST=your-db-cluster.db.ondigitalocean.com
   DB_PORT=25060
   DB_SSL=true
   ```

2. **Run migrations on new database:**
   ```bash
   cd /var/www/schedulist/schedulist
   npx sequelize-cli db:migrate
   ```

3. **Restart application:**
   ```bash
   pm2 restart schedulist-backend
   ```

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs schedulist-backend --lines 200

# Check if port is in use
lsof -i :5050

# Verify database connection
sudo -u postgres psql -d schedulist -c "SELECT 1;"
```

### Database Connection Issues

```bash
# Test database connection
cd /var/www/schedulist/schedulist
node -e "const db = require('./src/models'); db.sequelize.authenticate().then(() => console.log('Connected')).catch(err => console.error(err))"
```

### Nginx Issues

```bash
# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx

# Check Nginx logs
tail -f /var/log/nginx/schedulist-error.log
```

### Permission Issues

```bash
# Fix ownership
chown -R schedulist:schedulist /var/www/schedulist

# Fix permissions
chmod -R 755 /var/www/schedulist
```

## Backup and Recovery

### Automatic Backups

Backups run automatically every day at 2 AM. They're stored in `/var/backups/schedulist/` and kept for 7 days.

### Manual Backup

```bash
/var/www/schedulist/deploy/backup.sh
```

### Restore from Backup

```bash
# List available backups
ls -lh /var/backups/schedulist/

# Restore specific backup
/var/www/schedulist/deploy/restore.sh /var/backups/schedulist/schedulist-20240101-020001.sql.gz
```

## Security Notes

- Firewall is configured to only allow ports 22 (SSH), 80 (HTTP), and 443 (HTTPS)
- Database is only accessible locally
- Fail2ban is installed to prevent brute force attacks
- All passwords are randomly generated during setup
- Regular backups are configured

## Monitoring and Maintenance

### System Updates

```bash
# Update system packages
apt update && apt upgrade -y

# Update Node.js (if needed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### Monitor Resource Usage

```bash
# Check system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h
```

### Clean Up Old Logs

```bash
# Logs are automatically rotated, but you can manually clean if needed
find /var/log/schedulist -name "*.log" -mtime +30 -delete
```

## Quick Reference

### Important Paths

- **Application**: `/var/www/schedulist/`
- **Backend**: `/var/www/schedulist/schedulist/`
- **Frontend**: `/var/www/schedulist/client/`
- **Backups**: `/var/backups/schedulist/`
- **Logs**: `/var/log/schedulist/`
- **Nginx Config**: `/etc/nginx/sites-available/schedulist`

### Key Commands

```bash
# Deploy updates
sudo schedulist-deploy

# View logs
pm2 logs schedulist-backend

# Restart app
pm2 restart schedulist-backend

# Backup database
/var/www/schedulist/deploy/backup.sh

# Monitor app
pm2 monit
```

### Default Credentials Location

After initial setup, credentials are saved in:
```
/root/schedulist-credentials.txt
```

**Remember to save these securely and delete the file!**

## Support

For deployment issues:
1. Check the application logs first
2. Review the troubleshooting section above
3. Check the `/var/www/schedulist/deploy/README.md` for additional details
4. Consult Digital Ocean's documentation for droplet-specific issues

## Next Steps

After successful deployment:
1. Set up SSL with Certbot
2. Configure DNS for your domain
3. Create user accounts
4. Load initial data if needed
5. Set up monitoring (optional)
6. Configure regular backups to S3 (optional)