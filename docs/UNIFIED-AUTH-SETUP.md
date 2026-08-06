# HTM Unified Authentication Setup

## Overview
This setup creates a centralized authentication system where logging in once gives access to all pages:
- Home page with editable links
- Escape Room Tracker  
- CSV Downloads
- Any other pages you add

Default password: **escape123**

## Step 1: Install Dependencies

On your Pi:

```bash
cd ~/escape-room-tracker

# Install express-session for authentication
npm install express-session --save
```

## Step 2: Change Hostname to HTM

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

## Step 3: Upload Files

From your Windows computer:

```bash
# Stop the old escape-room server
ssh mytho@192.168.0.124 'pm2 delete escape-room'

# Upload all files
scp server.js mytho@192.168.0.124:~/escape-room-tracker/server.js
scp login.html mytho@192.168.0.124:~/escape-room-tracker/login.html
scp home.html mytho@192.168.0.124:~/escape-room-tracker/home.html
scp index.html mytho@192.168.0.124:~/escape-room-tracker/index.html
scp nginx-htm.conf mytho@192.168.0.124:~/nginx-htm.conf
```

## Step 4: Set Up nginx

On your Pi:

```bash
# Move nginx config
sudo mv ~/nginx-htm.conf /etc/nginx/sites-available/htm

# Remove old configs
sudo rm -f /etc/nginx/sites-enabled/*

# Enable new config
sudo ln -s /etc/nginx/sites-available/htm /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 5: Start Unified Server

On your Pi:

```bash
cd ~/escape-room-tracker

# Start the unified server with PM2
pm2 start server.js --name htm-server

# Save PM2 configuration
pm2 save

# Enable PM2 to start on boot
pm2 startup
# Follow the command it gives you (will start with 'sudo')

# Check status
pm2 list
```

## Step 6: Reboot

```bash
sudo reboot
```

## Step 7: Access Your System

After reboot, from any browser on your network:

**Login Page:**
- `http://HTM/login` or `http://HTM.local/login`
- Default password: `escape123`

**After Login, Access Anywhere:**
- Home (menu): `http://HTM` or `http://HTM.local`
- Escape Room: `http://HTM/escape-room`
- Node-RED: `http://HTM/nodered`
- CSV Files: `http://HTM/csv/`

## How Authentication Works:

1. **First Visit**: Redirected to login page
2. **Enter Password**: Creates a session cookie (lasts 24 hours)
3. **Access Everything**: All pages check your session automatically
4. **No Re-login**: Stay logged in across all pages for 24 hours
5. **Logout**: Click logout button on home page, or wait 24 hours

## Managing Your System:

### Change Password:
1. Login and go to Home (`http://HTM`)
2. Click "Settings"
3. Enter new password and click "Update"
4. Password is shared across all pages

### Add Links to Home Page:
1. Go to Settings on Home page
2. Add internal links: `/escape-room`, `/nodered`
3. Add external links: `https://google.com`, `https://netflix.com`

### Logout:
- Click "Logout" button on home page
- Or close browser and wait 24 hours

## Troubleshooting:

### If HTM.local doesn't work on Windows:
```bash
# Option 1: Install Bonjour Print Services (from Apple)
# Option 2: Just use http://HTM
# Option 3: Use IP http://192.168.0.124
```

### Check Services:
```bash
pm2 list
sudo systemctl status nginx
```

### View Logs:
```bash
pm2 logs htm-server
sudo journalctl -u nginx -n 50
```

### Restart Everything:
```bash
pm2 restart htm-server
sudo systemctl restart nginx
```

### Reset Password:
If you forget your password, on the Pi:
```bash
cd ~/escape-room-tracker
node -e "
const storage = {};
storage['authPassword'] = 'escape123';
console.log('Password reset to: escape123');
"
# Then restart: pm2 restart htm-server
```

## File Structure:

```
~/escape-room-tracker/
├── server.js          # Unified server with authentication
├── login.html         # Login page
├── home.html          # Home page with menu
├── index.html         # Escape room tracker
└── csv_files/         # Generated CSV files
```

## Security Notes:

- Sessions last 24 hours
- Password is stored in memory (resets on server restart to default)
- Use Settings to change from default password
- All pages require authentication
- HTTPS not configured (local network only)

## What's Next:

After setup is complete:
1. Login with default password `escape123`
2. Change the password in Settings
3. Add your favorite links to the home page
4. Start tracking escape room games!
