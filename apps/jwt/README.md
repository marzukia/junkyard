# jwt

Decode & inspect JWT tokens. Replaces jwt.io. 100% client-side (no server, no upload, no account).

Paste any JSON Web Token to instantly decode header and payload. Standard registered claims (`exp`, `iat`, `nbf`, `iss`, `sub`, `aud`, `jti`) are shown in human-readable form with an expiry badge. The token never leaves the browser; this is an inspector, not a validator -- no signature verification is performed.

## Features
- Decode header (algorithm, type, key ID) and payload claims
- `exp`, `iat`, `nbf` displayed as human-readable dates and relative times
- Expiry badge: valid / expired / not-yet-valid
- Raw base64url segments shown alongside decoded JSON
- Structured error messages for wrong segment count, invalid base64, and non-object header/payload

## Pure logic (`src/lib`)
- `src/lib/jwt.ts` -- `decodeBase64Url()` with padding normalisation and UTF-8 decode via TextDecoder; `decodeJwt()` returning typed `DecodedJwt | DecodeError`; pure synchronous, no DOM

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_jwt_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/jwt
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/jwt/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/jwt/` into `dist/jwt/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- base64url decode re-adds `=` padding and substitutes `-`/`_` back to `+`/`/` before calling `atob`, then re-decodes as UTF-8 via TextDecoder to handle multi-byte characters in payloads
- No crypto.subtle calls: signature verification is intentionally out of scope (private keys should never be pasted into a browser tool)
