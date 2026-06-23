# junkyard — handover notes

_Last updated: 2026-06-23. Maintainer: Andryo Marzuki (@marzukia, mrzk.io)._

## What this is

**junkyard** is the consolidated home for a fleet of **42 free, 100% client-side web tools** that were "salvaged from behind paywalls." Every tool runs entirely in the browser (no server, no upload, no account) and clones a paid/ad-heavy incumbent. The pitch: a scrapyard of tools, dumped out for anyone to grab.

This monorepo is the **new source of truth**. Each tool is *currently* still deployed from its own individual `marzukia/<slug>` repo to GitHub Pages at `<slug>.mrzk.io` (see Deployment). The plan is to migrate to **one server that hosts all tools and exposes them over MCP** (see "Next phase"). For now this repo consolidates all the source + this handover.

## Repo layout

```
junkyard/
  apps/<slug>/        # the 42 tool apps (Vite + React 18 + TS + Mantine + Zustand + Biome)
  kit/                # shared design-system kit (theme.ts, styles.css, Footer/Header/BrandMark/ThemeToggle)
  hub/                # junkyard.sh landing page (single-file HTML prototype, the "front door")
  SPEC.md             # the original build spec every tool follows (stack, design, SEO, deploy, git rules)
  umami-ids.txt       # slug -> Umami website-id mapping (self-hosted analytics)
  HANDOVER.md         # this file
```

Each `apps/<slug>/` is a full standalone Vite app: `src/`, `public/` (CNAME, favicon.svg, og.png/og-dark.png, robots.txt, sitemap.xml), `index.html` (SEO meta + Person JSON-LD + Umami script), `package.json`, `vite.config.ts`, `.github/workflows/deploy-pages.yml`. `node_modules`/`dist` are gitignored — run `npm install` per app.

## The 42 tools

Live at `https://<slug>.mrzk.io`. Categories used in the hub: **image/media · text/code · ai · docs/utility**.

**Image & media:** convert (image converter, TinyPNG), qr (QR codes), ocr (image→text), og (OG image gen), exif (EXIF viewer/stripper), favicon, bg (background remover, on-device AI), collage (photo collage maker), screenshot (beautifier, shots.so), meme (imgflip), crop (cropper/resizer), svg (SVGO optimizer), gif (GIF maker).
**Text & code:** json (formatter), diff (text diff), markdown (editor), base64, regex (tester, regex101), css (toolkit: shadow/gradient/glass/easing), csv (CSV↔JSON), timestamp (epoch converter), uuid, hash (MD5/SHA), jwt (decoder), lorem (ipsum + placeholders).
**In-browser AI** (transformers.js single-thread WASM / WebLLM, no COOP/COEP needed): transcribe (Whisper), upscale (Swin2SR), depth (Depth-Anything-v2), caption (vit-gpt2), translate (NLLB-600M), summarize (distilbart), chat (WebLLM Llama-3.2-1B, needs WebGPU).
**Docs & utility:** pdf (toolkit), subs (subtitle editor), password, units (converter), colours (gradients/palettes), cron (builder), barcode, invoice (→PDF), resume (CV builder→PDF), sign (e-signature on PDF).

## Tech stack + shared kit

- **Per app:** Vite + React 18 + TypeScript (strict) + Mantine v7 + Zustand + Biome. Node 22.
- **Shared kit** (`kit/`, currently *vendored* into each app under `src/` — there is no published `@marzukia/ui` package yet; that extraction is a TODO):
  - `theme.ts` — Mantine theme: `Inter` (UI/headings, 800 weight) + `JetBrains Mono` (mono), teal primary.
  - `styles.css` — CSS-var design tokens, light + dark:
    - light: `--canvas #fafafa`, `--surface #fff`, `--ink #1a2530`, `--accent #2f9d8d`, `--rule #e8eaed`, radius 16px.
    - dark: `--canvas #13171a`, `--surface #1b2126`, `--ink #e9eef1`, `--accent #41b6a6`.
    - includes the `@media (pointer:coarse)` iOS-zoom guard (`input,textarea,select{font-size:16px}`) + 40px theme-toggle tap targets.
  - `Header`, `Footer` (the "more tools" link points to `https://mrzk.io/apps/`), `BrandMark`, `ThemeToggle` (System/Light/Dark).

## Brand

This is an **extension of the mrzk.io brand**, not a separate identity. Owner: **Andryo Marzuki**, site **mrzk.io** (Hugo/Congo blog, green/red/pink logo palette — that's the BLOG brand). The **tools/charted brand** is the **teal #2f9d8d / amber #e8b04b / coral #d9594c** palette (the "brand strip" across the top of every tool banner + card-hover). All tool banners + the hub use this. `charted.mrzk.io` is the polish bar.

## What has been done (quality passes)

Three audits + two build waves + a verification sweep, all multi-agent:
1. **UX/QoL audit** → **round-1 build wave**: every tool got copy-to-clipboard with "copied" toast, settings persistence (localStorage/zustand-persist), example/empty states, loading/progress states, and the systemic mobile fixes (theme-toggle 40px tap targets + textarea/select iOS-zoom guard).
2. **Feature-gap audit** (vs incumbents) + **experience sweep** (real-use friction + edge-bug hunt) → **round-2 build wave**: each tool got its standard category features + edge-bug fixes + `Cmd/Ctrl+Enter` runs the primary action. Highlights: qr WiFi/vCard/email/SMS QR types + contrast warning; convert AVIF + exact/scale resize + file-validation + "saved X%" banner; og meta-tag snippet + title-overflow fix + size presets; ocr PDF input + batch + region-select + confidence highlights; resume markdown + localStorage + (deferred: CV import); jwt (deferred: signature verification); pdf (deferred: rotate/watermark/page-numbers). Per-tool deferrals are noted in each round-2 commit message.
3. **Post-wave-2 QoL sweep** — running at handover time; verifies round-2 features work + flags regressions/remaining gaps. **Check its output and address findings.**

Earlier history (pre-consolidation) is in each tool's individual repo git log + the maintainer's memory.

## junkyard.sh hub (`hub/`)

A **single-file HTML prototype** of the front door (`hub/index.html`). Design: clean extension of the brand (the tool shell + System/Light/Dark toggle + brand strip + charted teal), **split hero** (headline + lead + CTAs + stat pills on the left; a floating "showcase window" previewing featured tools on the right, mirroring charted's chart-in-a-card), a search/filter command bar, tools grouped into yards as cards (`vs ~~incumbent~~` salvage tags), and an "everything's free" manifesto. Light/dark/mobile all done.
**Status: prototype only — NOT productionized or deployed.** TODO: rebuild as a Vite/React app (live tool list driven by a shared manifest, real search), deploy to **junkyard.sh**.

## Analytics

Self-hosted **Umami** at `umami.junkyard.sh` (admin user `andryo`). Each tool's `index.html` loads `https://umami.junkyard.sh/script.js` with its `data-website-id`. The slug→id map is `umami-ids.txt`. (Beware: a tool shipping the literal `__UMAMI_ID__` placeholder = Umami 400 "Invalid UUID"; always inject the real id.)

## Deployment (current)

Each tool deploys independently:
- Push to `main` of `marzukia/<slug>` → `.github/workflows/deploy-pages.yml` builds (`npm ci && npm run build`) and publishes `dist/` to GitHub Pages.
- Custom domain `<slug>.mrzk.io` via `public/CNAME` + the Pages API `cname` (the workflow's `configure-pages@v5` does NOT auto-set the cname from the artifact — it must be PUT once: `gh api -X PUT repos/marzukia/<slug>/pages -f cname=<slug>.mrzk.io`). DNS: wildcard `*.mrzk.io` → `marzukia.github.io`, so no per-subdomain DNS.
- New-repo recipe: `gh repo create marzukia/<slug> --private` → `gh api -X POST repos/.../pages -f build_type=workflow` (Pages must be pre-enabled) → push → PUT cname.
- **OG banners** are generated centrally (Playwright renders an HTML template with the tool's `favicon.svg` inlined + title/tagline). NOTE: never resize the inlined SVG via a `width="..."` regex — it matches `stroke-width` and corrupts the glyph; size via CSS. Banner dark variant must be genuinely dark.

**Git identity:** always commit as `Andryo Marzuki <42439397+marzukia@users.noreply.github.com>` (never the AI/automation account). `gh` is authed as `marzukia` on the `hydrogen` box; push via `git push https://x-access-token:$(ssh hydrogen 'gh auth token')@github.com/marzukia/<repo>.git`.

## Next phase (the actual goal)

**One server hosting all 42 tools + MCP capabilities.** Direction to flesh out:
- A single app/server (the junkyard) that serves the hub at `junkyard.sh` and routes to each tool, instead of 42 separate GH Pages deploys.
- Expose each tool's core logic as an **MCP tool** so the whole fleet is callable by agents (e.g. `junkyard.convert`, `junkyard.qr`, `junkyard.summarize`). Each app already separates pure logic into `src/lib/*` — those are the natural MCP handlers. Browser-only tools (the transformers.js/WebLLM ones) need a server-side inference path or a clearly-scoped "browser-only" marker.
- Decide hosting (the existing `hydrogen` box runs umami + other services; `junkyard.sh` domain is already in use for umami's track subdomain).

## Open / TODO

- [ ] Address the **post-wave-2 QoL sweep** findings (running at handover).
- [ ] Per-tool **deferred features** (see round-2 commit messages): resume CV-import, jwt signature verification, pdf rotate/watermark/page-numbers, qr batch-from-CSV + custom eye shapes, ocr searchable-PDF/DOCX, bg background-replacement, etc.
- [ ] **Productionize + deploy the junkyard.sh hub** (Vite/React, shared tool manifest).
- [ ] Extract the vendored kit into a real shared package.
- [ ] **Build the MCP server** (the headline next phase).
- [ ] Migrate the 42 individual GH-Pages deploys onto the consolidated server (keep `<slug>.mrzk.io` working).

## Running a tool locally

```
cd apps/<slug>
npm install
npm run dev      # vite dev server
npm run build    # production build -> dist/
npx biome ci src/    # lint
npx tsc --noEmit     # typecheck
npm test             # vitest
```

---

## Session update — 2026-06-23 (read this first on resume)

**junkyard.sh hub is LIVE** — deployed on the `hydrogen` box (122.199.31.95): an `nginx:alpine` container named `junkyard` serving `/opt/junkyard/index.html`, on the `traefik-public` docker network, behind the existing **traefik v3.6** with labels `traefik.http.routers.junkyard.rule=Host(\`junkyard.sh\`)` + `entrypoints=websecure` + `tls.certresolver=cloudflare` + `services.junkyard.loadbalancer.server.port=80`. The apex `junkyard.sh` already DNS-resolves to hydrogen. **To update the hub:** replace `/opt/junkyard/index.html` on hydrogen (source is `hub/index.html` here, latest working copy was `~/projects/junkyard-proto/index.html` on the planky box). traefik configs live at `/opt/traefik` (traefik.yml + dynamic/ + acme/). hydrogen ssh alias = `andryo@122.199.31.95`.

**ROUTING DECISION (owner, this session):** the target is **path-based routing — `junkyard.sh/<appname>`** (e.g. `junkyard.sh/qr`, `junkyard.sh/pdf`), NOT the current `<slug>.mrzk.io` subdomains. So the productionized hub + server should serve each app under a path on junkyard.sh. The 42 `<slug>.mrzk.io` deploys stay live during migration; redirect or alias them to the new paths later. (This pairs with the one-server + MCP goal.)

**Post-wave-2 QoL sweep — DONE.** 23/42 tools came back genuinely **solid**. ~10 had real issues; a targeted fix wave was dispatched for them (workflow task `wxm31o9oa`).
- **MAJOR:** `bg` result-preview `<img>` collapses to height:0px (cutout invisible) · `colours` mobile copy-actions row overflows 390px (no wrap).
- **MINOR:** `regex` mobile horizontal overflow (~50px) · `depth`/`caption`/`pdf` swallow bad files with no error message · `convert` AVIF emitted as PNG-under-.avif with no capability check · `units` Copy-result has no "Copied!" toast · `lorem` style selection doesn't persist · `css` clipboard write throws uncaught in locked-down contexts · assorted sub-40px mobile tap targets.

### ⚠️ FIRST ACTION ON RESUME
The fix wave (`wxm31o9oa`) was still running at session end. When it completes, its builders have committed fixes **locally only** in each `tool-<slug>` dir on the planky box (`~/projects/_fleet/tool-*` and `~/projects/colours`). **Commit + push each changed tool to its `marzukia/<slug>` repo to deploy** (git identity `Andryo Marzuki <42439397+marzukia@users.noreply.github.com>`, push via `git push https://x-access-token:$(ssh hydrogen 'gh auth token')@github.com/marzukia/<slug>.git HEAD:main`). Then re-pull those fixed sources into this monorepo's `apps/`. Tools in the wave: bg, colours, regex, depth, caption, pdf, units, convert, lorem, css.

### Open items (updated)
- [ ] Push + deploy the `wxm31o9oa` fix-wave results (see above) — **do this first.**
- [ ] Re-sync `apps/` in this monorepo from the latest tool sources after the fix wave.
- [ ] Productionize the junkyard.sh hub (Vite/React + shared tool manifest) and move to **path-based routing** `junkyard.sh/<app>`.
- [ ] Per-tool deferred features (round-2 commit messages): resume CV-import, jwt signature verify, pdf rotate/watermark/page-numbers, qr batch/eye-shapes, ocr searchable-PDF/DOCX, bg background-replacement, etc.
- [ ] Build the MCP server (each tool's `src/lib/*` = the handler).
- [ ] Migrate `<slug>.mrzk.io` deploys onto the consolidated junkyard server.
