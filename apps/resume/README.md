# resume

Build a CV, export to PDF. Replaces Zety. 100% client-side (no server, no upload, no account).

Fill in contact info, summary, experience, education, skills, projects, certifications, and languages. Preview updates live, then download a clean PDF in your chosen template. Import and export the resume as JSON for lossless round-trips. Three visual templates are included: clean (teal accent), compact (slate-blue), and bold (red).

## Features
- Sections: contact, summary, work experience (with bullet points), education, skills, projects, certifications, languages
- Three PDF templates with distinct accent colours and font sizing
- Live HTML preview of the rendered resume
- PDF export via pdf-lib (runs entirely in the browser)
- JSON import/export for save/restore without data loss
- Inline markdown in text fields: **bold**, *italic*, `code`, [links](url)

## Pure logic (`src/lib`)
- `resumeUtils.ts` - `formatDateRange`, `parseSkills`, `hasContactInfo`, `hasExperienceContent`, `hasEducationContent`, `filteredBullets`
- `resumePdf.ts` - pdf-lib PDF generation with template palettes; uses `tokenizeLine` for inline markdown in PDF runs
- `resumeJson.ts` - `exportResumeJson` / `downloadJson` for lossless JSON round-trip
- `mdInline.ts` - tiny inline-markdown tokenizer (bold, italic, code, link); no nesting, first-match-wins

Browser-only (DOM + pdf-lib canvas bound); not exposed over MCP.

## Local dev
```bash
cd apps/resume
npm install
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm test             # vitest
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.mrzk.io/resume/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), building this app with `--base=/resume/` into `dist/resume/`. Umami analytics are injected at build from repo-root `umami-ids.txt`.

## Tech notes
- PDF generation uses `pdf-lib` with `StandardFonts.Helvetica` and `HelveticaBold`; no external font download
- `mdInline.ts` tokenizer is shared between the HTML preview renderer and the PDF run splitter, so bold/italic renders consistently in both outputs
- State is managed by a Zustand store (`useResumeStore`); lib modules receive plain data, no store dependency
