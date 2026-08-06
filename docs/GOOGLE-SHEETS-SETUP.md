# Google Sheets Integration Setup Guide

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create New Project**
   - Click "Select a project" (top left)
   - Click "New Project"
   - Name: `Hour-to-Midnight-Tracker` (or anything you want)
   - Click "Create"

## Step 2: Enable Google Sheets API

1. **Navigate to APIs & Services**
   - In the left sidebar: APIs & Services → Library
   - Search for: "Google Sheets API"
   - Click on it
   - Click "Enable"

## Step 3: Create Service Account

1. **Go to Credentials**
   - Left sidebar: APIs & Services → Credentials
   - Click "Create Credentials" → "Service Account"

2. **Service Account Details**
   - Name: `htm-tracker-service`
   - ID: (auto-generated)
   - Description: `Service account for Hour to Midnight escape room tracker`
   - Click "Create and Continue"

3. **Grant Access (Optional)**
   - Skip this step (click "Continue")

4. **Grant Users Access (Optional)**
   - Skip this step (click "Done")

## Step 4: Create Service Account Key

1. **Find Your Service Account**
   - You should see your service account in the list
   - Click on it (the email address)

2. **Create Key**
   - Click "Keys" tab
   - Click "Add Key" → "Create New Key"
   - Choose "JSON"
   - Click "Create"
   - **A file will download - save this file!**

3. **Important: Save the Downloaded File**
   - File name will be something like: `project-name-123456-abc123def456.json`
   - You'll need to upload this to your Raspberry Pi

## Step 5: Get Service Account Email

1. **Copy the Email Address**
   - In the service account details, copy the email
   - Format: `htm-tracker-service@project-id-123456.iam.gserviceaccount.com`
   - You'll need this in the next step

## Step 6: Share Spreadsheet with Service Account

1. **Open Your Google Sheet**
   - https://docs.google.com/spreadsheets/d/1TCrSmXbHZnlltAJn1940vrMo_Z6z3PuLskcGPSQu7Yk/edit

2. **Click Share**
   - Click the green "Share" button (top right)

3. **Add Service Account**
   - Paste the service account email
   - Permission: "Editor"
   - **UNCHECK** "Notify people"
   - Click "Share"

## Step 7: Upload Credentials to Raspberry Pi

1. **Transfer the JSON file to Pi**
   ```bash
   # From Windows (replace with your actual filename)
   scp "project-name-123456-abc123def456.json" mytho@192.168.0.124:~/escape-room-tracker/google-credentials.json
   ```

2. **Verify on Pi**
   ```bash
   ssh mytho@192.168.0.124
   ls -la ~/escape-room-tracker/google-credentials.json
   ```

## Step 8: Install Google Sheets Package

On the Raspberry Pi:

```bash
cd ~/escape-room-tracker
npm install googleapis --break-system-packages
```

## Next Steps

Once you've completed these steps:
1. Let me know and I'll provide the updated server.js with Google Sheets integration
2. We'll configure game-to-tab mappings
3. Test the integration

---

## Troubleshooting

**Can't find Google Sheets API?**
- Make sure you're in the right project (check top left)
- Try searching for just "Sheets"

**Service account email not working?**
- Make sure you copied the full email
- Check for extra spaces
- Permission must be "Editor"

**File won't upload to Pi?**
- Make sure you're using the correct IP address
- File path should have quotes if it has spaces
- Try renaming the file to something simple: `google-creds.json`
