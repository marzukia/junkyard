# transcribe

Whisper speech to text. Replaces Otter.ai. 100% client-side (no server, no upload, no account).

Drop or select an audio or video file and get a full transcript generated in your browser using an on-device Whisper model. Output includes timestamped segments. Export as plain text, SRT, VTT, or JSON. The model downloads once (~145 MB) and is cached in the browser thereafter.

## Features
- Transcribes MP3, WAV, OGG, WebM, FLAC, AAC, M4A, MP4, MOV, and QuickTime files
- Timestamped segment output from Whisper chunk data
- Export formats: plain text, SRT subtitles, VTT subtitles, JSON
- Model download progress indicator
- File validation by MIME type with extension fallback for generic MIME files
- Human-readable file size and elapsed time display

## Pure logic (`src/lib`)
- `transcription.ts` - `loadModel` (loads `onnx-community/whisper-base` via transformers.js, single-threaded WASM), `transcribeAudio`; forces `numThreads=1` to avoid SharedArrayBuffer requirement on GitHub Pages; model is ~145 MB
- `audioHelpers.ts` - `isSupportedAudio`, `formatBytes`, `formatProgress`, `formatTimestamp`, `formatElapsed`, `formatSRT`, `formatVTT`, `formatJSON`, `ACCEPTED_AUDIO_TYPES`, `ACCEPT_ATTR`; no DOM side-effects

Browser-only (on-device model via transformers.js ONNX WASM); not exposed over MCP.

## Local dev
```bash
cd apps/transcribe
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/transcribe/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/transcribe/` into `dist/transcribe/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Model: `onnx-community/whisper-base` (~145 MB); `whisper-tiny.en` is a commented alternative (~75 MB, English-only)
- `numThreads` is forced to 1 before ONNX session creation to bypass the SharedArrayBuffer/COOP+COEP requirement
- `isSupportedAudio` checks MIME type first, then falls back to file extension for files delivered with `application/octet-stream`
- WebGPU is attempted first; single-thread WASM is the fallback
