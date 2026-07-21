# Unknown Files — Podcast Studio Lite

A fully client-side podcast creator for forensic, crime investigation, educational, and storytelling shows. No backend, no build step — just open `index.html`.

## Running it

- **Quickest:** double-click `index.html` (some browsers restrict file uploads under `file://`; if uploads misbehave, serve it locally instead).
- **Local server (recommended):** from this folder run `python3 -m http.server 8000`, then visit `http://localhost:8000`.
- **Netlify / GitHub Pages:** drag the folder in, or push it — it's already a static site.

## How data is stored

Everything — episode metadata, cover art, audio files, transcripts, favorites, theme choice — is saved to the browser's `localStorage` as base64. Nothing is uploaded anywhere. That means:

- Data is per-browser, per-device. Use **Export data** (sidebar) to download a JSON backup and **Import data** to restore or move it to another device/browser.
- `localStorage` typically caps out around 5–10MB per site. Long audio files can hit that ceiling fast — if a save fails, you'll get a toast warning. For heavier use, swap the `DB` object in `script.js` for `IndexedDB` or a real backend (see below).

## Architecture, for future extension

The whole app is three files: `index.html` (structure/routes), `style.css` (design system + theme), `script.js` (logic). Inside `script.js`:

- **`DB` object** — the only thing that talks to storage. Swap its `all/save/get/upsert/remove` methods to call Firebase, Supabase, or a Python/Node API later without touching any UI code.
- **Hash router** (`navigate()`) — `#dashboard`, `#create`, `#library`, `#favorites`, `#player` each map to a `<section class="view">`. Deep link to a specific episode with `#player?ep=EPISODE_ID`.
- **`cardTemplate()` / `bindCardActions()`** — the one episode-card markup + click-handler set, reused across dashboard, library, favorites, and related episodes.

## Notes on features

- **Duration auto-detect**: reads `audio.duration` from the uploaded file's metadata as soon as it loads.
- **QR code**: generated via a public QR image API (`api.qrserver.com`) since no external JS libraries were used — this one feature needs an internet connection; everything else works offline once the page has loaded once (service worker caches the app shell).
- **Share**: copies a deep link, opens WhatsApp/X/email intents, or triggers the native OS share sheet where supported.
- **Offline support**: a minimal service worker (`sw.js`) caches `index.html`, `style.css`, `script.js`, and `manifest.json` so the shell loads without a connection. Episode data was already offline-first via `localStorage`.

## Known limits (by design, given "Lite" scope)

- No multi-user accounts or cloud sync.
- No real audio transcoding — files are stored as-is.
- QR generation needs network access.
