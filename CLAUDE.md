# GameTracker (monorepo)

Two internal tools for Hour To Midnight (HTM), a Portland, OR escape room
venue, both deployed to the same Raspberry Pi:

- **`tracker/`** — session tracker for game masters. See
  `tracker/CLAUDE.md` for its architecture, conventions, and full
  deployment details (network address, SSH user, credentials setup).
- **`roomreset/`** — operator-facing PWA for resetting a room between
  sessions.

They're kept as separate Node/Express services (different ports, different
pm2 processes: `htm-server` and `roomreset-server`) rather than merged into
one server — RoomReset's frontend uses root-relative paths (`/api/...`) by
design as its own origin, and merging would collide with the tracker's own
`/api/*` routes at the same root. Both are linked from the shared home page
(`tracker/home.html`).

## Deployment

The Pi runs its own `git clone` of this whole repo at `~/GameTracker` and
self-updates — see the root [`update.sh`](update.sh) and
`tracker/CLAUDE.md`'s Deployment section for the full flow (`npm run
deploy` from either app SSHes in and runs it). `docs/PI-REBUILD.md` has the
Pi's full setup/rebuild history for both apps.

## When making changes

Treat `tracker/` and `roomreset/` as independent projects that happen to
share a repo and a Pi — read the relevant subproject's own CLAUDE.md/docs
before editing it. Don't assume conventions from one apply to the other
(e.g. RoomReset is a PWA with its own build/manifest concerns that the
tracker's no-build-step `index.html` doesn't have).
