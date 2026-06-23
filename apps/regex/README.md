# regex

Live matches, groups & explanation. Replaces regex101. 100% client-side (no server, no upload, no account).

Test regex patterns live against any input string, highlight all matches and capture groups, toggle flags (g, i, m, s, u), see a plain-English explanation of the pattern, and preview replacements. Includes a library of common patterns and code export to JavaScript, Python, and other languages.

## Features
- Live match highlighting with per-match and per-group spans
- Capture group extraction with named and indexed group support
- Flag toggles: global, case-insensitive, multiline, dotall, unicode
- Plain-English pattern explanation
- Replacement preview with substitution reference syntax
- Common patterns library (email, URL, date, phone, etc.)
- Code export to multiple languages (JS, Python, Go, etc.)
- Structured error reporting for invalid patterns

## Pure logic (`src/lib`)
- `regex.ts` - exports `execRegex` (structured match result), `execReplace`, `explainPattern`, `generateCodeExport`, `buildFlagString`, `COMMON_PATTERNS`, `SUBSTITUTION_REFS`, format helpers for copy output

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_regex_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/regex
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/regex/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/regex/` into `dist/regex/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Uses the native browser `RegExp` engine via `matchAll` - no external regex library
- `execRegex` always adds the `g` flag internally so `matchAll` can iterate; the flag set the caller sees is preserved separately
- Pattern explanation is a hand-rolled token parser, not an external lib
