# RoomReset

Standalone PWA that walks Hour To Midnight escape room operators through the
room reset process, with progress written live to Google Sheets.

This is the `roomreset/` app within the `GameTracker` monorepo — see the
[repo root README](../README.md) for how it relates to `tracker/` and how
deployment to the Pi works (`npm run deploy` here works the same as in
`tracker/`).

Design spec and implementation plan: `../docs/superpowers/specs/` and
`../docs/superpowers/plans/`. Pi setup/rebuild history (including this
app's deployment as `roomreset-server` under pm2): `../docs/PI-REBUILD.md`.
