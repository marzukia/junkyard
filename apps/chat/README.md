# chat

An LLM running in your browser. Replaces ChatGPT. 100% client-side (no server, no upload, no account).

Chat with Llama-3.2-1B-Instruct running entirely in your browser via WebLLM and WebGPU. No API key, no server, works offline after first load. Model is cached in the browser after the initial ~700 MB download.

## Features
- Llama-3.2-1B-Instruct-q4f16_1-MLC (~700 MB) via `@mlc-ai/web-llm`
- WebGPU inference (no COOP/COEP headers required, GitHub Pages compatible)
- Streaming token output with abort-mid-generation support
- Editable system prompt (persisted to localStorage)
- Conversation export as markdown
- Download progress bar with ETA estimate
- WebGPU availability check before attempting load
- Lightweight custom markdown renderer (fenced code, bold, italic, lists, headers) -- no external markdown dep in the renderer path

## Pure logic (`src/lib`)
- `llmEngine.ts` -- `loadEngine` (WebLLM `CreateMLCEngine` wrapper), `streamChat` (streaming completion with abort), `abortGeneration`, `isEngineLoaded`, `MODEL_ID`, `MODEL_SIZE_LABEL`
- `chatHelpers.ts` -- `formatBytes`, `formatEta`, `formatProgress`, `exportConversation` (markdown serialisation), `buildSystemPrompt`, `trimMessage`, `hasWebGpu`
- `renderMarkdown.ts` -- dependency-free markdown-to-HTML renderer covering the subset LLM responses use (fenced code blocks with `data-lang`, inline code, bold, italic, unordered/ordered lists, ATX headers h1-h3, paragraph breaks); HTML-escapes input before processing

Browser-only (WebGPU bound); not exposed over MCP.

## Local dev
```bash
cd apps/chat
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/chat/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/chat/` into `dist/chat/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- WebLLM is dynamically imported so the initial bundle stays small; the engine loads on user demand
- WebGPU does not require SharedArrayBuffer, so no special headers are needed on GitHub Pages
- System prompt and conversation state persist in a Zustand store backed by localStorage
- Tagged `webgpu` and `large-download`
