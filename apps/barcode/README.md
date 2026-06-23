# barcode

Code128, EAN, UPC barcodes. Replaces TEC-IT. 100% client-side (no server, no upload, no account).

Generate Code128, EAN-13, UPC-A, EAN-8, Code39, Code93, and ITF barcodes instantly in your browser. Download as PNG or SVG. Also generates QR codes in text, URL, WiFi, and vCard modes with preset-aware structured content builders.

## Features
- 7 barcode formats: CODE128, EAN-13, UPC-A, EAN-8, Code39, Code93, ITF
- EAN/UPC check-digit auto-computation and validation with auto-fix (appends missing check digit for 12-digit EAN-13 input)
- Format-specific input validation with human-readable error messages
- Download as PNG or SVG via JsBarcode
- QR code generator: text, URL, WiFi (WPA/WEP/open, hidden SSID, meCard escaping), vCard 3.0
- Configurable width, height, and margin

## Pure logic (`src/lib`)
- `barcode.ts` -- format metadata, EAN-13/EAN-8/UPC-A/ITF check-digit computation and validation, Code39/Code93/Code128/ITF validators, `clampSize` for format-specific minimum widths
- `qr.ts` -- `buildWifiString` (meCard Wi-Fi format with special-char escaping), `buildVCardString` (vCard 3.0), `buildQrContent` dispatch by preset, `qrPresetLabel`

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_barcode_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/barcode
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/barcode/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/barcode/` into `dist/barcode/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- JsBarcode renders to an SVG or canvas ref; all validation and check-digit logic is in pure `barcode.ts` so it can be unit-tested without a DOM
- QR rendering uses the `qrcode` npm package; structured content (WiFi, vCard) is built in pure `qr.ts`
- EAN/UPC auto-fix is additive: if the user supplies 12 digits for EAN-13, the 13th check digit is appended silently with a UI notice
