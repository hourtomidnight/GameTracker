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

For testing changes before pushing — the real app runs on the Pi, not here.

```bash
npm install
npm start
# http://localhost:3000
```

You'll need a `google-credentials.json` service account key in the project
root (not committed — see docs/GOOGLE-SHEETS-SETUP.md) and a
`data/password.txt` with your login password.

## Deploying to the Pi

The app runs on the Pi itself, which has its own `git clone` of this repo
and self-updates via `update.sh`. Push your commits, then:

```bash
npm run deploy
```

This SSHes into the Pi and runs `update.sh` there (`git pull` if behind,
`npm install` if needed, `pm2 restart htm-server`). See `CLAUDE.md` for the
one-time Pi setup steps and full deploy details.

On-site, the app is reachable at `http://hourtomidnight/` (or
`http://HTM-PI-Web.local/` as an mDNS fallback) — see `CLAUDE.md` for
network history. It runs continuously on the Pi under pm2 — nothing needs
to be launched, just open that URL.
