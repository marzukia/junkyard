# cron

Build & decode cron schedules. Replaces crontab.guru. 100% client-side (no server, no upload, no account).

Edit minute/hour/day/month/weekday fields with instant human-readable descriptions and next-run previews. Supports @-macros (@daily, @hourly, etc.), 6-field Quartz detection, timezone selection, and preset schedules.

## Features
- 5-field unix cron expression editor (minute, hour, DOM, month, DOW)
- @-macro support: @yearly, @annually, @monthly, @weekly, @daily, @midnight, @hourly
- 6-field Quartz-style expression detection
- Per-field validation: ranges, steps, lists, range/step combos
- Human-readable description generation (special-casing weekdays, weekends, etc.)
- Next-run preview (configurable count) with timezone support (IANA tz list)
- Preset schedules picker
- Copy expression to clipboard

## Pure logic (`src/lib`)
- `cron.ts` -- `expandMacro`, `macroLabel`, `expressionToFields`, `fieldsToExpression`, `splitExpression`, `validateField`, `validateFields`, `describeCron`, `describeRaw`, `fieldLabel`, `nextRuns`, `formatRunTime`, `isQuartzSixField`, `CRON_MACROS`, `PRESETS`, `FIELD_ORDER`, `TZ_OPTIONS`, `getLocalIanaTz`, `resolveTzLabel`

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_cron_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/cron
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bun run test             # vitest
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/cron/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/cron/` into `dist/cron/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- All cron logic is pure TypeScript with no external dependencies; next-run calculation uses native `Date` with IANA timezone support via `Intl`
- DOM and DOW both restricted uses OR semantics per standard unix cron
- @reboot is intentionally excluded from macros (no meaningful next-run preview)
- Quartz 6-field detection is informational only; the editor works with 5-field expressions
