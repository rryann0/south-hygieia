# Domain Configuration Guide

This guide explains how to configure the application to use the domain name `https://shs-hygieia.tusd.org/` instead of the IP address.

## Prerequisites

- SSL certificate already configured for `shs-hygieia.tusd.org`
- DNS pointing to your server IP
- Nginx installed and configured

## Steps to Configure

### 1. Update Nginx Configuration

On your server, edit or create the Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/hygieia
```

Use this configuration:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name shs-hygieia.tusd.org;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    server_name shs-hygieia.tusd.org;

    # SSL Certificate paths - UPDATE THESE IF YOUR CERTS ARE IN A DIFFERENT LOCATION
    ssl_certificate /etc/letsencrypt/live/shs-hygieia.tusd.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shs-hygieia.tusd.org/privkey.pem;
    
    # SSL Configuration (best practices)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend: Serve React static files
    location / {
        root /var/www/hygieia/client;
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

**Important:** Update the SSL certificate paths if your certificates are stored in a different location. Common locations:
- Let's Encrypt: `/etc/letsencrypt/live/domain/fullchain.pem`
- Custom: Check your certificate provider's documentation

### 2. Enable the Site (if not already enabled)

```bash
sudo ln -s /etc/nginx/sites-available/hygieia /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Optional: remove default site
```

### 3. Update Backend `.env` File

Edit the backend environment file:

```bash
cd /var/www/hygieia/server
nano .env
```

Update the `FRONTEND_URL` line:

```env
FRONTEND_URL=https://shs-hygieia.tusd.org
```

**Change from:** `FRONTEND_URL=http://192.168.4.18`  
**Change to:** `FRONTEND_URL=https://shs-hygieia.tusd.org`

### 4. Test and Apply Changes

```bash
# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx

# Restart backend to pick up new environment variables
cd /var/www/hygieia/server
pm2 restart cleanliness-api
```

### 5. Verify DNS Resolution

Ensure DNS is pointing to your server:

```bash
# Test DNS resolution
nslookup shs-hygieia.tusd.org
# or
dig shs-hygieia.tusd.org
```

The domain should resolve to your server's IP address.

### 6. Test the Application

1. Visit `https://shs-hygieia.tusd.org` in a browser
2. Verify SSL certificate is valid (green lock icon)
3. Test API endpoint: `curl https://shs-hygieia.tusd.org/api/health`
4. Verify login screen appears and authentication works

## Troubleshooting

### SSL Certificate Errors

If you get SSL errors, check:
- Certificate paths are correct
- Certificate files are readable: `sudo ls -la /etc/letsencrypt/live/shs-hygieia.tusd.org/`
- Certificate is not expired: `sudo openssl x509 -in /etc/letsencrypt/live/shs-hygieia.tusd.org/cert.pem -noout -dates`

### 502 Bad Gateway

- Check if backend is running: `pm2 status`
- Check backend logs: `pm2 logs cleanliness-api`
- Verify backend is listening on port 3000: `netstat -tlnp | grep 3000`

### CORS Errors

- Verify `FRONTEND_URL` in `.env` matches the domain
- Check backend logs for CORS errors
- Ensure `secure: true` is set in session cookie config (already done in code)

### DNS Not Resolving

- Verify DNS records are correct
- Check if DNS has propagated: `dig shs-hygieia.tusd.org`
- Contact your DNS administrator if needed

## Notes

- The backend code has been updated to automatically use `secure: true` for cookies in production (HTTPS)
- CORS is configured to allow the domain from `FRONTEND_URL` environment variable
- Session cookies will now work properly with HTTPS
