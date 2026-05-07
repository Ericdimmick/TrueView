# InspectFlow Field Report

An iPhone-first home inspection prototype for fast room-by-room reporting, photo capture, alert states, and PDF generation.

## Open It

Local Mac preview:

```text
http://localhost:5173
```

iPhone on the same Wi-Fi:

```text
http://192.168.4.28:5173
```

Run the full local server, including Desktop/iCloud export:

```text
node server.js
```

If port 5173 is already in use:

```text
PORT=5174 node server.js
```

Export folder:

```text
/Users/eric/Desktop/InspectFlow Reports
```

## What Works Now

- Full residential room-by-room checklist modeled after the attached sample report.
- Multi-report library for saved inspections.
- Manual Save Current action plus automatic local progress saving.
- Open, update, export, and delete saved inspections from the Reports drawer.
- Property, client, agent, company, and inspection setup fields.
- Field setup media cards for company logo and front property photo.
- Per-item inspection states: `NA`, `IN`, `NI`, `NP`.
- Per-item condition states: `Satisfactory`, `Fair`, `Poor`.
- Observation sheet with severity, location, notes, recommendation, and quick comment templates.
- Camera/photo upload from iPhone using the file picker.
- Local autosave for inspection data.
- IndexedDB photo storage for captured images.
- Printable report view.
- Client-side PDF generation and share/download button.
- Offline shell support through a service worker when opened from a supported secure/local context.
- Polished field dashboard with checklist progress and severity counts.
- Mobile report drawer with summary, print, and share actions.
- Professional PDF styling with cover page, severity summary, status key, report map, section tables, observations, recommendations, and photos.
- PDF images render uncropped inside their frames, preserving portrait, square, 4:5, 16:9, and panoramic aspect ratios.
- Installable PWA metadata and app icon.
- Local export server that creates one folder per report with the generated PDF, photo files, and `report-data.json`.

## Next Native App Step

This prototype is designed so the data model and workflow can be moved into a native SwiftUI app later. The next native milestone would be:

- SwiftData inspection storage.
- Native camera capture.
- Native PDF renderer.
- Native iOS share sheet for AirDrop, Mail, Messages, and Files.
- Polished Liquid Glass navigation and modal sheets.
