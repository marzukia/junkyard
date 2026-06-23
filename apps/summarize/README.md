# summarize

Summarize long text and articles. Replaces QuillBot. 100% client-side (no server, no upload, no account).

Paste article text or a long document and get an abstractive summary generated entirely in your browser using an on-device AI model. A slider controls target summary length. Long inputs are automatically chunked and summarized in passes. The model downloads once (~250 MB) and is cached in the browser thereafter.

## Features
- Abstractive summarization (not extractive - produces new sentences)
- Adjustable summary length slider (short / medium / long)
- Automatic chunking for inputs exceeding model token limits
- Per-chunk progress indicator during multi-chunk jobs
- Word count and reduction percentage display
- Sample article for empty-state demo
- HTML paste support with automatic text extraction

## Pure logic (`src/lib`)
- `summarizer.ts` - `loadModel` (loads `Xenova/distilbart-cnn-6-6` via transformers.js, single-threaded WASM), `summarizeText`, `SummaryOptions`; forces `numThreads=1` to avoid SharedArrayBuffer requirement on GitHub Pages
- `textHelpers.ts` - `countWords`, `formatWordCount`, `formatReduction`, `formatProgress`, `chunkText`, `needsChunking`, `clamp`, `lengthLabel`, `sliderToMaxWords`, `maxWordsToMin`, `extractTextFromHtml`; no DOM side-effects

Browser-only (on-device model via transformers.js ONNX WASM); not exposed over MCP.

## Local dev
```bash
cd apps/summarize
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bun run test             # vitest
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/summarize/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/summarize/` into `dist/summarize/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Model: `Xenova/distilbart-cnn-6-6` (~250 MB download, cached via `env.useBrowserCache = true`)
- `numThreads` is forced to 1 before any ONNX session is created; this bypasses the SharedArrayBuffer/COOP+COEP requirement that GitHub Pages cannot satisfy
- `MODEL_MAX_WORDS = 768` (conservative estimate: 1024 encoder tokens x 0.75 words/token); inputs over this are split into overlapping chunks
- WebGPU is attempted first for acceleration; single-thread WASM is the fallback
