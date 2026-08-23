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

## Google Drive photo uploads (one-time setup)

The service account used elsewhere in this app (`google-credentials.json`)
can only **read** Drive — it has zero upload quota on a personal (non-
Workspace) Gmail account, confirmed via `Service Accounts do not have
storage quota` errors (see `../docs/PI-REBUILD.md`). To let step photos
actually upload to Drive, a real Google account delegates access via OAuth
instead — uploads then use that person's own quota.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (same project as the service account, `hour-to-midnight-tracker`),
   create an **OAuth client ID** → Application type **Web application**.
   Add an **Authorized redirect URI**:
   `http://hourtomidnight:3001/api/auth/google/callback`
   (adjust host/port if the Pi's address changes — see `../CLAUDE.md`).
2. Create `roomreset/google-oauth-client.json` (gitignored, lives on the
   Pi only, same pattern as `google-credentials.json`):
   ```json
   {
     "clientId": "...apps.googleusercontent.com",
     "clientSecret": "...",
     "redirectUri": "http://hourtomidnight:3001/api/auth/google/callback"
   }
   ```
3. In Admin → Settings, click **Connect Google Drive** and sign in with the
   Google account that should own the uploads (needs write access to the
   shared Drive folder, `ROOMRESET_DRIVE_ROOT_FOLDER_ID` in
   `ecosystem.config.js`).

Once connected, new step photos upload into a subfolder named after the
room's slug/acronym under that root folder (created automatically on first
upload). If Drive isn't connected, or an upload to Drive fails for any
reason, photos fall back to local storage (`data/reset-images/<slug>/`) —
uploads never hard-fail because of Drive being unavailable.

The **Browse Drive Photos** picker (pre-existing photos placed manually in
the shared folder) is unaffected — that already worked with the read-only
service account and still does.
