# cleanup

Erase objects from photos, on-device. Replaces Cleanup.pictures. 100% client-side (no server, no upload, no account).

Brush over anything you want removed and erase it using classical inpainting (fast marching method, Telea 2004 inspired). Works without a model download for simple and uniform backgrounds. Beta: neural inpainting (LaMa/MI-GAN) is a planned follow-up.

## Features
- Brush-based mask painting directly on the image (circle brush, adjustable radius)
- Classical FMM inpainting -- good quality on uniform/simple backgrounds and small-to-medium regions
- Undo support for mask strokes
- Canvas-to-image coordinate mapping for correct painting at any display scale
- Export as PNG

## Pure logic (`src/lib`)
- `inpaint.ts` -- `inpaintImageData` (FMM inpainter with a minimal binary min-heap, propagates color from boundary inward weighted by distance and directional coherence), `eraseRegion` (wraps `inpaintImageData` on a cloned `ImageData`)
- `imageHelpers.ts` -- `isSupportedImage`, `formatBytes`, `clamp`, `outputFilename`, `canvasToImageCoords`, `circleBrushOffsets` (precomputed pixel offsets for a circle stamp), `paintMaskCircle`, `maskPixelCount`

Browser-only (canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/cleanup
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bun run test             # vitest
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/cleanup/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/cleanup/` into `dist/cleanup/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- FMM inpainting uses a hand-rolled binary min-heap (no dep) for fast boundary propagation
- `eraseRegion` clones the source `ImageData` before mutating so the original is preserved
- Quality degrades on complex textures (brickwork, tile) and large masked regions (>~15% of area)
- Tagged `beta`; neural ONNX inpainting is a planned v2 (requires a SharedArrayBuffer-free ONNX inpainting model)
