# HTM Escape Room Tracker

Session tracker for Hour To Midnight escape rooms. Game masters log players,
hints, timing, and outcome for each session; data syncs to Google Sheets.

See `CLAUDE.md` for an architecture overview and `docs/` for setup guides:

- `docs/HTM-SETUP-INSTRUCTIONS.md` — general setup
- `docs/GOOGLE-SHEETS-SETUP.md` — service account + sheet layout
- `docs/UNIFIED-AUTH-SETUP.md` — session auth / nginx
- `docs/THEME-INSTRUCTIONS.md` — HTM branding/colors
- `docs/nginx-htm.conf` — reference nginx config

## Local development

```bash
npm install
npm start
# http://localhost:3000
```

You'll need a `google-credentials.json` service account key in the project
root (not committed — see docs/GOOGLE-SHEETS-SETUP.md) and a
`data/password.txt` with your login password.

## Deploying to the Pi

```bash
scp server.js index.html home.html login.html csv-downloads.html \
    mytho@192.168.0.124:/home/mytho/escape-room-tracker/
ssh mytho@192.168.0.124 'pm2 restart htm-server'
```
