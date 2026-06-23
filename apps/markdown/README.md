# markdown

Write Markdown with live preview. Replaces StackEdit. 100% client-side (no server, no upload, no account).

A split-pane editor where the left side accepts Markdown and the right side shows rendered HTML in real time. Supports GitHub Flavoured Markdown including tables, strikethrough, and task lists. Export the rendered HTML or copy it to clipboard. A word/character/line counter updates as you type.

## Features
- Live split-pane Markdown-to-HTML preview
- GitHub Flavoured Markdown (GFM): tables, strikethrough, task-list checkboxes
- Toolbar shortcuts: bold, italic, headings, links, inline code, code block
- Export rendered HTML to a `.html` file or copy to clipboard
- Word, character, and line count displayed live
- XSS-safe: all rendered output is sanitized via DOMPurify before insertion

## Pure logic (`src/lib`)
- `src/lib/markdown.ts` -- `renderMarkdown()` (marked + DOMPurify pipeline), `WordStats` type, `countWords()` counter; DOMPurify is bypassed in non-browser environments so the render function is safe to call from the MCP server

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_markdown_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/markdown
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/markdown/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/markdown/` into `dist/markdown/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- DOMPurify allowlist explicitly permits `<input type="checkbox" disabled>` so GFM task-list checkboxes render correctly without opening a script-injection vector
- `renderMarkdown()` checks `typeof window === "undefined"` and returns unsanitized marked output in that case; the MCP server therefore only consumes this in trusted server-side contexts where XSS is not a concern
- `marked` is configured with `gfm: true, breaks: false` -- soft line breaks do not create `<br>` elements
