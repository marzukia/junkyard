# favicon

Any image into a full favicon set. Replaces favicon.io. 100% client-side (no server, no upload, no account).

Upload any PNG or SVG (or type text / paste an emoji) and get a complete favicon package: ICO, all PNG sizes, Apple Touch icon, PWA manifest icons, `manifest.json`, and the ready-to-paste HTML `<link>` snippet. Quality warnings flag non-square, low-resolution, or low-contrast source images before you export.

## Features
- Three source modes: image upload, text, or emoji
- Output sizes: 16x16, 32x32, 48x48, 180x180 (Apple Touch), 192x192, 512x512 PWA, and `favicon.ico`
- Configurable background colour, corner radius, and inner padding
- Image quality analysis: warns on non-square, too-small (<512px), or low-contrast source
- Exports as a ZIP containing all files plus `manifest.json` and HTML snippet

## Pure logic (`src/lib`)
- `src/lib/faviconCore.ts` -- `FaviconSize` definitions, `SourceMode` type, `CanvasOptions`, `analyseImage()` for quality warnings; canvas-dependent functions separated from pure types

Browser-only (canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/favicon
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/favicon/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/favicon/` into `dist/favicon/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- `favicon.ico` is synthesised by packing the 16, 32, and 48px canvases into the ICO binary format in-browser
- `faviconStore.ts` manages reactive state separately from the pure generation utilities
- Low-contrast detection samples the source image into a 32px canvas and checks luminance range
