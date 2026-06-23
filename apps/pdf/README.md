# pdf

Merge, split & compress PDFs. Replaces iLovePDF. 100% client-side (no server, no upload, no account).

A multi-tool PDF toolkit running entirely in the browser. Merge several PDFs into one, split or extract specific pages using a compact range syntax, reorder pages, compress, convert images to PDF, and export PDF pages as PNG images. No file leaves the device.

## Features
- Merge multiple PDFs with per-file progress reporting
- Split or extract pages via compact range syntax (e.g. `1,3-5,7`)
- Page reordering
- Compress PDFs (pdf-lib re-serialisation)
- Convert images (JPEG, PNG) to PDF
- Export PDF pages as PNG images
- Robust error messages when a file is corrupted or not a valid PDF

## Pure logic (`src/lib`)
- `src/lib/pdfUtils.ts` -- `parsePageRange()` range parser, `mergePdfs()` with progress callback, `extractPages()`, image-to-PDF and PDF-to-image helpers; all built on `pdf-lib`

Browser-only (pdf-lib WASM + canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/pdf
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/pdf/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), building this app with `--base=/pdf/` into `dist/pdf/`. Umami analytics are injected at build from repo-root `umami-ids.txt`.

## Tech notes
- Built on `pdf-lib` which runs entirely in the browser via WASM; no server-side PDF processing
- `parsePageRange` de-duplicates indices (via `Set`) so overlapping ranges like `1-3,2-4` do not produce duplicate pages
- `mergePdfs` throws a human-readable error naming the specific file when `PDFDocument.load` fails, making it easy to identify a corrupt input in a batch
