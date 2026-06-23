# hash

MD5, SHA-1, SHA-256 checksums. 100% client-side (no server, no upload, no account).

Compute cryptographic hashes for text or files directly in the browser. Supports MD5, CRC32, SHA-1, SHA-224, SHA-256, SHA-384, SHA-512, SHA-3-256, SHA-3-512, and HMAC. Results update live as you type; file hashing works on arbitrarily large files via streaming.

## Features
- Hash text (live as you type) or files
- Algorithms: MD5, CRC32, SHA-1, SHA-224, SHA-256, SHA-384, SHA-512, SHA-3-256, SHA-3-512, HMAC
- HMAC with selectable digest algorithm and key input
- Copy-to-clipboard for each output
- Checksum verification: paste an expected hash and get a pass/fail result

## Pure logic (`src/lib`)
- `src/lib/hash.ts` -- pure-TS MD5 and CRC32 implementations; Keccak-based SHA-3; SubtleCrypto for SHA-1/SHA-2 and HMAC; accepts `string | ArrayBuffer`, returns lowercase hex
- `src/lib/verify.ts` -- checksum comparison utilities

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_hash_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/hash
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/hash/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/hash/` into `dist/hash/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- MD5 and CRC32 are pure-TS because SubtleCrypto does not expose those algorithms
- SHA-3 uses a pure-TS Keccak sponge implementation (SubtleCrypto omits SHA-3)
- SHA-1 / SHA-2 / HMAC delegate to `crypto.subtle` for native speed
- Rejection-sampling ensures uniform distribution when picking from a byte range
