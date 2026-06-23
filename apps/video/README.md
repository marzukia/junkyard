# video

Trim, convert, compress and GIF, in your browser. Replaces Veed. 100% client-side (no server, no upload, no account).

Drop a video file and trim it, convert between MP4/WebM/GIF, compress it, or extract a GIF clip - all powered by ffmpeg.wasm running single-threaded in the browser. No upload, no watermark, no account.

## Features
- Trim: set in/out points and cut a clip
- Convert: MP4, WebM, GIF output formats
- Compress: reduce file size with configurable quality
- GIF export with frame rate and resolution controls
- Single-threaded ffmpeg.wasm (no SharedArrayBuffer required, works on GitHub Pages)
- ffmpeg core loaded from jsDelivr CDN at runtime (not bundled) to keep the initial JS payload small
- Load progress indicator for the ~30 MB wasm binary
- Human-readable time and file size display

## Pure logic (`src/lib`)
- `ffmpeg.ts` - `getFFmpeg` (lazy singleton loader via jsDelivr CDN), `runFFmpeg` (input file + args + output name); `parseTime` (plain seconds, MM:SS, HH:MM:SS), `formatTime`, `formatBytes`; uses `@ffmpeg/ffmpeg` and `@ffmpeg/util`

Browser-only (ffmpeg.wasm single-thread, CDN-loaded binary); not exposed over MCP.

## Local dev
```bash
cd apps/video
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/video/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/video/` into `dist/video/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Uses `@ffmpeg/core` (NOT `@ffmpeg/core-mt`) so no SharedArrayBuffer or COOP/COEP headers are required; GitHub Pages and plain static hosts work without configuration
- The core wasm is pinned to `@ffmpeg/core@0.12.10` and loaded from jsDelivr at runtime via `toBlobURL`; this avoids inflating the main bundle with a ~30 MB binary
- `getFFmpeg` caches the loaded instance and the load promise; a failed load clears both so the next call can retry
- `parseTime` returns 0 for any invalid input rather than throwing, to allow partial entry during UI editing
