# qr

QR codes with logo, colours & dot styles. Replaces qr-generator. 100% client-side (no server, no upload, no account).

Generate QR codes with full visual customisation: foreground and background colour, four dot styles (square, rounded, dots, classy), four finder-eye styles (square, rounded, circle, leaf), optional logo overlay, and error correction level. Download as PNG or SVG. No watermark, no account.

## Features
- Foreground and background colour picker with hex validation
- Dot styles: square, rounded, dots, classy
- Finder-eye styles: square, rounded, circle, leaf (applied independently of dot style)
- Optional logo image overlay with configurable size ratio
- Error correction level: L / M / Q / H
- Download as PNG or SVG
- Batch QR code generation (`src/lib/batch.ts`)
- Contrast checker to warn on low-contrast colour combinations (`src/lib/contrast.ts`)
- Named templates (`src/lib/templates.ts`)

## Pure logic (`src/lib`)
- `src/lib/qr.ts` -- `QROptions` type, `isValidHex()`/`normaliseHex()`/`hexToRgb()`, `computeFinderRegions()` and `isFinderModule()` shared by both canvas and SVG renderers so finder-region detection cannot drift between them
- `src/lib/batch.ts` -- batch generation helpers
- `src/lib/contrast.ts` -- WCAG contrast ratio utilities for colour-pair warnings
- `src/lib/templates.ts` -- named style presets

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_qr_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/qr
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/qr/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/qr/` into `dist/qr/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- QR matrix generation via the `qrcode` npm package; custom rendering (dots, eyes, logo) is layered on top via canvas and SVG paths
- `computeFinderRegions()` is called by both the canvas and SVG render paths from `qr.ts` -- a single source of truth prevents the two outputs diverging on finder-block coordinates
- Logo overlay reduces effective data capacity; H error-correction level is recommended when using a logo
