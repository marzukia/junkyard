# colours

Gradients, palettes & contrast. Replaces Coolors. 100% client-side (no server, no upload, no account).

Generate stepped colour gradients with LAB/RGB/HSL interpolation, build harmonious palettes with seed-based generation, check WCAG contrast ratios, simulate colour-blindness, and export swatches as hex/CSS. Shareable links encode state in the URL.

## Features
- Two-point and three-point stepped gradient generator (LAB default, RGB, HSL interpolation via culori)
- Palette generator: seed-based harmonious colour sets with coolors-style interface
- Shareable URL encoding for gradient and palette state
- WCAG contrast ratio checker (relative luminance, AA/AAA pass/fail)
- Colour-blindness simulation (CVD modes)
- Image colour extraction
- Copy hex / CSS gradient output
- Export swatches
- Palette and gradient state persisted to localStorage

## Pure logic (`src/lib`)
- `color.ts` -- `normalizeHex`, `interpolateTwo` (2-stop gradient), `interpolateThree` (3-stop gradient), `toCssGradient`; uses culori for LAB/RGB/HSL interpolation
- `contrast.ts` -- WCAG relative luminance and contrast ratio calculations
- `cvd.ts` -- colour-vision deficiency simulation matrices
- `palette.ts` -- seed-based palette generation
- `export.ts` -- swatch and CSS export helpers
- `share.ts` -- URL state encoding/decoding
- `localStorage.ts` -- persistence helpers
- `imageExtract.ts` -- dominant-colour extraction from image pixels
- `useUrlSync.ts` -- React hook wiring URL params to app state

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_colours_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/colours
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/colours/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/colours/` into `dist/colours/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Colour math uses culori's `interpolate()` in the requested colour space (LAB default)
- For three-point gradients the two segments are weighted so the mid colour lands on an exact step when step count allows
- WCAG band text contrast determined by relative luminance threshold (>=0.179 -> black text, else white)
- culori is the only colour-math dependency; no canvas required for gradient generation
