# css

Shadow, gradient, glass & easing. Replaces cssgradient. 100% client-side (no server, no upload, no account).

Generate CSS with live preview and copyable output across four tools: box shadow, linear/radial/conic gradients, glassmorphism, border radius, cubic-bezier easing, and CSS transforms/transitions.

## Features
- Box shadow builder: offset X/Y, blur, spread, color (hex + opacity), inset toggle; multiple shadow stacking
- Linear gradient: angle, multi-stop color picker, sorted by position
- Radial gradient: circle/ellipse shape, center position, multi-stop
- Conic gradient builder
- Glassmorphism generator: blur, saturation, opacity, border, background
- Border radius: individual corners with 2/3/4-value CSS shorthand
- Cubic-bezier easing curve builder with animation preview
- CSS transform builder: translate, rotate, scale, skew
- CSS transition rule builder
- Live CSS output with one-click copy

## Pure logic (`src/lib`)
- `css.ts` -- `hexToRgba` (3/6-digit hex to rgba with clamped opacity), `isValidHex`, `buildBoxShadow`/`buildBoxShadowRule`, `buildLinearGradient`/`buildLinearGradientRule`, `buildRadialGradient`/`buildRadialGradientRule`, `buildConicGradient`/`buildConicGradientRule`, `buildGlassCss`, `buildBorderRadiusValue`/`buildBorderRadiusRule` (2/3/4-value shorthand), `buildBezierValue`/`buildBezierRule`, `buildTransformValue`, `buildTransitionRule`, `clamp`

Browser-only (DOM bound); not exposed over MCP.

## Local dev
```bash
cd apps/css
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/css/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/css/` into `dist/css/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- `hexToRgba` handles both 3-digit (`#rgb`) and 6-digit (`#rrggbb`) hex; invalid input falls back to `rgba(0,0,0,alpha)`
- `buildLinearGradient` sorts stops by position before generating the CSS string
- Border radius shorthand collapses to 2-value or 3-value when symmetry allows, matching browser CSS canonicalisation
- Glassmorphism output includes `backdrop-filter: blur(Xpx) saturate(Y%)` plus background with alpha
