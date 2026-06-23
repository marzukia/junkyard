# collage

Grid + freeform photo collages. Replaces Canva. 100% client-side (no server, no upload, no account).

Build photo collages in two modes: grid (template-based, normalised cell rects) and freeform (drag, rotate, resize cards on a canvas). Export high-resolution PNG or JPG with configurable gutter, corner radius, and canvas shape. No watermark, no upload, no signup.

## Features
- Grid mode with 15+ layout templates (1-cell to 9-grid, banner, featured, social presets)
- Freeform pinboard mode: drag, rotate, scale cards freely; aspect-ratio-preserving corner resize
- Pan and zoom photos within grid cells (focal point offset)
- Canvas aspect ratio presets: 1:1, 4:5, 9:16, 3:2, 16:9, IG square/portrait/story, Pinterest
- Four collage shapes: rectangle, rounded rectangle, circle, heart (parametric SVG clip paths)
- Configurable gutter, corner radius, background color
- Optional per-cell inset border (width + color)
- High-resolution export (up to 2400px) as PNG or JPG with timestamped filename

## Pure logic (`src/lib`)
- `layouts.ts` -- `LAYOUT_TEMPLATES` (normalised 0-1 `CellRect` definitions), `getTemplate`
- `aspectRatios.ts` -- `ASPECT_PRESETS` (ratio + export dimensions), `getAspectPreset`, `canvasPreviewSize` (letterbox fit calculation)
- `collageShapes.ts` -- `COLLAGE_SHAPES` (rectangle, rounded, circle, heart), parametric `path(w, h)` SVG path builders, `applyShapeClip`, `getShape`
- `resizeMath.ts` -- `applyResize` (8-handle corner/edge drag with aspect-ratio lock for corners, single-axis for edges, `MIN_FRAC` clamping)
- `canvasExport.ts` -- `exportGrid` and `exportFreeform` (high-res canvas rendering with shape clipping, cover-fit per cell, gutter, border)
- `exportFilename.ts` -- `exportFilename` (timestamped `collage-YYYYMMDD-HHmmss.ext`)

Browser-only (canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/collage
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bun run test             # vitest
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/collage/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/collage/` into `dist/collage/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- All layout cells are normalised 0-1 fractions; export scales them to the target pixel resolution
- Heart shape uses cubic bezier control points normalised from a unit square, scaled to any w x h
- Corner resize uses dominant-axis selection (larger of |dx|, |dy|) to lock aspect ratio; edge handles resize one axis only
- `MIN_FRAC = 0.05` prevents freeform cards collapsing below 5% of canvas per dimension
