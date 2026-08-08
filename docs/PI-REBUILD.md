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

## Status

- [x] OS flashed, SSH key auth working, base packages installed (Task 1)
- [ ] `htm-escape-tracker` redeployed (Task 2)
- [ ] `RoomReset` deployed (Task 14)
- [ ] Relocated to business network + IP reservation set there
