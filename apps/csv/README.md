# csv

Convert CSV to JSON and back. Replaces convertcsv. 100% client-side (no server, no upload, no account).

Paste or upload CSV/JSON, get automatic delimiter detection (comma, tab, semicolon, pipe), a sortable table preview, and download in multiple output formats. Converts in both directions: CSV to JSON/Markdown/SQL/XML/YAML, and JSON arrays back to CSV.

## Features
- Auto-detects delimiter: comma, tab, semicolon, pipe (scored by consistency across first 5 lines)
- RFC 4180 quoted field parsing with embedded delimiters, double-quote escaping, and embedded newlines
- Sortable table preview with column type coercion display
- CSV to JSON (array of objects or array of arrays)
- CSV to Markdown table
- CSV to SQL INSERT statements (configurable table name)
- CSV to XML
- CSV to YAML
- JSON array to CSV (with header inference)
- Ragged-row warnings (mismatched column count)
- Column label generation beyond Z (AA, AB...) for headerless input
- Paste or file upload input

## Pure logic (`src/lib`)
- `csv.ts` -- `detectDelimiter`, `splitCsvRows` (RFC 4180 parser with quoted-field state machine), `parseCsv`, `csvToJson`, `csvToMarkdown`, `csvToSql`, `csvToXml`, `csvToYaml`, `jsonToCsv`, `csvEscape`, `coerceValue`, `ConvertResult` type, `RaggedRowWarning`

**MCP:** headless-safe; exposed via `@junkyard/core` as `junkyard_csv_*` (see `packages/mcp-server`).

## Local dev
```bash
cd apps/csv
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/csv/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/csv/` into `dist/csv/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- Delimiter scoring: for each candidate, count occurrences per line in the first 5 lines and score by consistency (variance minimisation); ties broken by candidate order (comma first)
- `splitCsvRows` is a state machine that handles embedded delimiters, `""` quote escaping, and embedded newlines inside quoted fields
- `coerceValue` attempts number/boolean coercion for JSON output; returns string otherwise, handles scientific notation
- `jsonToCsv` expects an array of objects; rejects arrays of primitives with a `ConvertFailure`
