# Campus Cleanliness Management System

A comprehensive restroom management and incident tracking system for campus facilities.

## 🚀 Features

- **Restroom Check Logging**: Track when restrooms are checked by custodial staff
- **Incident Reporting**: Report and track incidents that prevent restroom checks
- **Gender-Based Filtering**: Automatically filters restrooms based on custodian gender
- **Admin Mode**: Resolve incidents and manage the system
- **Real-time Status**: View restroom status and last check times
- **Persistent Storage**: SQLite database for reliable data storage

## 📋 Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Express.js + Better-SQLite3
- **Database**: SQLite with WAL mode
- **Deployment**: Nginx + PM2 (for production)

## 🛠️ Local Development Setup

### Prerequisites

- Node.js 20+ and npm
- Git (optional)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate VAPID keys (for web push notifications)**
   ```bash
   npx web-push generate-vapid-keys
   # Copy the keys to your .env file
   ```

5. **Start the backend server**
   ```bash
   npm run dev  # Development mode with nodemon
   # or
   npm start    # Production mode
   ```

   The backend will run on `http://localhost:3000`

### Frontend Setup

1. **Install dependencies** (from project root)
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

   The frontend will run on `http://localhost:5173`

### Testing Locally

1. Start the backend server (port 3000)
2. Start the frontend dev server (port 5173)
3. Open `http://localhost:5173` in your browser
4. Test the application:
   - Select a custodian
   - Log a restroom check
   - Report an incident
   - Toggle admin mode and resolve incidents

## 📦 Production Deployment

### Server Requirements

- Ubuntu 20.04+ or similar Linux distribution
- Node.js 20 LTS
- Nginx
- PM2 (for process management)

### Deployment Steps

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Configure firewall
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

#### 2. Create Project Structure

```bash
sudo mkdir -p /var/www/cleanliness-app/{server,client,data,logs}
sudo chown -R $USER:$USER /var/www/cleanliness-app
```

#### 3. Deploy Backend

```bash
# Upload backend files to /var/www/cleanliness-app/server/
# (Use SCP, Git, or file transfer tool)

cd /var/www/cleanliness-app/server
npm install
npm start  # Test that it works
pm2 start server.js --name cleanliness-api
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

#### 4. Build and Deploy Frontend

```bash
# On local machine
cd /path/to/project
npm run build

# Upload dist/ contents to /var/www/cleanliness-app/client/
# (Use SCP or file transfer tool)
```

#### 5. Configure Nginx

Create `/etc/nginx/sites-available/cleanliness-app`:

```nginx
server {
    listen 80;
    server_name 192.168.4.18;  # Replace with your IP or domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend: Serve React static files
    location / {
        root /var/www/cleanliness-app/client;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend: Proxy API requests to Express
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Block access to sensitive files
    location ~ /\. {
        deny all;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/cleanliness-app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Optional
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. Verify Deployment

- Visit `http://YOUR_SERVER_IP` in a browser
- Test API: `curl http://YOUR_SERVER_IP/api/health`
- Check PM2: `pm2 status`
- Check Nginx: `sudo systemctl status nginx`

## 🔧 Configuration

### Environment Variables

Backend `.env` file:

```env
PORT=3000
NODE_ENV=production
DB_PATH=./cleanliness.db
SESSION_SECRET=your_secure_random_string_here
FRONTEND_URL=http://192.168.4.18
USER_PASSWORD=your_secure_user_password_here
ADMIN_PASSWORD=your_secure_admin_password_here

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
ADMIN_EMAIL=admin@tusd.com

# Web Push (optional)
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_EMAIL=mailto:admin@tusd.com
```

### Database

The SQLite database is automatically created and seeded with:
- 4 restrooms (A, B, C, D)
- 5 custodians (Shantelle, Jalessa, Joel, Javon, Rey)

## 📊 API Endpoints

- `GET /api/health` - Health check
- `GET /api/restrooms` - Get all restrooms
- `GET /api/custodians` - Get all custodians
- `GET /api/checks` - Get all checks
- `POST /api/checks` - Log a check
- `GET /api/incidents` - Get all incidents
- `POST /api/incidents` - Report an incident
- `POST /api/incidents/resolve` - Resolve an incident

## 🔒 Security

- Helmet.js for security headers
- Rate limiting on API routes
- SQL injection protection (parameterized queries)
- CORS configuration
- Session management with secure cookies

## 📝 Maintenance

### Viewing Logs

```bash
# PM2 logs
pm2 logs cleanliness-api

# Application logs
tail -f /var/www/cleanliness-app/server/logs/combined.log

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Backups

Create a backup script (`~/backup.sh`):

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/cleanliness-app/backups"
DB_PATH="/var/www/cleanliness-app/server/cleanliness.db"

mkdir -p $BACKUP_DIR
sqlite3 $DB_PATH ".backup $BACKUP_DIR/cleanliness_$DATE.db"
find $BACKUP_DIR -name "cleanliness_*.db" -mtime +90 -delete
```

Schedule with cron:

```bash
crontab -e
# Add: 0 2 * * * /home/username/backup.sh
```

### Restarting Services

```bash
# Restart backend
pm2 restart cleanliness-api

# Restart Nginx
sudo systemctl restart nginx

# Check status
pm2 status
sudo systemctl status nginx
```

## 🐛 Troubleshooting

### App doesn't load

1. Check PM2: `pm2 status`
2. Check PM2 logs: `pm2 logs cleanliness-api`
3. Check Nginx: `sudo systemctl status nginx`
4. Test API: `curl http://localhost:3000/api/health`
5. Check firewall: `sudo ufw status`

### API calls fail

1. Check CORS configuration in `server.js`
2. Verify Nginx proxy settings
3. Check backend logs for errors
4. Test API directly: `curl http://localhost:3000/api/health`

### Database errors

1. Check file permissions: `ls -la *.db`
2. Verify database integrity: `sqlite3 cleanliness.db "PRAGMA integrity_check;"`
3. Check WAL files exist if using WAL mode

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ for campus cleanliness management**
