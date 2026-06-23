# diff

Compare two texts, every change. Replaces diffchecker. 100% client-side (no server, no upload, no account).

Compare two texts or code files side-by-side or inline with line and word-level highlighting. Supports ignore-whitespace and ignore-case normalisation, unified patch export, and word-level change statistics. No signup, no upload.

## Features
- Side-by-side and inline diff views
- Line-level diff with word-level highlighting within changed lines
- Ignore whitespace option (collapses runs of whitespace per line before comparing)
- Ignore case option
- Unified patch export (standard diff format)
- Word-level change statistics (added/removed word counts)
- Line number display
- Copy result to clipboard

## Pure logic (`src/lib`)
- `diff.ts` -- `normaliseForCompare` (ignore-whitespace and ignore-case pre-processing), `wordDiff` (paired left/right word token arrays using the `diff` npm library), `wordDiffSingle` (single-side token array for inline view), `computeDiff` (full side-by-side + inline line objects with stats), `buildUnifiedPatch` (unified patch string via `diff.structuredPatch`), `wordLevelStats`; wraps `diff` npm package's `diffWords`, `diffWordsWithSpace`, `structuredPatch`

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_diff_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/diff
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/diff/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/diff/` into `dist/diff/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Wraps the `diff` npm package for LCS-based diffing; all type shaping and normalisation is in pure `diff.ts`
- `normaliseForCompare` processes per-line (not whole-text) for whitespace collapse, so line boundaries are preserved
- Display always uses the original (non-normalised) text so highlights remain accurate at the line level
- `wordDiffSingle` is a projection of the paired `wordDiff` result for single-pane inline rendering
