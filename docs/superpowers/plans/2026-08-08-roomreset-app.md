# RoomReset App + Pi Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the wiped Raspberry Pi server, redeploy the existing `htm-escape-tracker`, and build+deploy a new standalone PWA (`RoomReset`, in its own repo `hourtomidnight/RoomReset`) that walks operators through escape-room resets with live progress written to Google Sheets.

**Architecture:** Two independent Node/Express apps on one Pi, each its own PM2 process and nginx location: the existing `htm-escape-tracker` (port 3000, unchanged) and the new `RoomReset` app (port 3001). RoomReset has its own session auth, its own PWA manifest/service worker, and reuses the same Google service-account credentials + spreadsheet ID as the tracker to read operators, read/write a per-room reset-log tab, and upload step photos to Drive.

**Tech Stack:** Node.js + Express, `express-session`, `googleapis` (Sheets v4 + Drive v3), `multer` (photo upload handling), vanilla PWA (manifest + minimal service worker), single-file React via CDN + in-browser Babel (matching the tracker's existing no-build-step pattern) — no bundler, no automated test framework (matches existing repo convention; verification is manual per task).

## Global Constraints

- No build step for frontend code — plain `<script type="text/babel">` React loaded via CDN, same as `htm-escape-tracker/index.html`.
- No automated test framework in this project family — every task ends with a **manual verification** step (curl command and/or browser check), not an automated test suite.
- Google service-account credentials file is never committed to either repo — install directly on the Pi, `.gitignore`'d.
- Session auth: `express-session` with a 24hr cookie, password compared against a `data/password.txt` file — same mechanism as the tracker, but RoomReset has its own separate password file and cookie (it is a distinct app/login).
- All new Sheets/Drive access goes through the same spreadsheet ID and service account the tracker already uses (`SPREADSHEET_ID` — read from `docs/GOOGLE-SHEETS-SETUP.md` / the tracker's existing `.env`/config on the old Pi backup if available, otherwise re-derive per Task 1).

---

## Part A — Pi Rebuild

### Task 1: Fresh Raspberry Pi OS + base packages

**Files:**
- Create: `htm-escape-tracker/docs/PI-REBUILD.md` (new setup doc, this task writes it as it's executed)

**Interfaces:**
- Produces: a running Pi reachable at its static IP with `node`, `npm`, `git`, `pm2`, and `nginx` installed, ready for both apps to be deployed onto it.

- [ ] **Step 1: Flash Raspberry Pi OS**

Using Raspberry Pi Imager on the dev machine, flash **Raspberry Pi OS Lite (64-bit)** to the SD card. In the Imager's advanced options (gear icon / Ctrl+Shift+X) set:
- hostname: `htm-pi`
- enable SSH, set username `mytho` and a password
- configure wifi (or plan to use Ethernet) and locale/timezone

Boot the Pi, then from the dev machine:

```bash
ssh mytho@<pi-ip-shown-by-router-or-imager>
```

- [ ] **Step 2: Set a static IP**

On the Pi, edit `/etc/dhcpcd.conf` (or use your router's DHCP reservation — reservation is simpler and preferred) to pin the Pi's IP. Confirm with the user which of the two prior static IPs (`192.168.1.151` business / `192.168.0.124` home) this Pi should hold on its current network, and set a DHCP reservation for that IP against the Pi's MAC address (`ip link show eth0` or `wlan0` to get the MAC).

- [ ] **Step 3: Install Node.js, git, nginx, pm2**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
node -v   # confirm v20.x
npm -v
pm2 -v
```

- [ ] **Step 4: Verify and document**

```bash
sudo systemctl status nginx --no-pager
```

Expected: `active (running)`.

Write `htm-escape-tracker/docs/PI-REBUILD.md` documenting: the static IP chosen, the OS image/version flashed, and the exact commands above, so this is repeatable if the Pi is ever wiped again.

- [ ] **Step 5: Commit the doc**

```bash
cd "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker"
git add docs/PI-REBUILD.md
git commit -m "docs: add Pi rebuild instructions"
```

---

### Task 2: Redeploy htm-escape-tracker onto the rebuilt Pi

**Files:**
- Modify: `htm-escape-tracker/docs/PI-REBUILD.md` (append tracker redeploy steps)

**Interfaces:**
- Consumes: the Pi from Task 1 (Node/PM2/nginx installed, static IP set).
- Produces: `htm-server` PM2 process serving the existing tracker on port 3000, nginx proxying port 80 → 3000, matching the app's existing `CLAUDE.md` deployment section.

- [ ] **Step 1: Create the app directory and copy files**

From the dev machine:

```bash
ssh mytho@<pi-ip> 'mkdir -p ~/escape-room-tracker/data ~/escape-room-tracker/csv_files'
scp "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker\server.js" \
    "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker\index.html" \
    "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker\home.html" \
    "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker\login.html" \
    "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker\csv-downloads.html" \
    "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker\package.json" \
    mytho@<pi-ip>:/home/mytho/escape-room-tracker/
```

- [ ] **Step 2: Install dependencies on the Pi**

```bash
ssh mytho@<pi-ip>
cd ~/escape-room-tracker
npm install
```

- [ ] **Step 3: Recreate `data/password.txt`**

```bash
echo -n "<the tracker's login password>" > ~/escape-room-tracker/data/password.txt
```

- [ ] **Step 4: Reinstall Google credentials**

Per `docs/GOOGLE-SHEETS-SETUP.md`: confirm in Google Cloud Console whether the service account `htm-tracker-service@...` still exists (it lives in Google Cloud, independent of the Pi). If it still exists, generate a **new** JSON key for it (Keys → Add Key → Create New Key → JSON) since the old key file was on the wiped Pi and should be treated as lost; if the service account itself is gone, recreate it per that doc and re-share the spreadsheet with its new email.

```bash
scp "<downloaded-key-file>.json" mytho@<pi-ip>:~/escape-room-tracker/google-credentials.json
```

- [ ] **Step 5: Start with PM2**

```bash
ssh mytho@<pi-ip>
cd ~/escape-room-tracker
pm2 start server.js --name htm-server
pm2 save
pm2 startup   # follow the printed command to enable boot-start, run it with sudo
```

- [ ] **Step 6: Configure nginx**

```bash
sudo cp ~/escape-room-tracker/docs/nginx-htm.conf /etc/nginx/sites-available/htm-tracker
sudo ln -s /etc/nginx/sites-available/htm-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

- [ ] **Step 7: Manual verification**

From a browser on the same network: visit `http://<pi-ip>/`, confirm the login page loads, log in, confirm the tracker's home page and a room's Pre-Game screen load without console errors.

```bash
ssh mytho@<pi-ip> 'pm2 logs htm-server --lines 30 --nostream'
```

Expected: no error stack traces, "Server running on port 3000" (or equivalent existing startup log line).

- [ ] **Step 8: Commit doc updates**

```bash
cd "C:\Users\mytho\Documents\HTM\GameTracker\htm-escape-tracker"
git add docs/PI-REBUILD.md
git commit -m "docs: record tracker redeploy steps on rebuilt Pi"
```

---

## Part B — RoomReset App (local development)

### Task 3: Scaffold the RoomReset repo

**Files:**
- Create: `RoomReset/package.json`
- Create: `RoomReset/server.js`
- Create: `RoomReset/data/.gitkeep`
- Create: `RoomReset/data/reset-rooms/.gitkeep`
- Create: `RoomReset/.gitignore`

**Interfaces:**
- Produces: an Express app skeleton listening on port 3001, with session-based auth (`isAuthenticated` middleware) and a `/login` page, matching the tracker's existing auth pattern but as an independent codebase.

- [ ] **Step 1: Clone the empty repo and scaffold**

```bash
cd "C:\Users\mytho\Documents\HTM\GameTracker"
git clone https://github.com/hourtomidnight/RoomReset.git
cd RoomReset
npm init -y
npm install express express-session googleapis multer
mkdir -p data/reset-rooms
touch data/.gitkeep data/reset-rooms/.gitkeep
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
data/password.txt
google-credentials.json
data/reset-rooms/*.json
!data/reset-rooms/.gitkeep
```

- [ ] **Step 3: Write `server.js` auth skeleton**

```javascript
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(session({
  secret: 'roomreset-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function isAuthenticated(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const pwPath = path.join(__dirname, 'data', 'password.txt');
  const expected = fs.existsSync(pwPath) ? fs.readFileSync(pwPath, 'utf8').trim() : '';
  if (password && password === expected) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`RoomReset server running on port ${PORT}`));

module.exports = { app, isAuthenticated };
```

- [ ] **Step 4: Manual verification**

```bash
echo -n "test123" > data/password.txt
node server.js &
curl -s http://localhost:3001/api/health
curl -s -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"password":"wrong"}'
curl -s -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"password":"test123"}'
kill %1
```

Expected: health returns `{"ok":true}`; wrong password returns 401; correct password returns `{"ok":true}`.

- [ ] **Step 5: Commit**

```bash
git add package.json server.js .gitignore data/.gitkeep data/reset-rooms/.gitkeep
git commit -m "feat: scaffold RoomReset Express app with session auth"
git push -u origin master
```

---

### Task 4: Google Sheets client + operators endpoint

**Files:**
- Modify: `RoomReset/server.js`
- Create: `RoomReset/lib/sheets.js`

**Interfaces:**
- Consumes: `isAuthenticated` from Task 3.
- Produces: `getSheetsClient()` returning an authenticated `googleapis` Sheets client; `GET /api/operators` returning `{ operators: string[] }`.

- [ ] **Step 1: Write `lib/sheets.js`**

```javascript
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SPREADSHEET_ID = process.env.ROOMRESET_SPREADSHEET_ID;
const CREDS_PATH = path.join(__dirname, '..', 'google-credentials.json');

let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  if (!fs.existsSync(CREDS_PATH)) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function getColumnValues(tab, column, startRow) {
  const sheets = getSheetsClient();
  if (!sheets || !SPREADSHEET_ID) return [];
  const range = `${tab}!${column}${startRow}:${column}`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const values = response.data.values || [];
  return values.map(row => row[0]).filter(v => v && v.trim());
}

module.exports = { getSheetsClient, getColumnValues, SPREADSHEET_ID };
```

- [ ] **Step 2: Add the operators endpoint to `server.js`**

```javascript
const { getColumnValues } = require('./lib/sheets');

app.get('/api/operators', isAuthenticated, async (req, res) => {
  try {
    const operators = await getColumnValues('Dropdown', 'A', 2);
    res.json({ operators });
  } catch (error) {
    console.error('Error fetching operators:', error.message);
    res.status(500).json({ error: 'Failed to fetch operators' });
  }
});
```

Note: confirm the actual column letter holding operator names in the spreadsheet's "Dropdown" tab before deploying — `A` here is a placeholder to be corrected against the real sheet layout in Task 12 (deployment) if it differs.

- [ ] **Step 3: Manual verification**

Install the real `google-credentials.json` locally (copy from the Pi setup or a local dev copy) and set `ROOMRESET_SPREADSHEET_ID`:

```bash
export ROOMRESET_SPREADSHEET_ID="1TCrSmXbHZnlltAJn1940vrMo_Z6z3PuLskcGPSQu7Yk"
node server.js &
curl -s -c /tmp/rr-cookie -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"password":"test123"}'
curl -s -b /tmp/rr-cookie http://localhost:3001/api/operators
kill %1
```

Expected: `{"operators":[...]}` with real names from the sheet's Dropdown tab.

- [ ] **Step 4: Commit**

```bash
git add server.js lib/sheets.js
git commit -m "feat: add Sheets client and operators endpoint"
git push
```

---

### Task 5: Room data model (CRUD)

**Files:**
- Create: `RoomReset/lib/rooms.js`
- Modify: `RoomReset/server.js`

**Interfaces:**
- Produces: `listRooms()`, `getRoom(slug)`, `saveRoom(slug, roomData)` in `lib/rooms.js`; routes `GET /api/rooms`, `GET /api/rooms/:slug`, `POST /api/rooms/:slug`.
- Room shape (matches spec): `{ name, slug, sheetTab, steps: [{ id, title, instructions, images: string[] }] }`.

- [ ] **Step 1: Write `lib/rooms.js`**

```javascript
const fs = require('fs');
const path = require('path');

const ROOMS_DIR = path.join(__dirname, '..', 'data', 'reset-rooms');

function roomPath(slug) {
  return path.join(ROOMS_DIR, `${slug}.json`);
}

function listRooms() {
  if (!fs.existsSync(ROOMS_DIR)) return [];
  return fs.readdirSync(ROOMS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(ROOMS_DIR, f), 'utf8'));
      return { name: data.name, slug: data.slug };
    });
}

function getRoom(slug) {
  const p = roomPath(slug);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveRoom(slug, roomData) {
  if (!fs.existsSync(ROOMS_DIR)) fs.mkdirSync(ROOMS_DIR, { recursive: true });
  const data = { ...roomData, slug };
  fs.writeFileSync(roomPath(slug), JSON.stringify(data, null, 2));
  return data;
}

module.exports = { listRooms, getRoom, saveRoom };
```

- [ ] **Step 2: Add routes to `server.js`**

```javascript
const { listRooms, getRoom, saveRoom } = require('./lib/rooms');

app.get('/api/rooms', isAuthenticated, (req, res) => {
  res.json({ rooms: listRooms() });
});

app.get('/api/rooms/:slug', isAuthenticated, (req, res) => {
  const room = getRoom(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ room });
});

app.post('/api/rooms/:slug', isAuthenticated, (req, res) => {
  const { name, sheetTab, steps } = req.body;
  if (!name || !sheetTab || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'name, sheetTab, and steps[] are required' });
  }
  const saved = saveRoom(req.params.slug, { name, sheetTab, steps });
  res.json({ room: saved });
});
```

- [ ] **Step 3: Manual verification**

```bash
node server.js &
curl -s -c /tmp/rr-cookie -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"password":"test123"}'
curl -s -b /tmp/rr-cookie -X POST http://localhost:3001/api/rooms/pirates-cove \
  -H "Content-Type: application/json" \
  -d '{"name":"Pirates Cove","sheetTab":"reset-pirates-cove","steps":[{"id":"step-1","title":"Reset Lockbox","instructions":"Spin to 0-0-0","images":[]}]}'
curl -s -b /tmp/rr-cookie http://localhost:3001/api/rooms
curl -s -b /tmp/rr-cookie http://localhost:3001/api/rooms/pirates-cove
kill %1
```

Expected: POST echoes the saved room; list shows `[{"name":"Pirates Cove","slug":"pirates-cove"}]`; GET returns the full room JSON including the step.

- [ ] **Step 4: Commit**

```bash
git add server.js lib/rooms.js
git commit -m "feat: add room CRUD endpoints"
git push
```

---

### Task 6: Google Drive client + step image upload

**Files:**
- Create: `RoomReset/lib/drive.js`
- Modify: `RoomReset/server.js`

**Interfaces:**
- Consumes: `getRoom`/`saveRoom` from Task 5.
- Produces: `uploadImageToDrive(roomSlug, fileBuffer, mimeType)` returning `{ driveFileId, viewUrl }`; route `POST /api/rooms/:slug/image` (multipart, field name `image`) returning the same shape.

- [ ] **Step 1: Write `lib/drive.js`**

```javascript
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const CREDS_PATH = path.join(__dirname, '..', 'google-credentials.json');
const ROOT_FOLDER_ID = process.env.ROOMRESET_DRIVE_ROOT_FOLDER_ID;

let driveClient = null;
const roomFolderCache = {};

function getDriveClient() {
  if (driveClient) return driveClient;
  if (!fs.existsSync(CREDS_PATH)) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function getOrCreateRoomFolder(drive, roomSlug) {
  if (roomFolderCache[roomSlug]) return roomFolderCache[roomSlug];
  const query = `'${ROOT_FOLDER_ID}' in parents and name='${roomSlug}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const existing = await drive.files.list({ q: query, fields: 'files(id, name)' });
  if (existing.data.files.length > 0) {
    roomFolderCache[roomSlug] = existing.data.files[0].id;
    return roomFolderCache[roomSlug];
  }
  const created = await drive.files.create({
    requestBody: { name: roomSlug, mimeType: 'application/vnd.google-apps.folder', parents: [ROOT_FOLDER_ID] },
    fields: 'id'
  });
  roomFolderCache[roomSlug] = created.data.id;
  return created.data.id;
}

async function uploadImageToDrive(roomSlug, fileBuffer, mimeType) {
  const drive = getDriveClient();
  if (!drive || !ROOT_FOLDER_ID) throw new Error('Drive client not configured');
  const folderId = await getOrCreateRoomFolder(drive, roomSlug);
  const stream = Readable.from(fileBuffer);
  const created = await drive.files.create({
    requestBody: { name: `${Date.now()}.jpg`, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: 'id'
  });
  const driveFileId = created.data.id;
  await drive.permissions.create({
    fileId: driveFileId,
    requestBody: { role: 'reader', type: 'anyone' }
  });
  return { driveFileId, viewUrl: `https://drive.google.com/uc?id=${driveFileId}` };
}

module.exports = { uploadImageToDrive };
```

- [ ] **Step 2: Add the upload route to `server.js`**

```javascript
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { uploadImageToDrive } = require('./lib/drive');

app.post('/api/rooms/:slug/image', isAuthenticated, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const result = await uploadImageToDrive(req.params.slug, req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (error) {
    console.error('Error uploading image to Drive:', error.message);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});
```

- [ ] **Step 3: Manual verification**

Requires `ROOMRESET_DRIVE_ROOT_FOLDER_ID` set to a real Drive folder ID shared with the service account as Editor:

```bash
export ROOMRESET_DRIVE_ROOT_FOLDER_ID="<folder-id>"
node server.js &
curl -s -c /tmp/rr-cookie -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"password":"test123"}'
curl -s -b /tmp/rr-cookie -X POST http://localhost:3001/api/rooms/pirates-cove/image -F "image=@./test-photo.jpg"
kill %1
```

Expected: `{"driveFileId":"...","viewUrl":"https://drive.google.com/uc?id=..."}`; opening `viewUrl` in a browser shows the uploaded photo; the Drive folder shows a `pirates-cove` subfolder under the configured root.

- [ ] **Step 4: Commit**

```bash
git add server.js lib/drive.js package.json package-lock.json
git commit -m "feat: add Drive client and step image upload endpoint"
git push
```

---

### Task 7: Sheet tab header sync

**Files:**
- Modify: `RoomReset/lib/sheets.js`
- Modify: `RoomReset/server.js`

**Interfaces:**
- Consumes: `getSheetsClient` from Task 4, `getRoom`/`saveRoom` from Task 5.
- Produces: `syncRoomSheetHeaders(sheetTab, steps)` in `lib/sheets.js`, called automatically inside `POST /api/rooms/:slug` after a room is saved.

- [ ] **Step 1: Add `syncRoomSheetHeaders` to `lib/sheets.js`**

```javascript
async function ensureTabExists(tab) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === tab);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
    });
  }
}

async function syncRoomSheetHeaders(tab, steps) {
  const sheets = getSheetsClient();
  if (!sheets || !SPREADSHEET_ID) return;
  await ensureTabExists(tab);
  const fixedHeaders = ['Operator', 'Helpers', 'Date', 'Start Time', 'End Time'];
  const headers = [...fixedHeaders, ...steps.map(s => s.title)];
  const endCol = String.fromCharCode(65 + headers.length - 1); // works up to column Z
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A1:${endCol}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
}

module.exports = { getSheetsClient, getColumnValues, syncRoomSheetHeaders, SPREADSHEET_ID };
```

- [ ] **Step 2: Call it from the room save route in `server.js`**

```javascript
const { syncRoomSheetHeaders } = require('./lib/sheets');

app.post('/api/rooms/:slug', isAuthenticated, async (req, res) => {
  const { name, sheetTab, steps } = req.body;
  if (!name || !sheetTab || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'name, sheetTab, and steps[] are required' });
  }
  const saved = saveRoom(req.params.slug, { name, sheetTab, steps });
  try {
    await syncRoomSheetHeaders(sheetTab, steps);
  } catch (error) {
    console.error('Error syncing sheet headers:', error.message);
  }
  res.json({ room: saved });
});
```

- [ ] **Step 3: Manual verification**

```bash
node server.js &
curl -s -c /tmp/rr-cookie -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"password":"test123"}'
curl -s -b /tmp/rr-cookie -X POST http://localhost:3001/api/rooms/pirates-cove \
  -H "Content-Type: application/json" \
  -d '{"name":"Pirates Cove","sheetTab":"reset-pirates-cove","steps":[{"id":"step-1","title":"Reset Lockbox","instructions":"x","images":[]},{"id":"step-2","title":"Reset Blacklight","instructions":"y","images":[]}]}'
kill %1
```

Expected: opening the spreadsheet shows a `reset-pirates-cove` tab with row 1 = `Operator | Helpers | Date | Start Time | End Time | Reset Lockbox | Reset Blacklight`.

- [ ] **Step 4: Commit**

```bash
git add lib/sheets.js server.js
git commit -m "feat: auto-sync reset-log sheet tab headers from room steps"
git push
```

---

### Task 8: Session start/resume + per-step write + finish

**Files:**
- Create: `RoomReset/lib/sessions.js`
- Modify: `RoomReset/server.js`

**Interfaces:**
- Consumes: `getSheetsClient`, `SPREADSHEET_ID` from `lib/sheets.js`; `getRoom` from `lib/rooms.js`.
- Produces:
  - `POST /api/rooms/:slug/sessions/start` — body `{ operator, helpers: string[] }` → `{ rowIndex, resumable, completedSteps: string[] }`
  - `POST /api/rooms/:slug/sessions/:rowIndex/step` — body `{ stepTitle }` → `{ ok: true }`
  - `POST /api/rooms/:slug/sessions/:rowIndex/finish` — → `{ ok: true }`

- [ ] **Step 1: Write `lib/sessions.js`**

```javascript
const { getSheetsClient, SPREADSHEET_ID } = require('./sheets');

const FIXED_COLS = ['Operator', 'Helpers', 'Date', 'Start Time', 'End Time'];

function colLetter(index) {
  return String.fromCharCode(65 + index);
}

async function findOpenSession(tab) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${tab}!A:Z` });
  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const startCol = headers.indexOf('Start Time');
  const endCol = headers.indexOf('End Time');
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[startCol] && !row[endCol]) {
      const completedSteps = headers.slice(5).filter((title, idx) => row[5 + idx]);
      return { rowIndex: i + 1, operator: row[0], startTime: row[3], completedSteps };
    }
  }
  return null;
}

async function startSession(tab, operator, helpers) {
  const sheets = getSheetsClient();
  const now = new Date();
  const row = [operator, helpers.join(', '), now.toLocaleDateString(), now.toLocaleTimeString(), ''];
  const append = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A:E`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  const updatedRange = append.data.updates.updatedRange; // e.g. "tab!A5:E5"
  const rowIndex = parseInt(updatedRange.match(/(\d+):/)[1], 10);
  return rowIndex;
}

async function writeStepCell(tab, rowIndex, stepTitle) {
  const sheets = getSheetsClient();
  const headerResp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${tab}!A1:Z1` });
  const headers = headerResp.data.values[0];
  const colIndex = headers.indexOf(stepTitle);
  if (colIndex === -1) throw new Error(`Unknown step title: ${stepTitle}`);
  const now = new Date().toLocaleTimeString();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!${colLetter(colIndex)}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now]] }
  });
}

async function finishSession(tab, rowIndex) {
  const sheets = getSheetsClient();
  const now = new Date().toLocaleTimeString();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!E${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now]] }
  });
}

module.exports = { findOpenSession, startSession, writeStepCell, finishSession };
```

- [ ] **Step 2: Add routes to `server.js`**

```javascript
const { getRoom } = require('./lib/rooms');
const { findOpenSession, startSession, writeStepCell, finishSession } = require('./lib/sessions');

app.post('/api/rooms/:slug/sessions/start', isAuthenticated, async (req, res) => {
  const room = getRoom(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { operator, helpers = [] } = req.body;
  try {
    const open = await findOpenSession(room.sheetTab);
    if (open) {
      return res.json({ rowIndex: open.rowIndex, resumable: true, operator: open.operator, startTime: open.startTime, completedSteps: open.completedSteps });
    }
    const rowIndex = await startSession(room.sheetTab, operator, helpers);
    res.json({ rowIndex, resumable: false, completedSteps: [] });
  } catch (error) {
    console.error('Error starting session:', error.message);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

app.post('/api/rooms/:slug/sessions/:rowIndex/step', isAuthenticated, async (req, res) => {
  const room = getRoom(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { stepTitle } = req.body;
  try {
    await writeStepCell(room.sheetTab, parseInt(req.params.rowIndex, 10), stepTitle);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error writing step:', error.message);
    res.status(500).json({ error: 'Failed to write step' });
  }
});

app.post('/api/rooms/:slug/sessions/:rowIndex/finish', isAuthenticated, async (req, res) => {
  const room = getRoom(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  try {
    await finishSession(room.sheetTab, parseInt(req.params.rowIndex, 10));
    res.json({ ok: true });
  } catch (error) {
    console.error('Error finishing session:', error.message);
    res.status(500).json({ error: 'Failed to finish session' });
  }
});
```

- [ ] **Step 3: Manual verification (full session lifecycle)**

```bash
node server.js &
curl -s -c /tmp/rr-cookie -X POST http://localhost:3001/api/login -H "Content-Type: application/json" -d '{"password":"test123"}'

# Start
curl -s -b /tmp/rr-cookie -X POST http://localhost:3001/api/rooms/pirates-cove/sessions/start \
  -H "Content-Type: application/json" -d '{"operator":"Jordan","helpers":["Sam"]}'
# note the returned rowIndex, e.g. 2

# Confirm resume detection: calling start again should return resumable:true with the same rowIndex
curl -s -b /tmp/rr-cookie -X POST http://localhost:3001/api/rooms/pirates-cove/sessions/start \
  -H "Content-Type: application/json" -d '{"operator":"Jordan","helpers":[]}'

# Write a step
curl -s -b /tmp/rr-cookie -X POST http://localhost:3001/api/rooms/pirates-cove/sessions/2/step \
  -H "Content-Type: application/json" -d '{"stepTitle":"Reset Lockbox"}'

# Finish
curl -s -b /tmp/rr-cookie -X POST http://localhost:3001/api/rooms/pirates-cove/sessions/2/finish
kill %1
```

Expected: first start returns `resumable:false`; second returns `resumable:true` with `completedSteps:[]`; the sheet row shows Operator "Jordan", Helpers "Sam", a filled Start Time, then a filled "Reset Lockbox" cell, then a filled End Time.

- [ ] **Step 4: Commit**

```bash
git add server.js lib/sessions.js
git commit -m "feat: add progressive session start/resume/step/finish endpoints"
git push
```

---

### Task 9: Frontend shell — Home screen (`reset.html`)

**Files:**
- Create: `RoomReset/public/reset.html`
- Modify: `RoomReset/server.js` (static file serving + page route)

**Interfaces:**
- Consumes: `GET /api/rooms`, `GET /api/operators`, `POST /api/rooms/:slug/sessions/start` from prior tasks.
- Produces: a working login → room/operator/helper picker → mode choice screen, the entry point the later Walkthrough/Quick List tasks attach to.

- [ ] **Step 1: Serve static files and the page route in `server.js`**

```javascript
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset.html'));
});
```

- [ ] **Step 2: Write `public/reset.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <title>RoomReset</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { font-family: sans-serif; margin: 0; background: #111; color: #eee; }
    .screen { padding: 24px; max-width: 480px; margin: 0 auto; }
    select, input, button { width: 100%; padding: 12px; margin: 8px 0; font-size: 18px; box-sizing: border-box; }
    button { background: #d63; color: white; border: none; border-radius: 6px; }
    button:disabled { background: #555; }
    .helper-list label { display: block; padding: 6px 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;

    function LoginScreen({ onLoggedIn }) {
      const [password, setPassword] = useState('');
      const [error, setError] = useState('');
      const submit = async () => {
        const resp = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (resp.ok) onLoggedIn(); else setError('Invalid password');
      };
      return (
        <div className="screen">
          <h1>RoomReset</h1>
          <input type="password" placeholder="Password" value={password}
                 onChange={e => setPassword(e.target.value)} />
          <button onClick={submit}>Log In</button>
          {error && <p style={{ color: 'salmon' }}>{error}</p>}
        </div>
      );
    }

    function HomeScreen() {
      const [rooms, setRooms] = useState([]);
      const [operators, setOperators] = useState([]);
      const [roomSlug, setRoomSlug] = useState('');
      const [operator, setOperator] = useState('');
      const [helpers, setHelpers] = useState([]);
      const [mode, setMode] = useState('walkthrough');

      useEffect(() => {
        fetch('/api/rooms').then(r => r.json()).then(d => setRooms(d.rooms || []));
        fetch('/api/operators').then(r => r.json()).then(d => setOperators(d.operators || []));
      }, []);

      const toggleHelper = (name) => {
        setHelpers(h => h.includes(name) ? h.filter(x => x !== name) : [...h, name]);
      };

      const start = async () => {
        const resp = await fetch(`/api/rooms/${roomSlug}/sessions/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operator, helpers })
        });
        const data = await resp.json();
        if (data.resumable) {
          const proceed = confirm(
            `Resume session by ${data.operator} started at ${data.startTime}? ` +
            `(${data.completedSteps.length} steps done)`
          );
          if (!proceed) return; // Task 10/11 will handle "start fresh" branch
        }
        const url = `${mode}.html?room=${roomSlug}&row=${data.rowIndex}`;
        window.location.href = url;
      };

      return (
        <div className="screen">
          <h1>RoomReset</h1>
          <select value={roomSlug} onChange={e => setRoomSlug(e.target.value)}>
            <option value="">Select Room</option>
            {rooms.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
          <select value={operator} onChange={e => setOperator(e.target.value)}>
            <option value="">Select Operator</option>
            {operators.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <div className="helper-list">
            <p>Helper(s):</p>
            {operators.map(o => (
              <label key={o}>
                <input type="checkbox" checked={helpers.includes(o)} onChange={() => toggleHelper(o)} /> {o}
              </label>
            ))}
          </div>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="walkthrough">Walkthrough</option>
            <option value="quicklist">Quick List</option>
          </select>
          <button disabled={!roomSlug || !operator} onClick={start}>Start</button>
        </div>
      );
    }

    function App() {
      const [loggedIn, setLoggedIn] = useState(false);
      return loggedIn ? <HomeScreen /> : <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>
```

- [ ] **Step 3: Manual verification**

```bash
node server.js &
```

Open `http://localhost:3001/` in a browser: confirm the login screen appears, log in with the test password, confirm Room and Operator dropdowns populate from the earlier `curl`-verified data, confirm the Helper checkboxes list operators, and confirm clicking Start with a room+operator selected navigates to `walkthrough.html?room=...&row=...` (404 is expected until Task 10 exists — confirm the URL and query params are correct in the address bar).

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add server.js public/reset.html
git commit -m "feat: add RoomReset home screen (login, room/operator/helper picker)"
git push
```

---

### Task 10: Walkthrough screen

**Files:**
- Create: `RoomReset/public/walkthrough.html`

**Interfaces:**
- Consumes: `GET /api/rooms/:slug`, `POST /api/rooms/:slug/sessions/:rowIndex/step`, `POST /api/rooms/:slug/sessions/:rowIndex/finish` from prior tasks; query params `room` and `row` from Task 9's navigation.
- Produces: a working step-by-step UI that marks the `resumable` `completedSteps` (passed via `sessionStorage`, set in this task) as already-done on load.

- [ ] **Step 1: Pass resume state from `reset.html` via `sessionStorage`**

In `public/reset.html`'s `start()` function, before the `window.location.href = url;` line, add:

```javascript
sessionStorage.setItem('roomreset_completed', JSON.stringify(data.completedSteps || []));
```

- [ ] **Step 2: Write `public/walkthrough.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <title>RoomReset — Walkthrough</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { font-family: sans-serif; margin: 0; background: #111; color: #eee; }
    .screen { padding: 24px; max-width: 480px; margin: 0 auto; }
    img { width: 100%; border-radius: 8px; margin: 8px 0; }
    button { padding: 14px; font-size: 18px; border: none; border-radius: 6px; margin: 6px 0; width: 100%; }
    .reset-btn { background: #2a4; color: white; }
    .back-btn { background: #444; color: white; }
    .progress { opacity: 0.7; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    const params = new URLSearchParams(window.location.search);
    const roomSlug = params.get('room');
    const rowIndex = params.get('row');

    function Walkthrough() {
      const [room, setRoom] = useState(null);
      const [stepIdx, setStepIdx] = useState(0);
      const [done, setDone] = useState(new Set());

      useEffect(() => {
        fetch(`/api/rooms/${roomSlug}`).then(r => r.json()).then(d => {
          setRoom(d.room);
          const completed = JSON.parse(sessionStorage.getItem('roomreset_completed') || '[]');
          setDone(new Set(completed));
          const firstUndone = d.room.steps.findIndex(s => !completed.includes(s.title));
          setStepIdx(firstUndone === -1 ? 0 : firstUndone);
        });
      }, []);

      if (!room) return <div className="screen">Loading...</div>;
      const step = room.steps[stepIdx];
      const isLast = stepIdx === room.steps.length - 1;

      const confirmReset = async () => {
        await fetch(`/api/rooms/${roomSlug}/sessions/${rowIndex}/step`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepTitle: step.title })
        });
        setDone(d => new Set([...d, step.title]));
        if (isLast) {
          await fetch(`/api/rooms/${roomSlug}/sessions/${rowIndex}/finish`, { method: 'POST' });
          window.location.href = '/';
        } else {
          setStepIdx(i => i + 1);
        }
      };

      return (
        <div className="screen">
          <p className="progress">Step {stepIdx + 1} of {room.steps.length}</p>
          <h2>{step.title}</h2>
          {step.images.map(id => (
            <img key={id} src={`https://drive.google.com/uc?id=${id}`} alt={step.title} />
          ))}
          <p>{step.instructions}</p>
          <button className="reset-btn" onClick={confirmReset}>Reset ✅</button>
          {stepIdx > 0 && (
            <button className="back-btn" onClick={() => setStepIdx(i => i - 1)}>Back</button>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<Walkthrough />);
  </script>
</body>
</html>
```

- [ ] **Step 3: Manual verification**

```bash
node server.js &
```

From the Home screen, start a Walkthrough session for a room with 2+ steps: confirm the first step's title/instructions/images render, clicking "Reset ✅" writes the step (check via `curl -b /tmp/rr-cookie http://localhost:3001/api/rooms/<slug>` isn't needed — instead check the spreadsheet row directly) and advances to step 2, Back returns to step 1 without losing the "done" state, and confirming the last step redirects to `/` and fills the sheet row's End Time.

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add public/walkthrough.html public/reset.html
git commit -m "feat: add walkthrough screen with resume-aware step tracking"
git push
```

---

### Task 11: Quick List screen

**Files:**
- Create: `RoomReset/public/quicklist.html`

**Interfaces:**
- Consumes: same endpoints as Task 10; shares the `roomreset_completed` `sessionStorage` key set in Task 10 Step 1.
- Produces: an all-steps-as-checkboxes screen offering the same completion path as the Walkthrough.

- [ ] **Step 1: Write `public/quicklist.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <title>RoomReset — Quick List</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { font-family: sans-serif; margin: 0; background: #111; color: #eee; }
    .screen { padding: 24px; max-width: 480px; margin: 0 auto; }
    label { display: flex; align-items: center; gap: 12px; padding: 14px 0; font-size: 18px; border-bottom: 1px solid #333; }
    input[type="checkbox"] { width: 24px; height: 24px; }
    button { padding: 14px; font-size: 18px; border: none; border-radius: 6px; margin-top: 16px; width: 100%; background: #2a4; color: white; }
    button:disabled { background: #555; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    const params = new URLSearchParams(window.location.search);
    const roomSlug = params.get('room');
    const rowIndex = params.get('row');

    function QuickList() {
      const [room, setRoom] = useState(null);
      const [done, setDone] = useState(new Set());

      useEffect(() => {
        fetch(`/api/rooms/${roomSlug}`).then(r => r.json()).then(d => {
          setRoom(d.room);
          const completed = JSON.parse(sessionStorage.getItem('roomreset_completed') || '[]');
          setDone(new Set(completed));
        });
      }, []);

      if (!room) return <div className="screen">Loading...</div>;

      const toggle = async (step) => {
        if (done.has(step.title)) return; // steps are write-once, matches per-step timestamp model
        await fetch(`/api/rooms/${roomSlug}/sessions/${rowIndex}/step`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepTitle: step.title })
        });
        setDone(d => new Set([...d, step.title]));
      };

      const allDone = room.steps.every(s => done.has(s.title));

      const finish = async () => {
        await fetch(`/api/rooms/${roomSlug}/sessions/${rowIndex}/finish`, { method: 'POST' });
        window.location.href = '/';
      };

      return (
        <div className="screen">
          <h1>{room.name} — Quick List</h1>
          {room.steps.map(step => (
            <label key={step.id}>
              <input type="checkbox" checked={done.has(step.title)} onChange={() => toggle(step)} />
              {step.title}
            </label>
          ))}
          <button disabled={!allDone} onClick={finish}>Finish Reset</button>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<QuickList />);
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

```bash
node server.js &
```

From Home, start a Quick List session: confirm all steps show as checkboxes (pre-checked ones reflect a resumed session's `completedSteps`), checking one writes it immediately (verify in the spreadsheet), "Finish Reset" stays disabled until all are checked, and clicking it writes End Time and returns to `/`.

```bash
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add public/quicklist.html
git commit -m "feat: add quick list screen"
git push
```

---

### Task 12: Admin builder — step editor with camera capture

**Files:**
- Create: `RoomReset/public/admin.html`
- Modify: `RoomReset/server.js` (serve `/admin`)

**Interfaces:**
- Consumes: `GET /api/rooms/:slug`, `POST /api/rooms/:slug`, `POST /api/rooms/:slug/image` from prior tasks.
- Produces: a working room builder — new/edit room, add steps with camera-captured photos, reorder/delete, save.

- [ ] **Step 1: Add the admin route to `server.js`**

```javascript
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
```

- [ ] **Step 2: Write `public/admin.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <title>RoomReset — Admin</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { font-family: sans-serif; margin: 0; background: #111; color: #eee; }
    .screen { padding: 24px; max-width: 480px; margin: 0 auto; }
    input, textarea, select { width: 100%; padding: 10px; margin: 6px 0; font-size: 16px; box-sizing: border-box; }
    .step-card { border: 1px solid #444; border-radius: 8px; padding: 12px; margin: 10px 0; }
    .step-card img { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-right: 6px; }
    button { padding: 10px; font-size: 16px; border: none; border-radius: 6px; margin: 4px 0; }
    .primary { background: #d63; color: white; width: 100%; }
    .small { background: #333; color: #eee; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;

    function AdminBuilder() {
      const [rooms, setRooms] = useState([]);
      const [slug, setSlug] = useState('');
      const [name, setName] = useState('');
      const [sheetTab, setSheetTab] = useState('');
      const [steps, setSteps] = useState([]);
      const [draftTitle, setDraftTitle] = useState('');
      const [draftInstructions, setDraftInstructions] = useState('');
      const [draftImages, setDraftImages] = useState([]);
      const fileInput = useRef(null);

      useEffect(() => {
        fetch('/api/rooms').then(r => r.json()).then(d => setRooms(d.rooms || []));
      }, []);

      const loadRoom = async (s) => {
        if (!s) { setSlug(''); setName(''); setSheetTab(''); setSteps([]); return; }
        const resp = await fetch(`/api/rooms/${s}`);
        const data = await resp.json();
        setSlug(s); setName(data.room.name); setSheetTab(data.room.sheetTab); setSteps(data.room.steps);
      };

      const capturePhoto = async (e) => {
        const file = e.target.files[0];
        if (!file || !slug) { alert('Set the room slug (Save once first) before adding photos.'); return; }
        const form = new FormData();
        form.append('image', file);
        const resp = await fetch(`/api/rooms/${slug}/image`, { method: 'POST', body: form });
        const data = await resp.json();
        setDraftImages(imgs => [...imgs, data.driveFileId]);
      };

      const addStep = () => {
        if (!draftTitle) return;
        setSteps(s => [...s, { id: `step-${Date.now()}`, title: draftTitle, instructions: draftInstructions, images: draftImages }]);
        setDraftTitle(''); setDraftInstructions(''); setDraftImages([]);
      };

      const removeStep = (id) => setSteps(s => s.filter(st => st.id !== id));
      const moveStep = (idx, dir) => {
        setSteps(s => {
          const copy = [...s];
          const j = idx + dir;
          if (j < 0 || j >= copy.length) return copy;
          [copy[idx], copy[j]] = [copy[j], copy[idx]];
          return copy;
        });
      };

      const save = async () => {
        if (!slug || !name || !sheetTab) { alert('Slug, name, and sheet tab are required.'); return; }
        const resp = await fetch(`/api/rooms/${slug}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, sheetTab, steps })
        });
        if (resp.ok) alert('Room saved.');
      };

      return (
        <div className="screen">
          <h1>RoomReset Admin</h1>
          <select onChange={e => loadRoom(e.target.value)}>
            <option value="">-- New Room --</option>
            {rooms.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
          <input placeholder="Room slug (e.g. pirates-cove)" value={slug}
                 onChange={e => setSlug(e.target.value)} />
          <input placeholder="Room name" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Sheet tab name (e.g. reset-pirates-cove)" value={sheetTab}
                 onChange={e => setSheetTab(e.target.value)} />

          <h3>Steps</h3>
          {steps.map((s, idx) => (
            <div className="step-card" key={s.id}>
              <strong>{s.title}</strong>
              <p>{s.instructions}</p>
              {s.images.map(id => <img key={id} src={`https://drive.google.com/uc?id=${id}`} alt="" />)}
              <div>
                <button className="small" onClick={() => moveStep(idx, -1)}>↑</button>
                <button className="small" onClick={() => moveStep(idx, 1)}>↓</button>
                <button className="small" onClick={() => removeStep(s.id)}>Delete</button>
              </div>
            </div>
          ))}

          <h3>Add Step</h3>
          <input placeholder="Step title" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} />
          <textarea placeholder="Instructions" value={draftInstructions}
                    onChange={e => setDraftInstructions(e.target.value)} />
          <input type="file" accept="image/*" capture="environment" ref={fileInput} onChange={capturePhoto} />
          <p>{draftImages.length} photo(s) captured</p>
          <button className="small" onClick={addStep}>Next (Add Step)</button>

          <button className="primary" onClick={save}>Save Room</button>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<AdminBuilder />);
  </script>
</body>
</html>
```

- [ ] **Step 3: Manual verification**

On the Android tablet's Chrome, visit `http://<dev-host>:3001/admin`: create a new room with slug/name/sheet tab, use the file input to trigger the camera and capture a photo for a step, confirm the photo count increments and (after adding the step) the thumbnail renders from Drive, add a second step, reorder with ↑/↓, delete one, then Save and confirm via `GET /api/rooms/<slug>` (curl) that the saved JSON matches, and confirm the spreadsheet tab's headers updated to match the final step titles.

- [ ] **Step 4: Commit**

```bash
git add public/admin.html server.js
git commit -m "feat: add admin room builder with camera capture"
git push
```

---

### Task 13: PWA manifest + service worker

**Files:**
- Create: `RoomReset/public/manifest.json`
- Create: `RoomReset/public/sw.js`
- Create: `RoomReset/public/icon-192.png`
- Create: `RoomReset/public/icon-512.png`
- Modify: `RoomReset/public/reset.html`, `RoomReset/public/walkthrough.html`, `RoomReset/public/quicklist.html`, `RoomReset/public/admin.html` (add manifest link + SW registration)

**Interfaces:**
- Produces: an installable PWA — Chrome's "Add to Home Screen" prompt becomes available once the manifest + a registered service worker are present.

- [ ] **Step 1: Create app icons**

Generate (or have the user supply) a 192x192 and 512x512 PNG icon for RoomReset and save them as `public/icon-192.png` / `public/icon-512.png`. Placeholder generation for local dev is acceptable (e.g. a solid-color square via any image tool); production icon can be swapped later without code changes.

- [ ] **Step 2: Write `public/manifest.json`**

```json
{
  "name": "RoomReset",
  "short_name": "RoomReset",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#111111",
  "theme_color": "#dd6633",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Write a minimal `public/sw.js`**

```javascript
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 4: Add manifest link + SW registration to each HTML page**

Add inside `<head>` of `reset.html`, `walkthrough.html`, `quicklist.html`, and `admin.html`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#dd6633" />
```

Add before the closing `</body>` of each of those same four files:

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

- [ ] **Step 5: Manual verification**

```bash
node server.js &
```

On the Android tablet's Chrome, visit `http://<dev-host>:3001/`, open the browser menu, confirm "Add to Home Screen" / "Install app" is available (not just "Add shortcut" — that distinction means the manifest+SW registered correctly), install it, confirm it launches full-screen with its own icon distinct from the tracker's PWA.

```bash
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json public/sw.js public/icon-192.png public/icon-512.png public/*.html
git commit -m "feat: make RoomReset an installable PWA"
git push
```

---

## Part C — Deployment

### Task 14: Deploy RoomReset to the Pi

**Files:**
- Create: `RoomReset/docs/DEPLOY.md`

**Interfaces:**
- Consumes: the rebuilt Pi from Task 1/2; the complete app from Tasks 3–13.
- Produces: a second PM2 process (`roomreset-server`) on port 3001, a second nginx location/subdomain, and a documented deploy procedure for future updates.

- [ ] **Step 1: Copy the app to the Pi**

```bash
ssh mytho@<pi-ip> 'mkdir -p ~/roomreset/data/reset-rooms'
scp -r "C:\Users\mytho\Documents\HTM\GameTracker\RoomReset\server.js" \
       "C:\Users\mytho\Documents\HTM\GameTracker\RoomReset\lib" \
       "C:\Users\mytho\Documents\HTM\GameTracker\RoomReset\public" \
       "C:\Users\mytho\Documents\HTM\GameTracker\RoomReset\package.json" \
       mytho@<pi-ip>:/home/mytho/roomreset/
```

- [ ] **Step 2: Install dependencies and credentials on the Pi**

```bash
ssh mytho@<pi-ip>
cd ~/roomreset
npm install
echo -n "<roomreset login password>" > data/password.txt
```

Copy the same `google-credentials.json` used by the tracker (Task 2, Step 4) into `~/roomreset/google-credentials.json` — same service account, same spreadsheet, both apps read it independently:

```bash
cp ~/escape-room-tracker/google-credentials.json ~/roomreset/google-credentials.json
```

- [ ] **Step 3: Set environment variables and start with PM2**

```bash
cd ~/roomreset
cat > .env <<'EOF'
PORT=3001
ROOMRESET_SPREADSHEET_ID=1TCrSmXbHZnlltAJn1940vrMo_Z6z3PuLskcGPSQu7Yk
ROOMRESET_DRIVE_ROOT_FOLDER_ID=<drive-folder-id>
EOF
pm2 start server.js --name roomreset-server --env production
pm2 save
```

Note: if `server.js` doesn't already load `.env` (it doesn't, per Task 3's skeleton), add `require('dotenv').config();` as the first line of `server.js` and `npm install dotenv` before this step.

- [ ] **Step 4: Configure nginx location**

```bash
sudo tee /etc/nginx/sites-available/roomreset > /dev/null <<'EOF'
server {
    listen 80;
    server_name roomreset.local;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/roomreset /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Note: `roomreset.local` requires either a DNS/hosts-file entry pointing to the Pi's IP on each tablet, or swap this for a path-based route (`/roomreset/`) on the tracker's existing server_name if a second hostname isn't practical — confirm which with the user before finalizing.

- [ ] **Step 5: Add a link from the tracker's home page**

In `htm-escape-tracker/home.html`, add a link/button to `http://roomreset.local/` (or the chosen URL) opening in a new tab.

- [ ] **Step 6: Manual verification**

From a tablet on the venue network: open the tracker's home page, click the RoomReset link, confirm it opens RoomReset in a new tab, log in, run one full Walkthrough session end-to-end against the real spreadsheet, and confirm `pm2 status` on the Pi shows both `htm-server` and `roomreset-server` as `online`.

```bash
ssh mytho@<pi-ip> 'pm2 status'
```

- [ ] **Step 7: Write `docs/DEPLOY.md` and commit**

Document the exact commands above (copy/install/env/pm2/nginx) in `RoomReset/docs/DEPLOY.md` so future updates are a matter of re-running steps 1–3.

```bash
cd "C:\Users\mytho\Documents\HTM\GameTracker\RoomReset"
git add docs/DEPLOY.md
git commit -m "docs: add Pi deployment instructions"
git push
```

---

## Self-Review Notes

- **Spec coverage:** Pi rebuild (Task 1–2), standalone repo/server (Task 3), operators from Dropdown tab (Task 4), room CRUD (Task 5), Drive photo upload (Task 6), sheet header sync (Task 7), progressive write + resume (Task 8), Home/Walkthrough/Quick List UI (Task 9–11), camera-based admin builder (Task 12), PWA installability (Task 13), deployment + tracker link (Task 14) — all spec sections have a task.
- **Type consistency:** `rowIndex` is a number end-to-end (parsed from the URL param and route param with `parseInt`); `stepTitle` (not `stepId`) is the key used to address sheet columns consistently across Task 7 (headers), Task 8 (`writeStepCell`), Task 10/11 (frontend calls); room shape `{ name, slug, sheetTab, steps: [{ id, title, instructions, images }] }` is identical across Tasks 5, 9, 10, 11, 12.
- **Known follow-up, not blocking:** the operators column letter in Task 4 (`'A'`) is a best guess pending confirmation against the real "Dropdown" tab layout — flagged inline in that task rather than left silently wrong.
