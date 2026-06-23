# depth

Turn a photo into a depth map. Replaces Depth-Anything. 100% client-side (no server, no upload, no account).

Generate depth maps from any photo in your browser using the Depth-Anything-v2-small ONNX model via `@huggingface/transformers`. Choose from five colour maps (viridis, greyscale, magma, turbo, plasma) and download the result. No signup, no API key, no data leaves your device.

## Features
- On-device depth estimation using onnx-community/depth-anything-v2-small
- WebGPU inference attempted first; falls back to single-threaded ONNX WASM (GitHub Pages compatible)
- Five colour maps: viridis, greyscale, magma, turbo, plasma
- Colour map applied via per-pixel lookup on the raw depth tensor
- Model download progress indicator
- Browser cache so repeat visits skip the download
- Download depth map as PNG

## Pure logic (`src/lib`)
- `depthEstimation.ts` -- `loadModel` (depth-estimation pipeline loader with progress callback), `estimateDepth` (inference + colour map application), `isModelLoaded`, `viridisColour`, `magmaColour`, `turboColour`, `plasmaColour`, `applyColourMap` (pixel-level colour mapping from normalised depth value), `ColourMap` type; forces `numThreads=1` before any ONNX session
- `imageHelpers.ts` -- `isSupportedImage`, `formatBytes`, `formatProgress`, `outputFilename`

Browser-only (on-device model bound); not exposed over MCP.

## Local dev
```bash
cd apps/depth
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/depth/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/depth/` into `dist/depth/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- `numThreads=1` forced on ONNX WASM backend before pipeline init (GitHub Pages has no COOP/COEP headers so SharedArrayBuffer is unavailable)
- Colour maps are piecewise linear interpolations over fixed keyframe stops (e.g. viridis has 8 stops from dark blue to bright yellow)
- `applyColourMap` operates on a per-pixel greyscale value in [0,1] from the depth tensor; values are clamped before lookup
- Tagged `on-device-ai` and `large-download`
