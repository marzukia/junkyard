# colours

A stepped-gradient generator. Two generators on one page: 2-point (start→end) and 3-point (start→mid→end). Produces perceptually even color swatches using CIELAB interpolation via culori.

## Stack

- Vite + React 18 + TypeScript (strict)
- Mantine v7 (heavily re-themed)
- Zustand (app state)
- culori (color math — LAB/RGB/HSL interpolation)
- Biome (lint + format)

## Dev

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview production build
npx biome ci src/    # lint + format check
npx tsc --noEmit     # type check
```

## Deploy

The app is deployed via GitHub Pages at `https://colours.mrzk.io`. Push to `main` triggers the `.github/workflows/deploy-pages.yml` workflow which builds and publishes automatically.

The `Dockerfile`, `docker-compose.prod.yml`, and `nginx.conf` in the repo root are the legacy hydrogen/traefik deploy artefacts — left in place but no longer the canonical deploy path.

## Tech notes

- Color interpolation uses culori's `interpolate()` in the requested color space (LAB default, RGB, HSL).
- For 3-point gradients, the two segments are weighted proportionally so the middle color lands on an exact step when the step count allows.
- Band text contrast is determined by WCAG relative luminance (≥0.179 threshold → black text, else white).
