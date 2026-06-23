# timestamp

Unix epoch to human dates. Replaces epochconverter. 100% client-side (no server, no upload, no account).

Convert Unix timestamps (seconds or milliseconds) to human-readable dates in multiple formats, or convert a date string back to an epoch. Shows ISO 8601, RFC 2822, RFC 3339, UTC, local, relative time, day of week, week of year, day of year, and leap year status. Also supports batch conversion and diff calculation between two timestamps.

## Features
- Auto-detect seconds vs milliseconds input
- Output: ISO 8601, RFC 2822, RFC 3339, UTC string, local string, timezone string, hex
- Relative time with pluralized labels (seconds, minutes, hours, days, weeks, months, years)
- Date-to-epoch conversion from an arbitrary date string
- Custom format tokens (YYYY, MM, DD, HH, mm, ss, YY, MMM, MMMM, dddd, Z)
- Batch conversion: paste a list of timestamps, get a table of results
- Diff calculator: compute the interval between two timestamps broken down into years, months, days, hours, minutes, seconds
- Day of year, ISO week number, leap year detection

## Pure logic (`src/lib`)
- `timestamp.ts` - exports `convertEpoch`, `detectUnit`, `parseEpochString`, `relativeTime`, `toRfc2822`, `applyCustomFormat`, `batchConvert`, `dateStringToEpoch`, `parseDiffInput`, `computeDiff`, `dayOfYear`, `isoWeekNumber`, `isLeapYear`; pure date arithmetic, no DOM

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_timestamp_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/timestamp
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/timestamp/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), building this app with `--base=/timestamp/` into `dist/timestamp/`. Umami analytics are injected at build from repo-root `umami-ids.txt`.

## Tech notes
- Seconds vs milliseconds detection threshold: values >= 1e12 (absolute value) are treated as milliseconds
- `computeDiff` performs month-boundary-aware arithmetic (not a naive division)
- No `Intl.RelativeTimeFormat` dependency; relative time is hand-computed for consistent output across all browsers and in headless MCP context
