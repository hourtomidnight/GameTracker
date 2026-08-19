# HTM Escape Room Tracker

Internal tool for Hour To Midnight (HTM), a Portland, OR escape room venue. Game
masters use it on a tablet/browser to run a session end-to-end: pre-game setup,
live timer + hint tracking, win/lose, then review and submit. Submitted sessions
sync to a Google Sheet (one tab per room) for record-keeping and reporting.

## Stack

- **Backend**: `server.js` — single-file Express app, session-based auth
  (`express-session`, 24hr cookie, password stored in `data/password.txt`).
- **Frontend**: `index.html` — single-file React app (React loaded via CDN,
  in-browser Babel, no build step). All app logic lives in one big inline
  `<script type="text/babel">` block.
- **Other pages**: `home.html` (landing page with links to Session Tracker,
  Node-RED, CSV downloads), `login.html`, `csv-downloads.html`.
- **Storage**: flat JSON files in `data/` (`storage.json` for game configs,
  `password.txt` for auth) — no database.
- **Google Sheets**: `googleapis` client, service account
  `htm-tracker-service@hourtomidnight-1470684737978.iam.gserviceaccount.com`,
  writes session data to per-room tabs (`pi-<abbrev>` naming), auto-manages
  header row 1, reads "How Did You Hear" options and per-room scheduled time
  slots from dedicated sheet tabs.
- **Deployment**: Raspberry Pi 4B, PM2 process manager (`pm2 restart
  htm-server`), nginx reverse-proxies port 80 → node's port 3000.

## Architecture notes

- `index.html` renders one giant `EscapeRoomTracker` component with screen
  components (`PreGameScreen`, `GameScreen`, PostGame review, `GameConfig`)
  defined as nested functions/conditionally-rendered blocks inside it, not as
  separate files.
- **Known footgun**: state that needs to survive re-renders (e.g. a dropdown's
  "Other" toggle) must live in the screen's own local `useState`/`formData`,
  not rely on a parent timer-driven re-render cycle — a `setInterval` ticking
  the displayed clock previously caused every keystroke in a form to flicker
  because it re-rendered the whole tree. `PreGameScreen` now uses local
  `formData` state and only commits to the parent `gameSession` on "Start
  Game" specifically to avoid this.
- Session flow: **Pre-Game** (game master, scheduled time dropdown pulled from
  a Google Sheet schedule tab filtered by room prefix, player counts, how
  did you hear, notes) → **Game** (timer, hints, Win/Lose buttons, notes
  stays editable) → **Post-Game** (review) → submit, which both writes to
  local storage and appends/updates the Google Sheet row.
- Server finds/updates sheet rows by `rowIndex`, not a stored session id.

## Conventions when making changes

- This is a no-build-step app — edits to `index.html`'s inline script take
  effect on page refresh, no compile step, but any JSX syntax error breaks
  the whole page silently until you check the browser console.
- Edits to `server.js` require `pm2 restart htm-server` on the Pi to take
  effect; a syntax error there takes the whole server down (502 from nginx)
  until fixed — always run `node -c server.js` before deploying.
- Prefer small, targeted edits over full-file rewrites given the file sizes
  (`index.html` ~100KB, `server.js` ~18KB) — read the relevant section first.
- Google Sheet tab/column layouts referenced by the app (session data
  columns, "How Did You Hear" list, schedule tabs) are documented in
  `docs/GOOGLE-SHEETS-SETUP.md`.

## Deployment

The Pi runs its own `git clone` of this repo at `~/escape-room-tracker` and
self-updates — nothing is scp'd file-by-file anymore.

```bash
# push your commits to GitHub first, then:
npm run deploy
```

This SSHes in and runs `update.sh` on the Pi, which `git fetch`s, does a
fast-forward-only `git pull` if the Pi is behind `origin/master`, runs
`npm install` if anything pulled, then `pm2 restart htm-server`. It refuses
to auto-merge (fails loudly instead) if the Pi's local copy has diverged —
that needs a human to look at it.

You can also SSH in and run `bash ~/escape-room-tracker/update.sh` directly,
or set it up as a cron job on the Pi for auto-updates without a manual
trigger.

**One-time setup on a fresh Pi** (see `docs/PI-REBUILD.md` for the full
rebuild process): `git clone` this repo to `~/escape-room-tracker`, `npm
install`, add the gitignored `google-credentials.json` and
`data/password.txt`, then `pm2 start server.js --name htm-server`.

The Pi runs the app continuously under pm2 — there's nothing to launch;
game masters just open the URL below in a browser.

Pi is currently on the sail network, reachable at `http://hourtomidnight/`
(also `http://HTM-PI-Web.local/` via mDNS as a fallback — both resolve
regardless of which network the Pi is physically on, so this shouldn't need
updating again on future moves). SSH user is `elshoff`, not `mytho` — see
`docs/PI-REBUILD.md` for the full history of prior network moves
(home → business → sail) and why the hostname-based links/deploy target
were adopted instead of hardcoded IPs.

`google-credentials.json` (service account key) is required at the repo root
on the Pi but is **not** committed — see `docs/GOOGLE-SHEETS-SETUP.md` for how
it's generated/installed.

## Currently in progress

- Post-Game review screen is not yet built (Pre-Game and Game screens are
  done and working).
- Game Config screen just gained "Schedule Tab" and "Game Prefix" fields used
  to pull that room's fixed daily time slots for the Pre-Game dropdown.
- Game screen date is no longer collected from the user — actual start
  timestamp is captured with `Date.now()` when "Start" is pressed.
