# caption

Describe any image for alt text. Replaces BLIP. 100% client-side (no server, no upload, no account).

Generate image captions and alt text in your browser using the ViT-GPT2 image-to-text model (~90 MB) via `@huggingface/transformers`. Supports single-image captioning and batch mode with CSV/JSON export. No signup, no API key, no data leaves your device.

## Features
- On-device image captioning using Xenova/vit-gpt2-image-captioning (~90 MB)
- WebGPU inference attempted first; falls back to single-threaded ONNX WASM (GitHub Pages compatible)
- Single image mode: caption shown instantly after model loads
- Batch mode: drop multiple images, caption all, export results
- Batch export as CSV (RFC 4180 quoted) or JSON array
- Model download progress indicator
- Browser cache so repeat visits skip the download

## Pure logic (`src/lib`)
- `captioner.ts` -- `loadModel` (image-to-text pipeline loader), `generateCaption` (single image inference), `isModelLoaded`, `MODEL_ID` (`Xenova/vit-gpt2-image-captioning`), `MODEL_SIZE_MB` (90)
- `imageHelpers.ts` -- `isSupportedImage`, `formatBytes`, `formatProgress`, `formatCaption`, `batchToCsv` (RFC 4180 quoting), `batchToJson`, `downloadText`

Browser-only (on-device model bound); not exposed over MCP.

## Local dev
```bash
cd apps/caption
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/caption/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/caption/` into `dist/caption/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- `numThreads=1` forced on ONNX WASM backend before pipeline init (same pattern as bg/depth -- GitHub Pages has no COOP/COEP headers)
- `batchToCsv` uses RFC 4180 quoting: every field double-quoted, internal `"` escaped as `""`, CRLF row separators
- Model tagged `on-device-ai` and `large-download`
