# TrueView Deployment And App Install

This document is based on the current project files in this folder. TrueView is not a React, Next.js, or Vite app. It is a vanilla HTML/CSS/JavaScript offline-first PWA with a small Node.js server for local preview and Mac Desktop folder export.

## Live Deployment

Production URL:

```text
https://trueview-omega.vercel.app
```

Latest verified production deployment:

```text
https://trueview-fdt9wj3z4-eric-4849s-projects.vercel.app
```

Vercel project:

```text
trueview
```

GitHub repository:

```text
https://github.com/Ericdimmick/TrueView.git
```

## Project Inspection Results

Framework:
Vanilla static web app. The app shell is `index.html`, styling is `styles.css`, app logic is `app.js`, local database logic is `offline-db.js`, Supabase sync logic is `sync-service.js`, and the local server is `server.js`.

Package manager:
`npm`, based on the project `package.json`. There is no `yarn.lock`, `pnpm-lock.yaml`, or Bun lock file in the project.

Local dev command:

```bash
npm start
```

This runs:

```bash
node server.js
```

Default local URL:

```text
http://localhost:5173/index.html?v=20
```

If port `5173` is already busy:

```bash
PORT=5174 npm start
```

Production build command:

```bash
npm run build
```

The current build command runs the syntax check and writes deployable static PWA files to `public/`:

```bash
npm run check
node scripts/build-static.js
```

This is correct for the current no-bundler architecture because there is no framework compiler. Vercel serves the generated `public/` directory.

Start/preview command:

```bash
npm start
```

The preview server serves the app files and enables the local Mac folder export endpoint at:

```text
POST /api/export-report
```

## PWA Status

Manifest:
`manifest.webmanifest` exists and is valid JSON.

Manifest install fields:

- `name`: `TrueView Field Report`
- `short_name`: `TrueView`
- `start_url`: `./index.html`
- `display`: `standalone`
- `orientation`: `portrait`
- `theme_color`: `#f5faf8`
- icons: `icon-192.png`, `icon-512.png`, and `icon.svg`

Service worker:
`sw.js` exists and is registered in `app.js` with:

```js
navigator.serviceWorker.register("./sw.js")
```

Offline app shell:
`sw.js` caches the core app files, manifest, icons, logo, and offline fallback. It also ignores query-string versioning when matching cached assets, which helps `styles.v20.css` and `app.v20.js` resolve against the cached app shell. The production service worker is served with `Service-Worker-Allowed: /` and `Cache-Control: no-cache, no-store, must-revalidate`.

iOS Safari Home Screen support:
`index.html` includes:

- viewport with `viewport-fit=cover`
- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-title`
- `apple-mobile-web-app-status-bar-style`
- `apple-touch-icon` using `apple-touch-icon.png`
- web app manifest link

Offline saving:
The app saves report data locally first. `saveState()` mirrors current data to `localStorage` and schedules IndexedDB persistence through `offline-db.js`.

Reports persist after refresh:
Yes. On boot, `loadLibrary()` attempts to load reports from IndexedDB first, then falls back to the existing `localStorage` mirror. This preserves reports, dynamic sections, section order, section names, observations, and local report status across refreshes and app restarts.

Cloud sync:
Cloud sync is implemented through Supabase but only becomes active after the Supabase SQL has been run and Vercel environment variables are configured. `sync-service.js` checks for these browser globals generated into `env-config.js` at build time:

```js
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID
```

If they are not configured, the app correctly reports:

```text
Cloud sync not configured
```

The app remains usable offline/local-first without cloud credentials.

## Supabase Setup

Run this SQL in the Supabase SQL Editor:

```text
supabase/schema.sql
```

The SQL creates:

- `public.trueview_reports`
- `public.trueview_photos`
- update timestamp triggers
- sync-space Row Level Security policies
- optional private `trueview-photos` storage bucket for a later large-photo storage upgrade

Add these Vercel environment variables to the `trueview` project:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_IF_USING_THE_OLDER_KEY_NAME
NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID=A_LONG_RANDOM_VALUE_YOU_KEEP_THE_SAME_ON_ALL_TRUEVIEW_DEVICES
```

Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for new Supabase projects. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is supported for the older anon-key convention. Do not add a service-role key to Vercel or the frontend.

After adding or changing those variables, redeploy the Vercel project so `scripts/build-static.js` can write them into `public/env-config.js`.

Supabase sync behavior:

- IndexedDB/localStorage remain the first save location.
- Supabase sync only runs when online and configured.
- Reports, dynamic sections, section order, observations, recommendations, statuses, and photo data URLs are synced.
- If remote data is newer and the local report has no pending local edits, TrueView pulls the remote report.
- If local and remote both changed, TrueView marks a conflict and does not overwrite silently.

## Verified Commands

Install command:

```bash
npm install
```

There are currently no external runtime dependencies in `package.json`, so this mainly validates npm metadata and prepares standard npm tooling.

Dev command:

```bash
npm start
```

Build command:

```bash
npm run build
```

Check command:

```bash
npm run check
```

Local preview with alternate port:

```bash
PORT=5174 npm start
```

## Vercel Deployment Notes

Vercel compatibility:
The app is Vercel-compatible as a static PWA when deployed as a plain static project.

Use these settings:

- Framework Preset: `Other`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `public`

The `public/` directory is generated by `scripts/build-static.js` during `npm run build` and is ignored by git.

Automatic GitHub redeploy status:
Connected. The `Ericdimmick/TrueView` GitHub repository is attached to the `trueview` Vercel project. Future pushes to the connected production branch should trigger Vercel deployments automatically.

Important limitation:
The local Mac Desktop export endpoint in `server.js` is not a Vercel serverless function. On Vercel, browser PDF share/download still works, offline report editing still works, and the PWA install still works, but saving generated PDFs directly into `~/Desktop/TrueView Reports` only works when running the local Node server on your Mac.

To make cloud deployment fully equivalent to the local Mac workflow, add one of these later:

- a Vercel serverless API route that stores PDFs/photos in cloud storage
- Supabase Storage for report PDFs and inspection photos
- a native iOS wrapper with Files/iCloud Drive integration
- a user-selected File System Access workflow for browsers that support it

## iPhone Install Steps

For local same-Wi-Fi testing:

1. On the Mac, run:

   ```bash
   npm start
   ```

2. Find the Mac LAN address.

3. On the iPhone, open Safari to:

   ```text
   http://YOUR_MAC_LAN_IP:5173/index.html?v=20
   ```

4. Wait for the app to load fully once.

5. Tap Safari Share.

6. Tap **Add to Home Screen**.

7. Launch **TrueView** from the Home Screen.

For deployed testing:

1. Open the live HTTPS URL in Safari on iPhone:

   ```text
   https://trueview-omega.vercel.app
   ```

2. Wait for the app to load fully once.
3. Tap Safari Share.
4. Tap **Add to Home Screen**.
5. Launch the installed app from the Home Screen.

## Offline Testing Steps

Local offline test:

1. Start the app:

   ```bash
   npm start
   ```

2. Open:

   ```text
   http://localhost:5173/index.html?v=20
   ```

3. Create or edit a report.

4. Change a field such as property address or inspector name.

5. Add, rename, duplicate, remove, or reorder a section.

6. Add an observation or photo if needed.

7. Confirm the header/save status shows a local saved state.

8. Refresh the page and confirm the report data remains.

9. Open browser dev tools or iPhone Safari Web Inspector and simulate offline mode, or turn on Airplane Mode after the app has loaded once.

10. Reopen the installed Home Screen app.

11. Confirm the app shell loads and the saved report is still available.

12. Turn the internet back on and confirm the status returns to online/local sync pending or cloud not configured.

Production offline test:

1. Open this URL in Safari or Chrome:

   ```text
   https://trueview-omega.vercel.app
   ```

2. Wait for the app to load once while online.
3. Add it to the iPhone Home Screen.
4. Create or edit a report.
5. Confirm the app shows a local saved state.
6. Turn on Airplane Mode.
7. Reopen the Home Screen app.
8. Confirm the app shell opens and the saved report remains available.
9. Turn the internet back on.
10. Confirm the sync indicator returns to online/local pending or cloud not configured.

Two-device Supabase sync test:

1. Run `supabase/schema.sql` in Supabase.
2. Add the Vercel variables listed above.
3. Redeploy Vercel.
4. Open `https://trueview-omega.vercel.app` on device A.
5. Create a report, enter a unique property address, add/rename/reorder a section, and add an observation.
6. Wait for the header to show a synced or no-pending state.
7. Open the same URL on device B.
8. Wait a few seconds while online.
9. Open the report library and confirm the report from device A appears.
10. Make a small edit on device B and wait for sync.
11. Return to device A, refresh/reopen, and confirm the edit appears.

## Multi-Device Cloud Sync Status

The app already has:

- device IDs
- local IDs
- remote IDs from Supabase rows
- updated timestamps
- sync statuses
- sync queue records
- conflict detection
- Supabase REST sync through `sync-service.js`
- local-first IndexedDB persistence

Still recommended for production hardening:

- add authentication/account ownership
- replace sync-space-only RLS with `auth.uid()` ownership policies
- move large photo libraries from `trueview_photos.data_url` to Supabase Storage objects
- add a dedicated conflict review UI
- add deeper tested merge rules for simultaneous edits from iPhone, iPad, and desktop
- add deletion/archive sync handling
- add production backup/export strategy

## Known Production Limitations

- Cloud sync requires the Supabase SQL and Vercel environment variables above. Without them, the app remains local/offline-first and shows Cloud sync not configured.
- Reports and photos saved before Supabase is configured live in that browser/device storage until the app is configured and allowed to sync.
- The Mac Desktop folder export endpoint in `server.js` is local-only. It is not available on the static Vercel deployment.
- Browser PDF share/download works on Vercel; server-side saving to `~/Desktop/TrueView Reports` requires running `npm start` locally on the Mac.
- GitHub automatic redeploys are enabled through the connected `Ericdimmick/TrueView` Vercel Git integration.
- Current photo sync stores compressed data URLs in `trueview_photos`. The SQL also creates a private `trueview-photos` bucket for a future larger-photo storage migration.

## Latest Validation

Completed locally:

```bash
npm run build
```

Result:
Build passed. The build runs JavaScript syntax checks for `app.js`, `offline-db.js`, `sync-service.js`, and `server.js`, then writes the static PWA bundle to `public/`.

Completed local server smoke test:

```bash
PORT=5174 npm start
```

Validated:

- `index.html` served with HTTP 200
- `manifest.webmanifest` served with HTTP 200 and valid JSON
- `sw.js` served with HTTP 200
- app shell references `styles.v20.css`
- app shell references `app.v20.js`
- app shell references `apple-touch-icon.png`

Completed Vercel production deployment:

```text
https://trueview-omega.vercel.app
```

Validated in production:

- production root returned HTTP 200
- `manifest.webmanifest` returned HTTP 200 and valid JSON
- `sw.js` returned HTTP 200
- `sw.js` included `Service-Worker-Allowed: /`
- production app shell references `styles.v20.css`
- production app shell references `app.v20.js`
- production app shell references `apple-touch-icon.png`
