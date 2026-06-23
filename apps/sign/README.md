# sign

Sign a PDF in your browser. Replaces DocuSign. 100% client-side (no server, no upload, no account).

Load any PDF, then draw or type your signature on a canvas. Drag it to the right position on the page, resize it, optionally add a date-stamp text annotation, then download the signed PDF. Works offline once loaded.

## Features
- Draw signature freehand on a canvas or type a text signature
- Drag and resize the signature overlay on any page of the PDF
- Date-stamp text annotation with configurable font size and colour
- Multi-page PDFs supported; signature can target any page index
- Image signature upload (PNG, JPG, GIF, WebP normalised to PNG via canvas)
- Built-in sample PDF for demo and testing
- Download the signed file with embedded signature as a real PDF image object

## Pure logic (`src/lib`)
- `signPdf.ts` - exports `embedSignatureInPdf`, `embedSignatureOnPages`, `hexToRgb`, `canvasToPngDataUrl`, `textToPngDataUrl`, `imageFileToDataUrl`; all pdf-lib operations; `SignaturePlacement` and `TextAnnotation` types
- `samplePdf.ts` - generates a minimal A4 demo PDF via pdf-lib for the empty-state demo flow

Browser-only (canvas + pdf-lib DOM bound); not exposed over MCP.

## Local dev
```bash
cd apps/sign
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bun run test             # vitest
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/sign/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/sign/` into `dist/sign/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Signature position is stored as fractions of the rendered canvas dimensions (`xFrac`, `yFrac`, `wFrac`, `hFrac`) and converted to PDF-space coordinates at embed time
- `hexToRgb` falls back to black for malformed hex strings; 3-char hex is not supported
- Non-PNG uploads are normalised through a canvas `toDataURL('image/png')` call before embedding, ensuring consistent alpha support in pdf-lib
