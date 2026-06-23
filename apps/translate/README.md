# translate

200 languages, on your device. Replaces DeepL. 100% client-side (no server, no upload, no account).

Translate text between 200+ languages entirely in your browser using an on-device neural machine translation model. Auto-detect the source language from script and diacritic heuristics. Long inputs are split into chunks and translated in sequence with per-chunk progress. The model downloads once (~600 MB) and is cached thereafter.

## Features
- 200 languages using NLLB BCP-47 codes (FLORES-200 script suffixes)
- Auto-detect source language from script (Cyrillic, Arabic, Devanagari, CJK, Thai, Hangul, etc.) and diacritic heuristics (German umlauts, French cedilla/accents)
- Chunked translation for long inputs with per-chunk progress indicator
- Model download progress display
- Input character limit enforced before translation; hard max prevents runaway inputs
- Swap source and target languages

## Pure logic (`src/lib`)
- `translator.ts` - `loadTranslator` (loads `Xenova/nllb-200-distilled-600M` via transformers.js, single-threaded WASM), `translate`, `detectLanguage`; forces `numThreads=1`
- `languages.ts` - `LANGUAGES` (200-entry NLLB language list), `findLanguage`, `validateLanguagePair`, `splitIntoChunks`, `DETECT_CODE`, `DEFAULT_SOURCE`, `DEFAULT_TARGET`, `MAX_INPUT_CHARS`, `HARD_MAX_CHARS`

Browser-only (on-device model via transformers.js ONNX WASM); not exposed over MCP.

## Local dev
```bash
cd apps/translate
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bun run test             # vitest
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/translate/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/translate/` into `dist/translate/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Model: `Xenova/nllb-200-distilled-600M` (~600 MB); all 200 FLORES-200 language codes are supported
- `numThreads` forced to 1 before ONNX session creation; no SharedArrayBuffer required
- `detectLanguage` uses Unicode script range checks and known diacritic patterns; it is a heuristic, not a full langdetect model
- `splitIntoChunks` breaks on paragraph or sentence boundaries to avoid mid-sentence cuts; translated chunks are joined with a space
