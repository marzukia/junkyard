# convert

HEIC to JPG, WebP & PNG, compress & resize. Replaces TinyPNG. 100% client-side (no server, no upload, no account).

Convert and compress images in your browser: HEIC/HEIF to JPG/PNG/WebP/AVIF, PNG to WebP, JPG to PNG, and more. Resize by max dimension, exact pixels, or percentage. No upload, no account.

## Features
- Format conversion: HEIC/HEIF, JPG, PNG, WebP, AVIF (encode support Chrome 94+ / Firefox 113+)
- HEIC/HEIF detection by MIME type and file extension
- Compression: quality slider (0-100) for lossy formats
- Resize modes: max dimension, exact width, exact height, scale percentage (1-200%)
- Batch input (multiple files)
- Download individually or as ZIP
- AVIF encode feature-detection via UA heuristic with graceful fallback

## Pure logic (`src/lib`)
Pure logic lives in `src/convert.ts` and points at the real file.

- `src/convert.ts` -- `isHeic`, `formatToMime`, `canEncodeAvif` (UA-based heuristic), `ConvertOptions` type, `OutputFormat` type; canvas-based encode helpers and resize logic

Browser-only (canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/convert
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/convert/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/convert/` into `dist/convert/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- HEIC decode uses the `heic2any` library (WASM-based, browser-only)
- Output encode goes through `canvas.toBlob(mime, quality)`; AVIF encode requires Chrome 94+ or Firefox 113+
- `canEncodeAvif` uses a synchronous UA heuristic rather than an async round-trip to avoid complicating the format-select UI
- `src/processor.ts` handles the async pipeline (HEIC decode -> canvas draw -> resize -> encode -> blob)
