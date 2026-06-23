# svg

Shrink SVG files with SVGO. Replaces SVGOMG. 100% client-side (no server, no upload, no account).

Paste or upload an SVG and get a smaller file instantly. Configure which SVGO plugins to apply, see before/after byte sizes and the percentage saving, then copy or download the result.

## Features
- SVGO-powered optimization running entirely in the browser (`svgo/browser` build)
- Configurable plugins: strip metadata, collapse groups, round coordinate precision (1-8 digits), remove comments, convert shapes to paths, clean up IDs
- Byte size display for original and optimized output with percentage saving
- Paste SVG text directly or upload a file
- Copy optimized SVG to clipboard or download as a file
- Friendly error messages for invalid or non-SVG input

## Pure logic (`src/lib`)
- `src/svgOptimize.ts` - exports `optimizeSvg` (runs SVGO with selected plugin config), `parseFriendlyError` (maps SVGO/SAX error messages to readable strings), `byteLength`, `OptimizeOptions`, `OptimizeResult`

Browser-only (SVGO WASM/browser build bound); not exposed over MCP.

## Local dev
```bash
cd apps/svg
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/svg/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/svg/` into `dist/svg/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Imports from `svgo/browser` (not `svgo`) to avoid Node.js `fs`/`path` deps in the browser bundle
- `parseFriendlyError` maps SAX parser error strings like "Non-whitespace before first tag" to human-readable messages rather than exposing raw SVGO exceptions
- `byteLength` uses `TextEncoder` for accurate UTF-8 byte counts rather than string length
