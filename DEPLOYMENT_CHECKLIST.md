# Campus Cleanliness App - Deployment Checklist

## ✅ PHASE 1: LOCAL DEVELOPMENT SETUP

### Backend Setup
- [x] Create backend directory structure
- [x] Create `package.json`
- [x] Install backend dependencies (`npm install` in backend/)
- [ ] Create `.env` file (copy from .env.example and configure)
- [ ] Generate VAPID keys (`npx web-push generate-vapid-keys`)
- [x] Create `server.js`
- [x] Create logs directory
- [ ] Test backend locally (`npm run dev` in backend/)

### Frontend Setup
- [x] Install axios in frontend
- [x] Create `src/api.js`
- [x] Update `App.jsx` to use API
- [ ] Test frontend locally with backend running

### Configuration
- [x] Create `.gitignore`

---

## 📋 PHASE 2: SERVER PREPARATION

### Connect to VM
- [ ] Connect via SSH/PuTTY to `192.168.4.18`

### System Setup
- [ ] Update system packages (`sudo apt update && sudo apt upgrade -y`)
- [ ] Install build dependencies
- [ ] Install Node.js 20 LTS
- [ ] Verify Node.js installation
- [ ] Install Nginx
- [ ] Install PM2 globally
- [ ] Configure firewall (ports 22, 80, 443)

### Create Project Structure
- [ ] Create directories: `/var/www/cleanliness-app/{server,client,data,logs}`
- [ ] Set proper ownership

---

## 📋 PHASE 3: DEPLOY BACKEND

### Upload Backend Code
- [ ] Upload backend files to server (SCP/Git/manual)
- [ ] Exclude `node_modules/` folder

### Install Backend Dependencies
- [ ] Run `npm install` on server
- [ ] Generate VAPID keys on server
- [ ] Create `.env` file on server with production values
- [ ] Create logs directory
- [ ] Test backend (`node server.js`)

### Start with PM2
- [ ] Start with PM2: `pm2 start server.js --name cleanliness-api`
- [ ] Save PM2 config: `pm2 save`
- [ ] Setup PM2 startup: `pm2 startup`
- [ ] Verify PM2 is running: `pm2 list`

---

## 📋 PHASE 4: DEPLOY FRONTEND

### Build Frontend Locally
- [ ] Run `npm run build` (creates `dist/` folder)

### Upload Frontend Build
- [ ] Upload `dist/` contents to `/var/www/cleanliness-app/client/`
- [ ] Verify files on server

---

## 📋 PHASE 5: CONFIGURE NGINX

### Create Nginx Configuration
- [ ] Create `/etc/nginx/sites-available/cleanliness-app`
- [ ] Paste configuration from README
- [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/cleanliness-app /etc/nginx/sites-enabled/`
- [ ] Remove default site (optional)
- [ ] Test Nginx config: `sudo nginx -t`
- [ ] Restart Nginx: `sudo systemctl restart nginx`
- [ ] Verify Nginx is running: `sudo systemctl status nginx`

---

## 📋 PHASE 6: TESTING

### Test Application
- [ ] Test health endpoint: `curl http://localhost:3000/api/health`
- [ ] Test frontend access: Open `http://192.168.4.18` in browser
- [ ] Test API through Nginx: `curl http://192.168.4.18/api/health`

### Functional Testing
- [ ] Select a custodian
- [ ] Log a restroom check
- [ ] Verify check appears in system
- [ ] Report an incident
- [ ] Verify incident prevents checks
- [ ] Toggle admin mode
- [ ] Resolve incident
- [ ] Verify can now log check again

---

## 📋 PHASE 7: PRODUCTION HARDENING

### Security
- [ ] Set proper file permissions (`.env`, `.db`, `logs/`)
- [ ] Hide Nginx version
- [ ] Set up automatic security updates

### Monitoring
- [ ] Set up log rotation
- [ ] Monitor PM2 logs
- [ ] Set up monitoring alerts (optional)

### Backups
- [ ] Create backup script
- [ ] Make backup script executable
- [ ] Test backup script
- [ ] Schedule daily backups with cron

---

## 📋 PHASE 8: OPTIONAL ENHANCEMENTS

### SSL Certificate (if using domain)
- [ ] Install Certbot
- [ ] Get SSL certificate
- [ ] Test auto-renewal

### Email Notifications
- [ ] Configure nodemailer
- [ ] Test email sending
- [ ] Add to incident report handler

### SMS Notifications
- [ ] Add Twilio credentials
- [ ] Test SMS sending
- [ ] Add to incident report handler

### Web Push Notifications
- [ ] Create service worker
- [ ] Add push subscription logic
- [ ] Test browser notifications

---

## 📋 PHASE 9: DOCUMENTATION

- [x] Create README.md
- [ ] Document credentials securely
- [ ] Create user training materials
- [ ] Document admin procedures

---

## ✅ FINAL VERIFICATION

- [ ] App loads at `http://192.168.4.18`
- [ ] Can select custodian
- [ ] Can log checks
- [ ] Can report incidents
- [ ] Incidents block checks
- [ ] Admin mode works
- [ ] Can resolve incidents
- [ ] PM2 auto-restarts on crash
- [ ] PM2 starts on server reboot
- [ ] Backups run daily
- [ ] Logs are being created
- [ ] Firewall is active

---

## 🎉 DEPLOYMENT COMPLETE!

**Next Steps:**
1. Train custodial staff on using the system
2. Set up admin accounts (implement authentication)
3. Configure email/SMS notifications
4. Monitor usage and gather feedback
5. Plan for future enhancements

