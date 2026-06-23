# ocr

Pull text out of any image (OCR). Replaces i2OCR. 100% client-side (no server, no upload, no account).

Drop any image or screenshot and extract the text it contains. Supports multi-language OCR with the selected language persisted across sessions. A sample image can be generated in-browser for a quick demo. PDF pages are also supported via a separate utility.

## Features
- Extract text from JPEG, PNG, GIF, BMP, WebP, and TIFF images
- Multi-language support; selected language persisted to localStorage
- PDF page OCR via `src/ocrPdfUtils.ts`
- In-browser sample image generation for a quick demo (no network request)
- Copy extracted text to clipboard

## Pure logic (`src/lib`)
- `src/ocrUtils.ts` -- `loadPersistedLanguage()` and `persistLanguage()` localStorage helpers; `createSampleImageFile()` canvas-based sample generator; `LANG_STORAGE_KEY` constant
- `src/ocrPdfUtils.ts` -- PDF-to-image conversion utilities for multi-page OCR

Browser-only (Tesseract.js WASM + canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/ocr
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/ocr/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/ocr/` into `dist/ocr/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- OCR engine is Tesseract.js running as a Web Worker with WASM; the worker is loaded lazily on first use
- Language data files are fetched from the Tesseract CDN on demand; `eng` is the default and is always available
- `createSampleImageFile()` returns `null` in non-browser environments (e.g. vitest without jsdom) so tests can guard against it safely
