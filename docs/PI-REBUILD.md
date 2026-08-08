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

## Status

- [x] OS flashed, SSH key auth working, base packages installed (Task 1)
- [x] `htm-escape-tracker` redeployed, verified working end-to-end (Task 2)
- [ ] `RoomReset` deployed (Task 14)
- [ ] Relocated to business network + IP reservation set there
