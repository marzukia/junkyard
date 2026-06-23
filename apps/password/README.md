# password

Strong, random passwords. Replaces 1Password. 100% client-side (no server, no upload, no account).

Generate cryptographically random passwords with configurable length, character sets, and ambiguous-character exclusion. Switch to passphrase mode to build memorable multi-word phrases from a curated word list. An entropy meter shows real strength in bits and a label (Weak to Very Strong).

## Features
- Random password mode: configurable length, uppercase, lowercase, digits, symbols
- Exclude visually ambiguous characters (0/O, 1/l/I, etc.)
- Minimum digits and minimum symbols guarantees
- Passphrase mode: configurable word count, separator, capitalisation, appended number
- Entropy meter: calculated bits of entropy + label (Weak / Fair / Good / Strong / Very Strong)
- `crypto.getRandomValues` for all randomness; rejection-sampling for uniform distribution

## Pure logic (`src/lib`)
- `src/lib/password.ts` -- `generatePassword()`, `generatePassphrase()`, `calcEntropy()` returning `StrengthResult`; `randomPick()` and Fisher-Yates shuffle both use `crypto.getRandomValues`
- `src/lib/wordlist.ts` -- curated word list for passphrase generation

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_password_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/password
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/password/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/password/` into `dist/password/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Rejection-sampling in `randomInt(max)` avoids modulo bias: values in the bias region of the `Uint32Array` range are discarded and re-drawn
- Fisher-Yates shuffle uses the same `randomInt` primitive so character ordering is uniformly distributed
- Ambiguous character exclusion uses pre-built sets (`UPPER_UNAMBIGUOUS`, etc.) rather than runtime filtering
