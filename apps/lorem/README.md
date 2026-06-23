# lorem

Placeholder text and images. Replaces lipsum. 100% client-side (no server, no upload, no account).

Generate lorem ipsum placeholder text as paragraphs, sentences, words, or bullet lists. Create custom placeholder images at any pixel dimensions with configurable background colour, text colour, and label -- rendered client-side as SVG or PNG. Both tools run entirely offline.

## Features
- Text output modes: paragraphs, sentences, words, lists
- Always starts with the classic "Lorem ipsum dolor sit amet..." opening sentence
- Custom paragraph and sentence counts
- Placeholder image generator: any width x height, background colour, text colour, optional label
- Image format choice: SVG (vector, tiny file) or PNG (rasterised)
- Copy-to-clipboard for text; download for images

## Pure logic (`src/lib`)
- `src/lib/lorem.ts` -- `CLASSIC_START` constant, `WORDS` corpus from the full Cicero passage, `generateParagraphs()`, `generateSentences()`, `generateWords()`, `generateList()`; no DOM dependency

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_lorem_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/lorem
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/lorem/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/lorem/` into `dist/lorem/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- SVG placeholder images are generated as data URIs; PNG images are drawn on an offscreen canvas and exported via `toDataURL`
- Word corpus extends the classic 20-word Lorem ipsum with the broader Cicero vocabulary for more varied longer outputs
