# base64

Encode & decode text and files. Replaces base64encode. 100% client-side (no server, no upload, no account).

Encode or decode text, files, and images in your browser across four modes: standard Base64, URL-safe Base64 (RFC 4648 §5, no padding), percent-encoding, and hex. Includes data-URI preview for image inputs and file download for decoded binary output.

## Features
- Four encoding modes: Base64, Base64url (no padding, `-`/`_` alphabet), URL percent-encoding, hex
- Text and file input (drag-and-drop or file picker)
- Data-URI preview for image files encoded to Base64
- File download for decoded binary output
- Auto-detect whether input looks like Base64 (heuristic `looksLikeBase64`)
- Strip data-URI prefix before decoding (`stripDataUri`, `parseDataUri`)
- Full UTF-8 support via TextEncoder/TextDecoder (emoji, CJK round-trip safe)

## Pure logic (`src/lib`)
- `base64.ts` -- `encodeBase64`/`decodeBase64` (UTF-8 safe via TextEncoder), `encodeBase64Url`/`decodeBase64Url` (RFC 4648 §5), `encodeHex`/`decodeHex`, `encodeUrl`/`decodeUrl`, `encode`/`decode` dispatch helpers by `EncodingMode`, `looksLikeBase64`, `stripDataUri`, `parseDataUri`, `isImageDataUri`, `bytesToBase64`/`base64ToBytes`

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_base64_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/base64
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/base64/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/base64/` into `dist/base64/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- UTF-8 encode: `TextEncoder` -> `Uint8Array` -> `btoa` (avoids Latin-1 truncation on multi-byte chars)
- UTF-8 decode: `atob` -> `Uint8Array` -> `TextDecoder`
- URL-safe Base64: replaces `+` -> `-`, `/` -> `_`, strips `=` padding; restores padding before decode
- Hex: `Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('')`
