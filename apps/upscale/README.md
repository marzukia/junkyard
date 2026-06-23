# upscale

AI super-resolution 2x and 4x. Replaces Upscayl. 100% client-side (no server, no upload, no account).

Drop a JPEG, PNG, or WebP image and upscale it 2x or 4x using an on-device Swin2SR super-resolution model. 4x runs two sequential 2x passes. Output is exported as PNG, JPEG, or WebP. The model downloads once (~50 MB) and is cached in the browser thereafter.

## Features
- 2x and 4x super-resolution (4x = two sequential 2x passes)
- Input: JPEG, PNG, WebP; output: PNG, JPEG, or WebP
- Input megapixel caps enforced per scale factor to prevent tab freeze (2x: 8 MP, 4x: 2 MP on desktop; dynamic on mobile based on device memory)
- Device memory budget detection for constrained-device caps
- Progress indicator during model download and inference
- Human-readable file size and dimension display

## Pure logic (`src/lib`)
- `upscale.ts` - `loadModel` (loads `Xenova/swin2SR-classical-sr-x2-64` via transformers.js, single-threaded WASM), `upscaleImage`, `ScaleFactor`; forces `numThreads=1`; model is ~50 MB
- `imageHelpers.ts` - `isSupportedImage`, `formatBytes`, `formatProgress`, `outputFilename`, `formatDimensions`, `safeInputMegapixels`, `deviceMemoryBudgetMB`, `isConstrainedDevice`, `outputMime`; `MAX_MEGAPIXELS`, `MAX_DIMENSION`, `ACCEPTED_TYPES`, `ACCEPTED_EXTENSIONS`

Browser-only (on-device model via transformers.js ONNX WASM); not exposed over MCP.

## Local dev
```bash
cd apps/upscale
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/upscale/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/upscale/` into `dist/upscale/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Model: `Xenova/swin2SR-classical-sr-x2-64` (~50 MB); Swin2SR tiles 64x64 patches so large images are processed in memory without requiring a full-resolution tensor allocation
- `numThreads` forced to 1 before ONNX session creation; WebGPU attempted first, single-thread WASM is the fallback
- Desktop caps: 2x at 8 MP, 4x at 2 MP; mobile caps use `navigator.deviceMemory` (via `deviceMemoryBudgetMB`) for dynamic limits
- `MAX_DIMENSION` entries are the longest-edge caps corresponding to the megapixel limits for square images
