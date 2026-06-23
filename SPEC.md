# marzukia free-tools fleet — shared build spec

Every tool is a standalone client-side web app, brand-consistent with **colours** (the reference, at `/home/planky/projects/colours` — read its `src/styles.css`, `src/main.tsx`, `index.html`, `.github/workflows/deploy-pages.yml`, `public/` for the EXACT design system, SEO, and deploy pattern). Match it precisely.

## Stack (identical for every tool)
Vite + React 18 + TypeScript (strict, pure TS) + **Mantine v7** + **Zustand** + **Biome** (lint+format). Node 22.

## Shared kit
Phase 1 produces a vendored kit at `/home/planky/projects/_fleet/kit/` (theme, brand tokens, `BrandMark`, `Header`/`Footer`/`ThemeToggle`, an `SeoHead` doc + `index.html` template with the identity-graph JSON-LD, the no-flash colour-scheme script, the Umami snippet, `deploy-pages.yml`, biome/tsconfig/vite configs). Each tool **copies the kit** then builds its tool logic on top. (We extract this into a real `@marzukia/ui` npm package later — for now it's vendored so the parallel builds don't bottleneck on package publishing.)

## Design system (copy from colours exactly)
- Fonts: **Inter** (headings 800) + **JetBrains Mono** (numbers/code/hex). Via @fontsource.
- Brand palette: teal `#2f9d8d`, amber `#e8b04b`, coral `#d9594c`. Mantine `primaryColor: teal`, `defaultRadius:"md"`.
- CSS vars (light+dark): `--canvas/--surface/--surface-sunken/--ink/--ink-mid/--ink-faint/--rule/--accent/--accent-ink/--shadow-card/--radius`. Near-white canvas light, clean near-black dark. Soft-shadow rounded cards, rounded pill toggles, generous whitespace. Liminal/clean — NOT generic-AI.
- **System colour-scheme by default**: `MantineProvider defaultColorScheme="auto"` + the no-flash inline script (fallback "auto", reads `mantine-color-scheme-value`). A System/Light/Dark `ThemeToggle` in a top utility row.
- **iOS-safe inputs**: `@media (pointer: coarse) { input { font-size: 16px !important } }` (no focus-zoom).
- Responsive; mobile-first usable.

## Brand logo per tool (minimalist, brand palette)
A distinct minimalist glyph in the teal/amber/coral family (same spirit as colours' 3-square mark — geometric, flat, rounded corners), unique per tool but clearly the same family. Produce:
- `public/favicon.svg` (the glyph)
- a title BrandMark (inline SVG) shown left of the tool name in the header
- `public/og.png` (1200×630 banner, colours-banner style: near-white, bold Inter title + the glyph + a strip of brand colour, `<slug>.mrzk.io`) — render via Playwright/chromium from /tmp.

## SEO (clean + piggyback the paywalled incumbents)
Static in `index.html` `<head>`:
- `<title>` + meta description + keywords TARGETING the incumbent's terms + the privacy angle (e.g. "X alternative", "free X", "X no signup", "runs in your browser / no upload / private / offline"). Per-tool terms below.
- `<html lang="en">`, `<meta name="author" content="Andryo Marzuki">`, `<meta name="robots" content="index,follow">`, `<link rel="canonical" href="https://<slug>.mrzk.io/">`, `<link rel="author" href="https://mrzk.io">`, theme-color (light+dark), favicon link.
- Open Graph (og:type/site_name/title/description/url `https://<slug>.mrzk.io/`/image `https://<slug>.mrzk.io/og.png`/image:width 1200/height 630/alt) + Twitter summary_large_image.
- **JSON-LD `@graph`**: a `Person` `@id:"https://mrzk.io/#person"` name "Andryo Marzuki" url https://mrzk.io `sameAs:["https://github.com/marzukia","https://www.linkedin.com/in/andryomarzuki/"]`; a `WebApplication` (name, url, description, applicationCategory, offers price 0, featureList, `author:{"@id":"https://mrzk.io/#person"}`). IDENTICAL Person @id everywhere — this unifies the entity for name-SEO.
- A real `<h1>` with the tool name.
- `public/robots.txt` (allow all + Sitemap pointer) and `public/sitemap.xml` (`https://<slug>.mrzk.io/`).
- A subtle footer: "Made by Andryo Marzuki" → mrzk.io, plus a small cross-link to colours.mrzk.io (sibling tool).

## Umami analytics
In `<head>`: `<script defer src="https://umami.junkyard.sh/script.js" data-website-id="__UMAMI_ID__"></script>` — leave the literal `__UMAMI_ID__` placeholder; the orchestrator swaps the real id per tool after creating its Umami site.

## Deploy (GitHub Pages)
- `.github/workflows/deploy-pages.yml` — copy colours' (build → upload-pages-artifact → deploy-pages on push to main; permissions pages/id-token; ubuntu-latest, node 22).
- `public/CNAME` containing `<slug>.mrzk.io` (one line).
- Vite `base:"/"` (custom-domain root).

## Validation (REQUIRED per tool — paste outputs)
`npx biome ci src/` (0) · `npx tsc --noEmit` (0) · `npm run test` (pass) · `npm run build` (ok). After build confirm `dist/` has CNAME (=`<slug>.mrzk.io`), og.png (1200×630), robots.txt, sitemap.xml, favicon.svg, and index.html canonical/og/JSON-LD all point to `<slug>.mrzk.io`. Take a Playwright screenshot of the running app to `/home/planky/projects/_fleet/shots/<slug>.png`.

## Git (per tool, local only — DO NOT push)
Each tool in its own dir `/home/planky/projects/_fleet/tool-<slug>/`. `git init`, identity `Andryo Marzuki <42439397+marzukia@users.noreply.github.com>`, commit `feat: <slug> — <one-liner>`. Do NOT push (orchestrator creates repos + deploys).

## Quality bar
Each tool must actually WORK (real client-side logic, no fake/stub), be genuinely useful, brand-consistent, accessible (labels/aria/focus), and have a few real unit tests for its core pure logic. Tools are single-page, no routing.
