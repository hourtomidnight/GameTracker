# HTM Home Page Setup Instructions

## Step 1: Change Hostname to HTM

On your Pi:

```bash
# Change hostname
sudo hostnamectl set-hostname HTM

# Update hosts file
sudo nano /etc/hosts
```

Find the line:
```
127.0.1.1       raspberrypi
```

Change it to:
```
127.0.1.1       HTM
```

Save and exit (Ctrl+X, Y, Enter)

## Step 2: Upload Files to Pi

From your Windows computer:

```bash
# Upload home page files
scp home.html mytho@192.168.0.124:~/escape-room-tracker/home.html
scp home-server.js mytho@192.168.0.124:~/escape-room-tracker/home-server.js

# Upload nginx config
scp nginx-htm.conf mytho@192.168.0.124:~/nginx-htm.conf
```

## Step 3: Set Up nginx on Pi

On your Pi:

```bash
# Move nginx config to proper location
sudo mv ~/nginx-htm.conf /etc/nginx/sites-available/htm

# Remove old config if exists
sudo rm -f /etc/nginx/sites-enabled/escape-room
sudo rm -f /etc/nginx/sites-enabled/default

# Enable new config
sudo ln -s /etc/nginx/sites-available/htm /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 4: Start Home Page Server

On your Pi:

```bash
cd ~/escape-room-tracker

# Start home page server with PM2
pm2 start home-server.js --name htm-home

# Save PM2 configuration
pm2 save

# Check status
pm2 list
```

## Step 5: Reboot

```bash
sudo reboot
```

## Step 6: Access Your Sites

After reboot, from any computer on your network:

**Home Page (Password Protected Menu):**
- `http://HTM` or `http://HTM.local`
- Default password: `escape123`

**Direct Access (no password):**
- Escape Room Tracker: `http://HTM/escape-room`
- Node-RED: `http://HTM/nodered`
- CSV Files: `http://HTM/csv/`

## Features of Home Page:

1. **Password Protection** - Secure access to your home page
2. **Editable Links** - Add internal and external links via Settings
3. **Default Links Included:**
   - Escape Room Tracker (`/escape-room`)
   - Node-RED (`/nodered`)
   - CSV Downloads (`/escape-room#csvDownloads`)

## Managing the Home Page:

**To Add Links:**
1. Login with password
2. Click "Settings"
3. Enter link name and URL
4. Internal links start with `/` (e.g., `/escape-room`)
5. External links use full URL (e.g., `https://google.com`)
6. Click "Add Link"

**To Change Password:**
1. Go to Settings
2. Enter new password
3. Click "Update"

**To Delete Links:**
1. Go to Settings
2. Click trash icon next to any link

## Troubleshooting:

**If HTM.local doesn't work on Windows:**
- Install Bonjour Print Services from Apple
- Or just use `http://HTM` without `.local`
- Or use the IP: `http://192.168.0.124`

**Check Services are Running:**
```bash
pm2 list
sudo systemctl status nginx
```

**View Logs:**
```bash
pm2 logs htm-home
pm2 logs escape-room
sudo journalctl -u nginx -n 50
```

**Restart Everything:**
```bash
pm2 restart all
sudo systemctl restart nginx
```
