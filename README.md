# TrueView Field Report

TrueView is an iPhone-first residential home inspection field app for room-by-room reporting, photos, alert states, saved report libraries, and branded PDF export.

The app intentionally preserves the existing static architecture: `index.html`, `styles.css`, `app.js`, a small `server.js` for local Desktop/iCloud export, and client-side PDF generation.

## Run Locally

```text
npm start
```

Then open:

```text
http://localhost:5173/index.html?v=16
```

If port 5173 is busy:

```text
PORT=5174 npm start
```

Run syntax/build checks:

```text
npm run check
npm run build
```

Local export folder:

```text
~/Desktop/TrueView Reports
```

## Deployment

The app shell can be deployed as static files to Netlify, Vercel, Cloudflare Pages, or any static host. Upload the HTML, CSS, JS, manifest, service worker, icons, and offline fallback.

The local `server.js` Desktop/iCloud export endpoint is for the Mac field workstation workflow. On a static host, PDF download/share still works in the browser, while server-side saving to the Mac Desktop folder is unavailable unless you deploy an equivalent API endpoint.

See `DEPLOYMENT_AND_APP_INSTALL.md` for the project-specific install, build, Vercel, iPhone install, offline test, and cloud-sync notes.

## Dynamic Report Sections

Use **Add Area/System** from the section gear menu, the desktop Sections sidebar, or the mobile Sections drawer to add a section from the existing report templates.

What you can do:

- Add a new section from existing home inspection categories such as Bedroom, Bathroom, Kitchen, Garage, Attic, HVAC, Electrical, Plumbing, Exterior, Roof, Laundry, and similar current report categories.
- Duplicate an existing section from the section gear menu. The new section gets fresh item IDs and does not share observations or photos with the original.
- Rename a section from the gear menu with a custom display name like Primary Bedroom, Guest Bedroom, Detached Garage, or Basement Bathroom.
- Reorder sections with Move Up/Move Down controls inside the gear menu.
- Tap and hold a section in the Sections panel, then drag it to reorder. The section ID stays stable so notes, photos, observations, and checklist states remain attached.
- Mark optional sections Not Applicable. They remain visible and clearly marked, and the PDF marks them as N/A.
- Remove optional sections. Removed sections are soft-archived instead of destroyed.
- Restore removed sections from the Add/Restore drawer.

Dynamic section names and order appear in the editor, section list, report preview, print view, PDF output, and local export metadata. Dynamic section changes autosave locally just like field edits.

## Offline-First Field App Behavior

What works offline:

- Opening the installed app shell after it has been cached once.
- Creating, editing, and reopening reports.
- Editing property, client, agent, company, weather, occupancy, and inspection fields.
- Editing checklist statuses and conditions.
- Adding observations, notes, recommendations, and photos.
- Adding, duplicating, renaming, reordering, archiving, restoring, and marking sections Not Applicable.
- Viewing the local report library.
- Generating/downloading PDFs in the browser.

Where data is saved:

- Reports are saved immediately to `localStorage` as a compatibility mirror.
- Reports, section instances, section templates, inspection items, clients, properties, photos metadata, app settings, sync metadata, and sync queue records are also saved in IndexedDB through `offline-db.js`.
- Existing captured image data remains in the original IndexedDB photo store, with new metadata mirrored into the offline database.

Autosave behavior:

- Every meaningful edit saves locally first.
- Section changes save near-immediately.
- Normal field edits use a short debounce to keep the interface smooth.
- Refreshing, closing, or reopening the app preserves the current report and customized section structure.

Sync status:

- The header shows Online/Offline, pending change count, sync failures, conflicts, and whether cloud sync is configured.
- Changes are queued locally while offline or while cloud sync is not configured.
- When internet returns, the sync service attempts to sync through Supabase when configured.
- Without cloud credentials, the app truthfully shows **Cloud sync not configured** and keeps all local work safe.

## Supabase Cloud Sync

Supabase sync is implemented as a local-first layer. IndexedDB/localStorage still save first, then `sync-service.js` pushes queued reports/photos to Supabase and pulls remote reports/photos back down when online.

Run the SQL in:

```text
supabase/schema.sql
```

Add these Vercel environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID
```

Use either the publishable key or the older anon key. Do not use a Supabase service-role key in the frontend.

`NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID` should be a long random value used by the RLS policies to isolate your TrueView data. After adding/changing Vercel variables, trigger a new production deployment so `env-config.js` is regenerated.

Conflict behavior:

- Local edits are never silently overwritten.
- If remote data is newer and the local report has no pending local edits, TrueView pulls the remote report.
- If both local and remote changed, the sync queue marks a conflict and keeps the local report safe for review.

Known limitations:

- iOS storage can still be affected by device-level storage pressure, so finalized PDFs should be shared/exported when possible.
- Desktop/iCloud folder export depends on running `server.js` locally.
- Large production photo libraries should eventually move from `trueview_photos.data_url` into the private `trueview-photos` Supabase Storage bucket described in the SQL.

## Install On iPhone

1. Start the local server or open the deployed HTTPS URL in Safari.
2. Wait for the app to finish loading once while online.
3. Tap Safari Share.
4. Tap **Add to Home Screen**.
5. Launch **TrueView** from the Home Screen.
6. Open the app once online to cache it, then test Airplane Mode for offline field use.

## Mobile Interaction Improvements

- The bottom navigation now uses a hamburger icon only, with no visible "Menu" label.
- The bottom navigation stays compact and thumb-friendly.
- Buttons, menu items, section controls, add/remove actions, report actions, and bottom navigation controls now use clearer pressed states with subtle scale/brightness feedback.
- Section drag reorder uses a long-press state and visible dragging treatment.
- Per-section actions live behind a top-right gear button and open as a modal-style popover above the inspection card.

## PDF Layout Fixes

The observation card content was sitting too far left in the generated canvas PDF. The issue was corrected in the PDF renderer, not with print CSS, by giving observation cards a consistent inner content inset.

The fix aligns:

- Severity pill
- Observation title
- Section/item metadata
- Notes
- Recommendation heading and text
- Photo frames
- Vertical severity accent line

Verified:

- Existing PDF export still works.
- Observation summary cards align correctly.
- Dynamic sections appear in the exported PDF.
- Sections marked Not Applicable appear clearly in the PDF.

Photo-frame alignment uses the same corrected inset; test with real observation photos on-device as part of field QA.

## Preserved Existing Functionality

- Existing report setup fields.
- Existing residential checklist sections and checklist item wording.
- Existing status values: `NA`, `IN`, `NI`, `NP`.
- Existing condition values: `Satisfactory`, `Fair`, `Poor`.
- Existing observation sheet fields, severities, recommendations, templates, and photo attachment workflow.
- Existing report library, open/save/export/delete workflow.
- Existing local Desktop/iCloud export folder workflow through `server.js`.
- Existing branded PDF report generation and browser share/download behavior.
- Existing app layout, liquid-glass styling direction, mobile drawer workflow, and field dashboard.

## Project Files

- `index.html`: app shell, PWA/iOS metadata, script loading.
- `styles.css`: TrueView liquid-glass UI, mobile controls, section manager, touch feedback.
- `app.js`: report workflow, dynamic section management, autosave, PDF/export, offline integration.
- `offline-db.js`: IndexedDB database layer and typed record boundaries.
- `sync-service.js`: Supabase REST sync adapter, pending queue processing, and conflict strategy.
- `sw.js`: offline app-shell service worker.
- `manifest.webmanifest`: installable PWA metadata.
- `types.d.ts`: TypeScript interfaces for reports, sections, observations, and sync records.
- `OFFLINE_FIRST_NOTES.md`: implementation plan and architecture notes captured before coding.
