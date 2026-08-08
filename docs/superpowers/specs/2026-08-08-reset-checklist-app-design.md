# Escape Room Reset Checklist App — Design

## Purpose

A standalone, installable web app (PWA) that walks HTM operators through
resetting an escape room between sessions, or lets experienced operators use
a fast checkbox list instead. Room content (steps, instructions, images) is
fully author-defined via an in-app admin builder — nothing is hardcoded per
room. Progress is written live to the same Google Spreadsheet the session
tracker already uses, so a dropped tablet/session doesn't lose data and can
be resumed.

## Relationship to existing tracker app

- Lives in its **own repository** (`hourtomidnight/RoomReset`) and runs as
  a **standalone Express app** with its own `server.js`, own PM2 process,
  and own port on the same Pi — a separate deployment from the existing
  `htm-escape-tracker`, not new routes bolted onto its `server.js`. Nginx
  gets its own location block (or subdomain) routing to this app's port.
- Reuses the *pattern* of the existing tracker (session-cookie auth via
  `express-session`, `data/password.txt`, `googleapis` service-account
  client) but with its own login screen and its own session cookie — it is
  a genuinely separate app the operator opens/logs into independently, per
  the requirement that this be installable/usable as a distinct app from
  the session tracker (own PWA manifest + icon + minimal service worker so
  it installs to the Android home screen separately). `home.html` in the
  tracker repo gets a link/button to open it in a new tab.
- Reuses the **same Google service-account credentials file and the same
  spreadsheet ID** as the tracker (copied into this repo's deployment, not
  committed — same as the tracker's `google-credentials.json` handling), so
  both apps read/write the one shared spreadsheet without duplicating setup.
- Not built for full offline use — requires the same venue wifi/LAN as the
  existing tracker. See "Progressive write / resume flow" below for how it
  tolerates connectivity/app interruption without an offline sync layer.

## Data model

**Rooms** — JSON files on the Pi, `data/reset-rooms/<room-slug>.json`:
```json
{
  "name": "Pirates Cove",
  "slug": "pirates-cove",
  "sheetTab": "reset-pirates-cove",
  "steps": [
    {
      "id": "step-1",
      "title": "Reset Lockbox",
      "instructions": "Spin dial back to 0-0-0, close lid.",
      "images": ["driveFileId1", "driveFileId2"]
    }
  ]
}
```
Rooms are created/edited only through the admin builder — never hand-edited.

**Operators** — read live from the existing spreadsheet's "Dropdown"
repository tab (one designated column), via the same
`values.get`-on-a-column pattern already used for "How Did You Hear"
options. Used for both the primary Operator and the Helper(s) multi-select.

**Images** — captured on-device via the tablet camera in the admin builder,
uploaded through the server to the Google Drive API (service account, Drive
scope) into a per-room subfolder of one shared "HTM Reset Images" Drive
folder. The room JSON stores the returned Drive file ID; the walkthrough UI
renders images via a Drive-served direct-view URL built from that ID.

**Reset log (Google Sheets)** — one tab per room, tab name from the room's
`sheetTab` field (e.g. `reset-pirates-cove`). Columns:

```
Operator | Helpers | Date | Start Time | End Time | <Step 1 title> | <Step 2 title> | ...
```

Step columns are generated from the room's current step list and kept in
sync (added/renamed/removed) by the same auto-header-management approach
the tracker already uses for its session tabs. One row per reset session.

## Progressive write / resume flow

Unlike the original session tracker (which writes once at submit), this app
writes incrementally so a dropped tablet doesn't lose the session:

1. **Start**: operator picks Room → Operator → optional Helper(s) → mode
   (Walkthrough or Quick List) → Start. Server immediately appends a row to
   that room's tab: Operator, Helpers, Date, Start Time, End Time blank, all
   step cells blank. The row's sheet `rowIndex` is returned to the client
   and held for the rest of the session (same find/update-by-`rowIndex`
   pattern the tracker already uses).
2. **Per step**: confirming a step (Reset ✅ in Walkthrough, or checking a
   box in Quick List) immediately writes that step's cell with a timestamp
   via an update call — not batched, not deferred.
3. **Resume detection**: when a Room is selected on Home, the server checks
   that room's tab for a row with Start Time filled and End Time blank. If
   one exists, the UI prompts *"Resume session by \<operator\> started at
   \<time\>? (X of Y steps done)"*. Yes reopens the walkthrough/quick-list
   at the correct point, using that row's already-filled step cells to mark
   steps done. No starts a fresh row, leaving the old partial row as an
   abandoned record for manual review later (never auto-deleted).
4. **Finish**: once all steps are confirmed, the End Time cell is written
   and the session is complete. No separate "submit" step — the row has
   been live the whole time.

This means at most one in-progress (partial) row per room at a time is
expected; if an operator says "No" to resuming, the prior partial row is
simply left incomplete in the sheet as a visible record that a reset was
dropped.

## Screens

- **Home** (`reset.html`): Room picker → resume prompt (if applicable) →
  Operator dropdown → Helper(s) multi-select (optional) → mode toggle
  (Walkthrough / Quick List) → Start.
- **Walkthrough**: one step at a time, image carousel (if multiple images),
  instructions text, big "Reset ✅" button that timestamps + advances, Back
  to revisit a prior step, "Step X of Y" progress indicator.
- **Quick List**: all steps as checkboxes on one screen; checking a box
  timestamps that step. No images/instructions shown — built for operators
  who already know the room.
- **Admin builder** (`reset-admin.html`): create a new room or edit an
  existing one. Per step: type instructions, capture 1+ photos with the
  tablet camera (uploaded to Drive immediately on capture), "Next" adds
  another step. Steps are reorderable and deletable. Save persists the room
  JSON and syncs the Sheet tab's headers to the current step list.

## Backend (RoomReset repo's own server.js)

A new standalone Express app (own `package.json`, own `server.js`) with its
own `isAuthenticated` session middleware, its own `sheetsAPI` client, and a
new Drive API client — all built from the same service-account credentials
file and spreadsheet ID the tracker uses, copied into this repo's
deployment (not committed, same handling as the tracker's
`google-credentials.json`):

- `GET /`, `GET /admin` — serve the standalone pages (`reset.html` as the
  app's home, `reset-admin.html` for the builder).
- `GET /api/reset/rooms` — list rooms (name + slug).
- `GET /api/reset/rooms/:slug` — get one room's step list.
- `POST /api/reset/rooms/:slug` — create/update a room's steps; syncs sheet
  tab headers.
- `POST /api/reset/rooms/:slug/image` — accept a captured photo, upload to
  Drive, return `{ driveFileId, viewUrl }`.
- `GET /api/reset/operators` — read operator names from the Dropdown tab.
- `POST /api/reset/sessions/start` — check for a resumable row, else create
  a new partial row; returns `{ rowIndex, resumable, completedSteps }`.
- `POST /api/reset/sessions/:rowIndex/step` — write a single step's
  timestamp cell.
- `POST /api/reset/sessions/:rowIndex/finish` — write the End Time cell.

## Error handling

- Any per-step write failure (network blip) shows an inline retry on that
  step rather than silently losing the confirmation — the step is not
  marked done client-side until the server confirms the write.
- If Drive upload fails during room building, the admin sees an error and
  can retry the photo capture before advancing to the next step.
- Sheet tab auto-creation (first time a new room is saved) follows the same
  approach as the tracker's existing per-room tab creation.

## Infrastructure: Pi rebuild required

The Raspberry Pi that hosted the existing tracker has been wiped/recycled,
so there is currently no server for either app. Bringing this app up
requires rebuilding the Pi from scratch and redeploying the existing
`htm-escape-tracker` alongside it, since both share the box. In scope for
the implementation plan:

- Fresh Raspberry Pi OS install, Node.js + npm, PM2, nginx.
- Re-establishing the two PM2 processes (`htm-server` for the tracker,
  a new process for RoomReset) on separate ports, with nginx location
  blocks (or subdomains) routing to each.
- Re-installing the Google service-account credentials file (regenerate or
  reuse the existing key — the service account itself may still exist in
  Google Cloud even though the Pi was wiped; confirm before regenerating,
  since regenerating invalidates the old key everywhere it's used).
- Re-establishing `data/password.txt` for both apps' logins.
- Network/IP addressing: confirm whether the Pi keeps the same static
  IPs (`192.168.1.151` business / `192.168.0.124` home) or needs
  reconfiguration.

## Testing

No build step / no existing automated test framework in this repo (matches
the tracker's own no-build, manual-verification approach). Verification is
manual: run locally against a test spreadsheet/Drive folder, exercise
Walkthrough, Quick List, dropped-session resume (close tab mid-session,
reopen, confirm resume prompt and correct partial state), and the admin
builder's camera capture + save, on an actual Android tablet before
deploying to the Pi.
