# meme

Top/bottom text, no watermark. Replaces imgflip. 100% client-side (no server, no upload, no account).

Upload any image and add draggable text layers with classic Impact font (or Arial, Comic Sans, Mono). Drag to reposition text anywhere on the canvas, adjust font size and colour, then export a clean PNG with no watermark and no account required.

## Features
- Multiple draggable text layers (not just fixed top/bottom slots)
- Font choice: Impact, Arial, Comic Sans, Mono
- Adjustable font size and colour per layer
- Black outline on text for legibility over any background
- Live canvas preview; export as PNG
- No watermark

## Pure logic (`src/lib`)
- `src/meme.ts` -- `TextLayer` and `MemeState` types, `FONT_FAMILIES`/`FONT_LABELS` maps, `makeDefaultLayers()`, `drawCaption()` canvas renderer; no React dependency

Browser-only (canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/meme
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/meme/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/meme/` into `dist/meme/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Text rendering uses a classic Impact + black stroke outline drawn on a 2D canvas context
- Layer positions stored as 0..1 relative coordinates so they scale correctly when the canvas is resized
- `store.ts` tracks the layer list and selected image; `theme.ts` provides shared design tokens
