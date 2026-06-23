# units

Length, weight, temperature & more. Replaces Google. 100% client-side (no server, no upload, no account).

Convert between units across 14 categories: length, mass, temperature, area, volume, speed, data, time, pressure, energy, angle, power, force, and fuel. Instant results, metric and imperial, with common conversions shown alongside the main result.

## Features
- 14 categories: length, mass, temperature, area, volume, speed, data, time, pressure, energy, angle, power, force, fuel
- Temperature handled with full affine transforms (Celsius, Fahrenheit, Kelvin, Rankine)
- Common conversions panel shows related results alongside the main output
- Human-readable result formatting for very large and very small values
- All units defined in a single table with `toBase` factors; consistent round-trip accuracy

## Pure logic (`src/lib`)
- `units.ts` - exports `convert`, `getCommonConversions`, `formatResult`, `formatResultHuman`, `CATEGORIES`; single source of truth for all conversion maths; `CategoryId` and `UnitDef` types; temperature is special-cased for affine (offset + scale) transforms

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_units_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/units
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/units/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/units/` into `dist/units/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Base-unit strategy: every unit stores a `toBase` factor (value * toBase = base unit value); conversion is `value * fromUnit.toBase / toUnit.toBase`
- Temperature is handled separately because it requires an affine transform (offset then scale), not just a scale factor
- The React layer (App.tsx, store) never performs raw arithmetic; it calls `convert()` and `getCommonConversions()` only
- `convert()` throws for unknown unit IDs, allowing callers to surface errors explicitly
