# Pi Rebuild Instructions

The Raspberry Pi that hosted the tracker was wiped/recycled and rebuilt from
scratch on 2026-08-08. This documents the exact process so it's repeatable.

## Hardware / OS

- **Board**: Raspberry Pi 4B
- **OS installed**: Raspberry Pi OS **Desktop** (64-bit), Debian 13 "trixie"
  base — flashed via Raspberry Pi Imager. (Note: Lite was the original plan
  to save resources, but this Pi was flashed with the Desktop image; it
  works fine for this workload, just carries some unused desktop/printing
  packages like `cups`.)
- **Hostname**: `HTM-PI-Web`
- **User account**: `elshoff` (not `mytho` — Imager was configured with a
  different default username than originally planned; use this username in
  all SSH/deploy commands below)

## Network

This Pi was built and tested on the **home** network
(`192.168.0.0/24`, DHCP-assigned `192.168.0.127` during build/testing). It
will be **physically relocated to the business location** once setup is
complete, where a DHCP reservation will be set on the business router at
install time — no static IP was pinned on the home network since it's
temporary. Update this section with the final business-network IP once
installed there.

## SSH access

Key-based auth is set up for this machine's SSH key (`~/.ssh/id_ed25519`,
comment `pc-to-pi`) against the `elshoff` account:

```bash
ssh elshoff@<pi-ip>
```

If setting up a new dev machine's access, authorize its public key on the
Pi:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<public key>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Base package install (Task 1)

```bash
# Fix any interrupted dpkg state from first-boot updates (hit this on rebuild)
sudo dpkg --configure -a

# Full update first
sudo apt update && sudo apt full-upgrade -y && sudo apt autoremove -y

# Node.js 20.x via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# pm2 process manager
sudo npm install -g pm2
```

Verified versions on this build: Node v20.20.2, npm 10.8.2, pm2 7.0.3,
nginx 1.26.3 (active), git 2.47.3 (preinstalled with Raspberry Pi OS).

Note: `nginx -v` may report "command not found" over a non-interactive SSH
session depending on shell PATH setup — use `/usr/sbin/nginx -v` or
`sudo systemctl is-active nginx` to confirm instead.

## Task 2 completion notes (2026-08-08)

- Old Google Cloud project's service account was gone (project itself
  likely deleted along with old credentials). Recreated under project
  `hour-to-midnight-tracker` (Google account `hourtomidnight.com@gmail.com`).
- New service account: `htm-tracker-service@hour-to-midnight-tracker.iam.gserviceaccount.com`
- Enabled both **Google Sheets API** and **Google Drive API** on this
  project (Drive API needed for RoomReset's Task 14, enabled now to save a
  round-trip).
- Spreadsheet re-shared with the new service account email as Editor.
- New JSON key generated and installed at
  `~/escape-room-tracker/google-credentials.json` on the Pi (not committed).
- Login password set (not documented here for security — see whoever
  manages venue passwords).
- nginx config simplified from the old reference `docs/nginx-htm.conf`
  (which proxied to a separate home-page service on :8080 and Node-RED on
  :1880, neither of which exist on this rebuild) — new config at
  `/etc/nginx/sites-available/htm-tracker` proxies `/` straight to
  `localhost:3000` since server.js already serves `/`, `/login`,
  `/escape-room`, `/csv-downloads` directly. Old reference conf left
  in the repo for history but is no longer what's deployed; update
  `docs/nginx-htm.conf` on a future pass if Node-RED/home-page services get
  reintroduced.
- Verified end-to-end: login via `/api/auth/login` succeeds, authenticated
  page loads (200), `/api/sheets/tabs` correctly returns the real room tabs
  (`Pi-ADG`, `Pi-PLR`, `Pi-SON`, `Pi-COS`) from the live spreadsheet.

## Task 14 completion notes (2026-08-08)

- RoomReset deployed to `~/roomreset` on the Pi, run via pm2 as
  `roomreset-server` on port 3001, using an `ecosystem.config.js` (not
  dotenv) to set `PORT`, `ROOMRESET_SPREADSHEET_ID`, and
  `ROOMRESET_DRIVE_ROOT_FOLDER_ID` — persists correctly across `pm2`
  restarts without adding a new dependency.
- Reuses the same `google-credentials.json` as the tracker (copied, not
  symlinked — same service account, both apps read it independently).
- Drive folder for step photos created in the
  `hourtomidnight.com@gmail.com` Drive, shared with the service account as
  Editor: `1MLnHOfAWQTyeNGR24j_0suDaiF7sTBr4`.
- **Hosting decision**: RoomReset is served directly on port 3001, NOT
  path-prefixed behind nginx (e.g. `/roomreset/`). Its frontend uses
  root-relative paths throughout (`/api/...`, `/manifest.json`, PWA
  `start_url: "/"`) by design, since it's meant to be its own standalone
  origin — path-prefixing it under the tracker's origin would collide with
  the tracker's own `/api/*` routes at that same root. Direct port avoids
  this entirely with zero extra config.
- Verified via `pm2 status` (online) and direct HTTP checks
  (`http://192.168.0.127:3001/` → 200). Live Sheets/Drive behavior
  (session start/resume, step writes, image uploads) still needs a real
  end-to-end test from an operator/tablet — nothing in the app had
  exercised the real APIs before this deploy.

## Node-RED (added post-deploy, 2026-08-08)

- Installed via the official installer
  (`update-nodejs-and-nodered`, `--skip-pi` flag to avoid its Pi-model
  check). Installed Node-RED core 5.0.4.
- **Node.js version conflict**: Node-RED 5.x requires Node.js v22.9+; the
  Pi was on v20.20.2 (needed by the tracker/RoomReset at the time). Chose
  to upgrade system Node.js to v22.23.2 (via NodeSource `setup_22.x`)
  rather than downgrade Node-RED, since v22 is backward-compatible with
  both Express apps — verified both `htm-server` and `roomreset-server`
  still respond correctly after the upgrade and a `pm2 restart all`.
- Node-RED's own settings (`~/.node-red/settings.js`) needed
  `httpRoot: '/nodered'` set so its internally-generated asset URLs resolve
  correctly when reverse-proxied under a subpath (same class of issue
  RoomReset avoided by using its own port instead — Node-RED has a native
  config knob for this, so a subpath was fine here).
- nginx: added `location /nodered { proxy_pass http://localhost:1880; }` to
  `/etc/nginx/sites-available/htm-tracker`, alongside the existing `/`
  location for the tracker.
- Enabled at boot via `systemctl enable nodered`.
- Verified: `http://192.168.0.127/nodered/` returns 200 and loads the
  Node-RED editor. Per Node-RED's own install warning, it currently has
  **no admin authentication configured** — fine on a private LAN behind the
  venue's own network, but should not be exposed to the open internet as-is
  (see `~/.node-red/settings.js`'s `adminAuth` section if that's ever
  needed).

## home.html — links + RoomReset entry (2026-08-08)

- Extended the existing "Manage Links" feature (already built) with
  optional description and icon/emoji fields per link.
- Added RoomReset as a fourth built-in core link, pointing to
  `http://192.168.0.127:3001/`. **This URL will need updating once the Pi
  moves to the business network** — search `home.html` for `core-4` and
  the tracker/CLAUDE.md docs for other IP references at that time.

## Status

- [x] OS flashed, SSH key auth working, base packages installed (Task 1)
- [x] `htm-escape-tracker` redeployed, verified working end-to-end (Task 2)
- [x] `RoomReset` deployed and running, code-level verification complete;
      live Sheets/Drive end-to-end test still pending (Task 14)
- [x] Node-RED installed and running (not in original plan, added per
      request)
- [ ] Relocated to business network + IP reservation set there — **when
      this happens, update RoomReset's URL in `home.html` (currently
      hardcoded to `192.168.0.127:3001`)**
