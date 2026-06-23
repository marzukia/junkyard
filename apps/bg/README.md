# bg

Erase backgrounds with on-device AI. Replaces remove.bg. 100% client-side (no server, no upload, no account).

Remove image backgrounds instantly in your browser using the RMBG-1.4 segmentation model from Briaai, running via `@huggingface/transformers` with ONNX WASM or WebGPU. No signup, no watermark, no data leaves your device. Model is cached in the browser after first download.

## Features
- On-device background removal using briaai/RMBG-1.4 (image segmentation pipeline)
- WebGPU inference attempted first; falls back to single-threaded ONNX WASM (GitHub Pages compatible, no COOP/COEP headers needed)
- Before/after comparison slider
- Output fill: transparent PNG, white, or black background
- Custom hex color background fill
- Model download progress indicator with percentage
- Images downscaled to max 1024px edge before inference to avoid OOM
- Browser cache used so repeat visits skip the download

## Pure logic (`src/lib`)
- `bgRemoval.ts` -- `loadModel` (pipeline loader with progress callback), `removeBackground` (inference + mask compositing), `isModelLoaded` state predicate; forces `numThreads=1` before any ONNX session
- `imageHelpers.ts` -- `isSupportedImage`, `formatBytes`, `formatProgress`, `outputFilename`, `parseHexColor`, `clamp`, `computeCoverFit`

Browser-only (on-device model bound); not exposed over MCP.

## Local dev
```bash
cd apps/bg
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/bg/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/bg/` into `dist/bg/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- RMBG-1.4 requires `numThreads=1` set on `env.backends.onnx.wasm` before pipeline creation; GitHub Pages cannot send COOP/COEP headers so SharedArrayBuffer is unavailable and multi-threaded WASM would crash
- Large images are downscaled to `MAX_INFER_SIDE=1024` before inference and composited back at full resolution
- Model is tagged `on-device-ai` and `large-download` (hundreds of MB); first load shows a progress bar
