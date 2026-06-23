# subs

Edit, shift & convert .srt/.vtt. Replaces Subtitle Edit. 100% client-side (no server, no upload, no account).

Load an SRT, VTT, ASS, or SBV subtitle file, edit cue text and timings inline, shift all or selected cues by a fixed offset, fix overlapping cues automatically, and download in any of the four supported formats. Includes find-and-replace and linear sync (two-point time correction).

## Features
- Parse and edit SRT, VTT, ASS, and SBV subtitle files
- Inline editing of cue text and start/end timestamps
- Bulk time-shift (all cues or a selected range)
- Linear sync: correct drift by specifying two anchor points
- Overlap fixer: bumps cue end times to eliminate overlaps
- Find-and-replace across all cue text
- Format detection from file extension or content sniffing
- Export to SRT, VTT, ASS, or SBV

## Pure logic (`src/lib`)
- `subtitle.ts` - exports `parseSrt`, `parseVtt`, `parseAss`, `parseSbv`, `serialiseSrt`, `serialiseVtt`, `serialiseAss`, `serialiseSbv`, `serialise` (dispatch), `shiftCues`, `shiftSelected`, `fixOverlaps`, `linearSync`, `findReplace`, `countMatches`, `detectFormat`, `formatTimestampSrt`, `formatTimestampVtt`, `formatTimestampAss`, `parseTimestamp`, `mightContainSubtitles`, `formatExtension`; no DOM/browser deps

Browser-only (file I/O bound); not exposed over MCP.

## Local dev
```bash
cd apps/subs
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/subs/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/subs/` into `dist/subs/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- SRT timestamps use comma separator (`HH:MM:SS,mmm`); VTT uses dot (`HH:MM:SS.mmm`); `parseTimestamp` normalises both
- ASS serialisation emits a minimal `[Script Info]` + `[Events]` structure with `Dialogue` lines
- SBV uses `H:MM:SS.mmm,H:MM:SS.mmm` timing lines (YouTube format); parser and serialiser handle the distinct format
- `linearSync` applies a two-point affine transform across all cue timestamps to correct constant-rate drift
