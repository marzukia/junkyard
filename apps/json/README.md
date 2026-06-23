# json

Format, validate & minify JSON. Replaces jsonformatter. 100% client-side (no server, no upload, no account).

Paste or type JSON to instantly format it with configurable indentation, minify it, or validate it with precise error locations (line and column). Explore the structure in a collapsible tree view. All processing runs locally; the text never leaves the browser.

## Features
- Format with 2-space, 4-space, or tab indentation
- Minify to compact single-line output
- Validate with line + column error location extracted from the native SyntaxError
- Collapsible tree view with object/array counts and value type colouring
- Copy formatted or minified output to clipboard

## Pure logic (`src/lib`)
- `src/lib/json.ts` -- `parseJson()` with structured `ParseError` (line/col), `formatJson()`, `minifyJson()`, `buildTree()` producing a `TreeNode` AST for the collapsible view; no DOM dependency

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_json_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/json
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/json/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/json/` into `dist/json/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Error location extraction tries two V8 message patterns ("at line N column M" and "at position N") so it degrades gracefully on non-V8 engines
- Tree building is recursive; large documents with deeply nested arrays can be collapsed to avoid rendering overhead
