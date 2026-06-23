# invoice

Fill & export an invoice PDF. Replaces invoice-generator. 100% client-side (no server, no upload, no account).

Create professional invoices with line items, quantity, unit price, tax rate, discount, shipping, and partial payment tracking. Add a logo, choose currency, and export a clean PDF. All data stays in your browser; nothing is sent anywhere.

## Features
- Line items with quantity and unit price; totals auto-calculated
- Tax rate, discount percentage, shipping, and amount-paid fields
- Logo upload (embedded in the PDF)
- Currency selector covering major world currencies (USD, EUR, GBP, AUD, and more)
- Export to PDF via pdf-lib; clean single-page layout
- Invoice number, date, due date, from/to billing fields, and notes

## Pure logic (`src/lib`)
- `src/lib/invoiceCalc.ts` -- `calcTotals()` for subtotal/discount/tax/shipping/balance; `formatMoney()` via `Intl.NumberFormat`; `CURRENCIES` list
- `src/lib/invoicePdf.ts` -- PDF assembly using pdf-lib (browser-side, no server)

Browser-only (PDF generation is DOM/canvas assisted); not exposed over MCP.

## Local dev
```bash
cd apps/invoice
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/invoice/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/invoice/` into `dist/invoice/`. Umami analytics are injected at build from the repo-root `umami-ids.txt` (no hardcoded script tag).

## Tech notes
- PDF built with `pdf-lib` running entirely in the browser (no server-side rendering)
- `formatMoney` falls back to `${currency} ${amount.toFixed(2)}` for unrecognised ISO codes so the UI never crashes on exotic inputs
- Invoice state managed via a Zustand-style store in `src/store/useInvoiceStore.ts`
