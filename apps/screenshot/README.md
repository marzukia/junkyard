# screenshot

Frame shots with bg, padding, shadow. Replaces shots.so. 100% client-side (no server, no upload, no account).

Drop or paste any screenshot and wrap it in a styled frame for sharing. Choose from gradient presets, solid colours, or a custom background image; adjust padding, corner radius, drop shadow, and optionally overlay a macOS traffic-light chrome or browser address bar. Export at 1x, 2x, or 3x in PNG or JPEG.

## Features
- 16 gradient presets (Ocean, Dusk, Midnight, Lavender, Ember, Mint, Slate, Rose, Sunrise, Forest, Denim, Peach, Plum, Steel, Charcoal, Copper)
- Solid colour and custom background image modes
- Adjustable padding, corner radius (for the screenshot), and shadow size (none/soft/medium/heavy)
- macOS window chrome (traffic lights) and browser chrome (address bar) overlays
- Export scale: 1x, 2x, 3x
- Export format: PNG or JPEG

## Pure logic (`src/lib`)
- `src/beautifier.ts` - exports `GRADIENT_PRESETS`, `BRAND_SOLIDS`, and `BeautifySettings` type; pure settings/preset data with no DOM side-effects

Browser-only (canvas rendering in `renderer.ts`); not exposed over MCP.

## Local dev
```bash
cd apps/screenshot
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/screenshot/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/screenshot/` into `dist/screenshot/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- All canvas drawing lives in `renderer.ts`; `beautifier.ts` is the pure settings layer with no DOM dependency
- Export at 2x internally; final scale multiplier is applied on top for crisp output at all export sizes
- Background image mode accepts an object URL; not persisted to localStorage to avoid quota issues
