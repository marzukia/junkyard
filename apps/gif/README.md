# gif

Turn images into animated GIFs. Replaces EZGIF. 100% client-side (no server, no upload, no account).

Add images as frames, drag to reorder, set per-frame or global delay, choose loop count, preview the animation live, then export as a GIF. A size estimate is shown before encoding so you can adjust dimensions or frame count first.

## Features
- Add multiple images as frames; drag-to-reorder
- Per-frame or global delay control
- Loop count (finite loops or infinite)
- Live animation preview before export
- Optional caption overlay on frames (rendered with a semi-transparent pill at the bottom)
- Export size estimate shown before encoding

## Pure logic (`src/lib`)
- `src/gif.ts` -- `estimateGifBytes()` size estimator, `formatDuration()` helper, `drawCaption()` canvas overlay, `clamp()` utility; no DOM dependency

Browser-only (canvas bound for encoding); not exposed over MCP.

## Local dev
```bash
cd apps/gif
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/gif/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/gif/` into `dist/gif/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Encoding via `gifenc` (typed via `src/gifenc.d.ts`)
- Size estimate uses ~2 bits/pixel after LZW quantization plus ~1 KB/frame palette overhead -- deliberately conservative
- `store.ts` tracks frame list and playback state; `theme.ts` provides shared design tokens
