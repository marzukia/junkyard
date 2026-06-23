# uuid

v4, v7 & nano IDs in bulk. Replaces uuidgenerator. 100% client-side (no server, no upload, no account).

Generate UUID v4 (random), UUID v7 (time-ordered), UUID v1 (time + random node), UUID v3 (MD5 name-based), UUID v5 (SHA-1 name-based), ULIDs, and Nano IDs. Single or bulk up to 1000. Output format options include lowercase, uppercase, braces, and base64. Inspect any UUID to see its version, variant, and embedded timestamp.

## Features
- UUID v4 (RFC 4122 random, using `crypto.getRandomValues`)
- UUID v7 (RFC 9562 time-ordered: 48-bit Unix ms timestamp + random)
- UUID v1 (time-based with random node ID; monotonic clock sequence within the same millisecond)
- UUID v3 (MD5 name-based) and v5 (SHA-1 name-based) with DNS, URL, OID, X500, and custom namespace
- ULID generation (time-ordered, Crockford base32)
- Nano ID with configurable alphabet and size
- Bulk generation up to 1000 IDs
- Output format: lowercase, uppercase, braces `{}`, base64
- UUID inspector: version, variant (RFC 4122 / NCS / Microsoft / Reserved), embedded timestamp for v1/v7

## Pure logic (`src/lib`)
- `uuid.ts` - exports `uuidV4`, `uuidV7`, `uuidV1`, `uuidV3Impl`, `uuidV5`, `generateNameBased`, `ulid`, `nanoid`, `inspectUuid`, `applyOptions`, `applyOutputFormat`, `formatBulk`, `generateBatch`, `UUID_NAMESPACES`; all crypto via `crypto.getRandomValues` and `SubtleCrypto`; no external dependencies

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_uuid_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/uuid
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/uuid/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), building this app with `--base=/uuid/` into `dist/uuid/`. Umami analytics are injected at build from repo-root `umami-ids.txt`.

## Tech notes
- v7 embeds a 48-bit Unix millisecond timestamp in bytes 0-5 (big-endian) per RFC 9562; remaining bits are random
- v1 uses a random node ID (browsers have no MAC address access) and a per-process clock sequence to guarantee monotonicity within the same millisecond
- v3/v5 use `SubtleCrypto.digest` for MD5 and SHA-1 respectively; version and variant bits are set per RFC 4122 after hashing
- ULID encodes a 48-bit timestamp + 80 random bits in Crockford base32 (26 chars); monotonically ordered within the same millisecond
