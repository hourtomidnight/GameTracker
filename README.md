# GameTracker

Monorepo for Hour To Midnight's (HTM) internal escape room tools, both
deployed on the same Raspberry Pi:

- [`tracker/`](tracker/README.md) — session tracker game masters use to run
  a room end-to-end (Pre-Game → Game → Post-Game → submit to Google Sheets).
- `roomreset/` — PWA that walks operators through resetting a room between
  sessions, with progress written live to Google Sheets.

Both are separate Node/Express services (different ports, different pm2
processes) linked from the shared home page (`tracker/home.html`) — kept as
independent origins deliberately, not merged into one server, so their
`/api/*` routes don't collide. See `tracker/CLAUDE.md` for why.

## Deployment

The Pi has its own `git clone` of this whole repo at `~/GameTracker` and
self-updates via the root [`update.sh`](update.sh) — `git pull` when behind,
`npm install` in whichever app(s) changed, then restart both pm2 services.
Trigger it with `npm run deploy` from either `tracker/` or `roomreset/`, or
SSH in and run it directly.

See `docs/PI-REBUILD.md` for the Pi's full setup history and
`tracker/CLAUDE.md` for tracker-specific deploy details (network address,
SSH user, etc. — shared by both apps since they're on the same Pi).
