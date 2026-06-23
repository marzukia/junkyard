# crop

Crop, rotate, flip & resize. Replaces iLoveIMG. 100% client-side (no server, no upload, no account).

Crop images to preset or free aspect ratios, rotate, flip, and resize to exact pixels or social-platform dimensions. Runs entirely in your browser via canvas; no upload, no account.

## Features
- Aspect ratio presets: free, 1:1, 4:5, 9:16, 16:9, 4:3, 3:2, 4:1
- Social presets: Instagram square/portrait/story, Twitter/X post/header, Facebook cover, YouTube thumbnail, LinkedIn banner
- Crop shape: rectangle or circle (circle exports as PNG with transparent background)
- Rotate 90 degrees left/right, flip horizontal/vertical
- Resize to exact pixel width/height
- Export as PNG, JPG, or WebP

## Pure logic (`src/lib`)
Pure logic lives in `src/crop.ts` and points at the real file.

- `src/crop.ts` -- `ASPECT_PRESETS`, `SOCIAL_PRESETS`, `clamp`, `constrainCropRect`, `CropRect`, `CropShape`, `ExportFormat`, `AspectPreset` types and helpers for crop rect computation

Browser-only (canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/crop
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bun run test             # vitest
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/crop/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/crop/` into `dist/crop/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Crop rect is stored in image-pixel coordinates; canvas display scales independently
- Circle crop exports via canvas clip path with `arc()` and PNG output (preserves transparency)
- `constrainCropRect` clamps the rect to image bounds and pushes it back in rather than truncating, preserving the user's size intent
- State managed in Zustand (`src/store.ts`)
