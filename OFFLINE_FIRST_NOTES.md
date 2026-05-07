# Offline-First Upgrade Notes

## Current Architecture Snapshot

- Framework/routing: vanilla static HTML, CSS, and JavaScript. There is no client router; the app runs from `index.html`.
- Server: `server.js` is a small Node HTTP server for local static hosting and Desktop/iCloud report export.
- State management: one in-memory `state` object for the active report and one `library` object for saved reports.
- Current storage: reports are mirrored into `localStorage`; photos are stored in IndexedDB under `inspectflow.photos.v1`.
- Report data model: each report contains `inspection` setup fields and a `sections` array. Each section contains checklist `items`, and each item contains `observations` with severity, notes, recommendations, and photo IDs.
- Section structure: the current report uses static section objects from `createSections()`, with room and system sections already represented as natural templates.
- PDF/export workflow: the app renders report pages into canvases client-side, writes a PDF from JPEG page images, then optionally sends the PDF/photos to `server.js` for local folder export.
- PWA status: manifest and service worker exist, but the app needs stronger app-shell caching, iOS install metadata, offline status, and a local database/sync layer.

## Implementation Plan

1. Preserve the current app structure and existing report workflow.
2. Add section instance metadata and migration without changing the current checklist content.
3. Add section management controls for add, duplicate, rename, reorder, tap-and-hold drag reorder, Not Applicable, archive/remove, and restore.
4. Fix PDF observation-card inner alignment at the canvas-rendering layer.
5. Add visual touch feedback and simplify the mobile bottom navigation to a hamburger icon only.
6. Add an IndexedDB-backed offline database layer while keeping the existing localStorage mirror as a compatibility fallback.
7. Add sync queue, device metadata, online/offline status, and a cloud adapter placeholder that is honest when cloud credentials are not configured.
8. Harden the service worker and PWA metadata for iPhone Home Screen installation.
9. Update README with preserved functionality, dynamic sections, offline behavior, mobile interaction notes, PDF fix notes, deployment, and iPhone installation instructions.
10. Verify syntax, app loading, dynamic section operations, offline shell behavior, PDF export, and persistence after refresh.
