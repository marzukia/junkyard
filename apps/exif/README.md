# exif

See & strip photo metadata + GPS. Replaces metadata2go. 100% client-side (no server, no upload, no account).

View GPS location, camera settings, capture timestamps, and all hidden EXIF data embedded in a photo. A privacy verdict (high / medium / clean) flags which fields are sensitive. Strip all metadata and download the cleaned image instantly.

## Features
- Read EXIF, IPTC, and XMP tags from JPEG, TIFF, HEIC, and RAW files
- Sensitive field detection: GPS coords, timestamps, device serials, owner identity, software trace
- Privacy verdict with human-readable reasons (high / medium / clean)
- One-click EXIF strip -- downloads a clean copy with metadata removed
- GPS coordinates shown on a map link

## Pure logic (`src/lib`)
- `src/exif-utils.ts` -- `SENSITIVE_KEYS` set, `PrivacyVerdict` classifier, GPS coord parsing; no DOM

Browser-only (canvas + DOM bound for strip/download); not exposed over MCP.

## Local dev
```bash
cd apps/exif
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/exif/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/exif/` into `dist/exif/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Uses the `exifr` library for broad format support (JPEG, TIFF, HEIC, RAW)
- Strip path rewrites the file via canvas `toBlob` (JPEG) or ArrayBuffer slice (removes EXIF APP1 segment)
- `src/strip.ts` handles the binary stripping separately from the display utilities
