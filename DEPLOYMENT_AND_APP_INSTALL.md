# TrueView Deployment And App Install

This document is based on the current project files in this folder. TrueView is not a React, Next.js, or Vite app. It is a vanilla HTML/CSS/JavaScript offline-first PWA with a small Node.js server for local preview and Mac Desktop folder export.

## Project Inspection Results

Framework:
Vanilla static web app. The app shell is `index.html`, styling is `styles.css`, app logic is `app.js`, local database logic is `offline-db.js`, sync scaffolding is `sync-service.js`, and the local server is `server.js`.

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
http://localhost:5173/index.html?v=11
```

If port `5173` is already busy:

```bash
PORT=5174 npm start
```

Production build command:

```bash
npm run build
```

The current build command runs the syntax check:

```bash
npm run check
```

This is correct for the current no-bundler architecture because there is no framework compiler or bundled output directory.

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
`sw.js` caches the core app files, manifest, icons, logo, and offline fallback. It also ignores query-string versioning when matching cached assets, which helps `styles.css?v=11` and `app.js?v=11` resolve against the cached app shell.

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
Cloud sync is prepared architecturally, not fully connected. `sync-service.js` checks for Supabase-style browser globals:

```js
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

If they are not configured, the app correctly reports:

```text
Cloud sync not configured
```

The app remains usable offline/local-first without cloud credentials.

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
- Output Directory: leave blank so Vercel serves the project root static files; this project does not generate a `dist`, `build`, or `.next` folder

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
   http://YOUR_MAC_LAN_IP:5173/index.html?v=11
   ```

4. Wait for the app to load fully once.

5. Tap Safari Share.

6. Tap **Add to Home Screen**.

7. Launch **TrueView** from the Home Screen.

For deployed testing:

1. Deploy the static app to HTTPS.
2. Open the deployed HTTPS URL in Safari on iPhone.
3. Wait for the app to load fully once.
4. Tap Safari Share.
5. Tap **Add to Home Screen**.
6. Launch the installed app from the Home Screen.

## Offline Testing Steps

1. Start the app:

   ```bash
   npm start
   ```

2. Open:

   ```text
   http://localhost:5173/index.html?v=11
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

## Multi-Device Cloud Sync Remaining Work

The app already has:

- device IDs
- local IDs
- remote ID placeholders
- updated timestamps
- sync statuses
- sync queue records
- conflict status placeholders
- Supabase configuration placeholders
- local-first IndexedDB persistence

Still needed for true multi-device sync:

- choose Supabase, Firebase, or another cloud backend
- create remote database tables matching reports, sections, items, photos, templates, and sync metadata
- add authentication/account ownership
- implement the cloud adapter upload/download logic in `sync-service.js`
- add remote photo/PDF storage
- implement conflict review UI
- add tested merge rules for simultaneous edits from iPhone, iPad, and desktop
- add deletion/archive sync handling
- add production backup/export strategy

## Latest Validation

Completed locally:

```bash
npm run build
```

Result:
Build passed. The build runs JavaScript syntax checks for `app.js`, `offline-db.js`, `sync-service.js`, and `server.js`.

Completed local server smoke test:

```bash
PORT=5174 npm start
```

Validated:

- `index.html` served with HTTP 200
- `manifest.webmanifest` served with HTTP 200 and valid JSON
- `sw.js` served with HTTP 200
- app shell references `styles.css?v=11`
- app shell references `app.js?v=11`
- app shell references `apple-touch-icon.png`
