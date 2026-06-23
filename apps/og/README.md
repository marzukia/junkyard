# og

Social share cards, 1200x630. Replaces Vercel OG. 100% client-side (no server, no upload, no account).

Design Open Graph images, Twitter cards, and social share banners at the standard 1200x630px size. Choose from layout presets (centered, left-aligned, brand), solid or gradient backgrounds, font presets, badge text, logo upload, and background image with opacity. Export as PNG directly from the browser.

## Features
- Canvas-based 1200x630 image rendering
- Layout options: centered, left, brand
- Background: solid colour or gradient with configurable angle
- Font presets: Inter, Mono, Serif
- Title, subtitle, and badge fields
- Logo image upload with configurable size
- Background image overlay with opacity control
- Named templates (dark, brand, and more)
- Export as PNG

## Pure logic (`src/lib`)
- `src/ogLogic.ts` -- `OgConfig` type, `DEFAULT_CONFIG`, `TEMPLATES` registry, layout/background type enums; render functions are canvas-side in the component layer

Browser-only (canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/og
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/og/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/og/` into `dist/og/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- All rendering is done on an offscreen `<canvas>` at 2x device-pixel ratio for sharp exports
- Gradient backgrounds are drawn via `CanvasRenderingContext2D.createLinearGradient` with the configured angle
- `store.ts` holds reactive OG config; `theme.ts` provides shared design tokens
