# junkyard - handover notes

_Last updated: 2026-06-23. Maintainer: Andryo Marzuki (@marzukia, mrzk.io)._

---

> **NOTE (superseded):** This document is a layered session log. It references 42 tools (now 44), the retired per-subdomain model (`<slug>.mrzk.io`), `@marzukia/ui` (namespace is now `@junkyard/ui`), and the `__UMAMI_ID__` placeholder (replaced by build-time injection from `umami-ids.txt`). For current deployment, contributing, and architecture information, see [README.md](./README.md), [CONTRIBUTING.md](./CONTRIBUTING.md), and [DEPLOY.md](./DEPLOY.md). **Current state:** junkyard.sh now serves the consolidated site via an nginx reverse-proxy to the GitHub Pages origin (junkyard.mrzk.io), and junkyard.sh is the canonical/primary domain. Sections below marked "old prototype" or referencing `junkyard.sh` serving a static prototype are superseded by this arrangement.
> **Toolchain:** The package manager and runtime is now **Bun** (not npm/Node). Use `bun install`, `bun run dev`, `bun run build`, `bun run test` everywhere npm was used previously.


# RESUME POINT (2026-06-23, late session - READ THIS FIRST)

Marathon session. The fleet is **44 tools, live at https://junkyard.mrzk.io/<slug>/**, plus a working **MCP server**. Below is the full state + the remaining pipeline. The work director in the Discord channel is **peepercat (`108801968763305984`)** - NOT Cain (Cain = caain `215356028869541889`); don't conflate them.

## What's DONE this session (all merged to `marzukia/junkyard` main + deployed unless noted)
- **Fix wave wxm31o9oa** (10 tools) shipped; hub **productionized** (Vite/React/TS) + **consolidated**: all 42 -> then 44 apps served under `junkyard.mrzk.io/<slug>/` via `scripts/build-site.sh` (builds hub into dist root + each app `--base=/<slug>/`). Deploy = `.github/workflows/deploy-pages.yml` on push to main (paths: hub/apps/scripts/workflow). CI has a **verify job** (catalogue-drift, vendored-AppSwitcher-drift, SEO-subdomain guards) that gates the build.
- **Self-describing apps**: each `apps/<slug>/junkyard.ts` (typed `JunkyardApp`, schema in `scripts/catalogue-schema.ts`) -> `scripts/gen-catalogue.ts` (run via **tsx**, pinned in hub devDeps; node strip-types NOT available here) emits `hub/src/catalogue.generated.ts` + `hub/public/catalogue.json` (served at `/catalogue.json`).
- **Nav switcher** (`kit/components/AppSwitcher.*`, vendored into all 44 via `scripts/vendor-switcher.mjs`, reads `/catalogue.json`).
- **Brand**: salvage-tag logo + all-mono wordmark (header/hero/favicon/OG); tagline "Your favourite online tools, salvaged from behind paywalls".
- **2 NEW apps**: #43 **video** (ffmpeg.wasm single-thread CDN: trim/convert/compress/gif), #44 **cleanup** (CLASSICAL Telea/FMM object eraser - no web-viable neural model; cleanup category is now `image`, runtime `client`, tag `beta`).
- **3 UPGRADED**: qr (batch CSV->ZIP + 4 eye styles, fixed on canvas+SVG), ocr (searchable-PDF export + per-page words + CJK error surfaced), bg (background replacement solid/gradient/image).
- **Tags system**: `AppTag = webgpu|on-device-ai|large-download|beta` in `junkyard.ts`, badges on hub cards + auto **MCP** badge from `mcp.exposed`. `mcp.exposed` corrected to EXACTLY the 17 headless-safe tools: json, csv, hash, base64, jwt, regex, cron, uuid, timestamp, diff, units, colours, password, lorem, markdown, qr, barcode.
- **MCP server (WORKS, verified with a real client)**: `packages/core` (`@junkyard/core` - the 17 tools' pure logic, framework-free, headless, ~169 tests incl. a 39-test markdown-XSS battery) + `packages/mcp-server` (Bun, `@modelcontextprotocol/sdk`, 25 ops over **stdio**, `junkyard_<slug>_<op>`). Run: `bun run packages/mcp-server/src/index.ts`. NOT hosted (no HTTP transport yet); `packages/**` is NOT in the web-deploy path.
- **All 42 old `<slug>.mrzk.io` repos redirect** to junkyard paths (redirect workflow pushed to each `marzukia/<slug>`). mrzk.io `/apps` portfolio UNPUBLISHED (in `marzukia/blog`: `content/apps/_index.md` `draft:true` + "Apps" removed from `config/_default/menus.en.toml`).
- **5-round polish audit -> CONVERGED.** Issues #1-#9 closed; deferred items filed as #10-#14. Caught + fixed 3 markdown-XSS iterations (scheme, attribute, link-label) + qr SVG color injection + units `ms` collision + video listener leak + bg blob leak + regex named-group + lots more. Charted cross-link removed from hub footer. `bun.lock` gitignored.
- **upscale mobile-OOM FIXED** (commit on main `5cac0cc`): output-tensor-aware memory caps per device+scale (this was reloading peepercat's phone). Just merged; **deploys on next push**.

## READY TO MERGE (held - peepercat said "wait")
- **Declarative mobile-warning** DONE on branch `feat/mobilewarn2` (commit `5e2ee0a`, worktree `/home/planky/projects/jy-mw2`): `kit/components/MobileWarning.*` detects phone UA, reads `/catalogue.json`, warns on tools with a heavy tag (on-device-ai/webgpu/large-download), message derived from the tag; dismissible (sessionStorage). Injected into the 9 heavy apps (bg/caption/depth/summarize/transcribe/translate/upscale/chat/video; NOT cleanup). 11 helper tests + 14 Playwright checks pass. Also added `test:{jsdom}` to `kit/vite.config.ts`. **Merge `feat/mobilewarn2` -> push -> deploys.** (Held only because peepercat paused the run.)
- The **upscale OOM fix** (`5cac0cc`) + gitignore are committed on main; pushing deploys them.

## REMAINING PIPELINE (peepercat's explicit sequence, paused mid-stream because context is full)
1. **Comprehensive tests** - happy path + **2 negative** per functional pathway, across the 44 tools' src/lib + `@junkyard/core`. All 44 apps already have >=1 test file (core 169, qr 126, colours has 10, etc.) - this is AUGMENTATION to the happy+2-neg standard. Fan out grouped builders (~6 apps each) off final main.
2. **Umami backend as a CONFIG item** (peepercat's ask): make the umami host (`umami.junkyard.sh`) a single config value + use `umami-ids.txt` slug->id map, injected into each app's `<head>` at build time (instead of hardcoded in 44 index.htmls). Also wires the 2 new apps (video/cleanup currently have NO umami - issue #12).
3. **Documentation** - production-ready: per-tool READMEs, `@junkyard/core` + MCP-server docs, contributor/dev guide, deployment instructions.
4. **Deploy to hydrogen `junkyard.sh`** - build the consolidated dist + serve it from the hydrogen nginx/traefik box at the apex (it still serves the OLD prototype: nginx:alpine container `junkyard` serving `/opt/junkyard/index.html`, traefik labels Host(`junkyard.sh`)). The Bun MCP server can also run on hydrogen. hydrogen ssh = `andryo@122.199.31.95` (alias `hydrogen`); gh authed as marzukia there (token via `ssh hydrogen 'gh auth token'`).

## Deferred/known (issues #10-#14, non-blocking)
#10 OCR Unicode font for CJK PDF; #11 web-workers + cancel on heavy compute; #12 Umami for video/cleanup (folds into the config item above); #13 CI drift guards (sitemap-exists/umami-present/hub-sitemap-from-catalogue/core-vs-exposed contract); #14 dedup AppTag/Category into a shared module + vendor ThemeToggle. Also tiny: flip HANDOVER checkboxes for og.png (done) + per-app SEO (done).

## Git/identity reminders
Commit as `Andryo Marzuki <42439397+marzukia@users.noreply.github.com>` (NEVER the bot account). Push: `git push https://x-access-token:$(ssh hydrogen 'gh auth token')@github.com/marzukia/junkyard.git HEAD:main`. All app builds verified via `vite build --base=/<slug>/`. Playwright chromium for visual checks: `/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`.

---

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

Each `apps/<slug>/` is a full standalone Vite app: `src/`, `public/` (CNAME, favicon.svg, og.png/og-dark.png, robots.txt, sitemap.xml), `index.html` (SEO meta + Person JSON-LD + Umami script), `package.json`, `vite.config.ts`, `.github/workflows/deploy-pages.yml`. `node_modules`/`dist` are gitignored - run `npm install` per app.

## The 42 tools

Live at `https://<slug>.mrzk.io`. Categories used in the hub: **image/media · text/code · ai · docs/utility**.

**Image & media:** convert (image converter, TinyPNG), qr (QR codes), ocr (image→text), og (OG image gen), exif (EXIF viewer/stripper), favicon, bg (background remover, on-device AI), collage (photo collage maker), screenshot (beautifier, shots.so), meme (imgflip), crop (cropper/resizer), svg (SVGO optimizer), gif (GIF maker).
**Text & code:** json (formatter), diff (text diff), markdown (editor), base64, regex (tester, regex101), css (toolkit: shadow/gradient/glass/easing), csv (CSV↔JSON), timestamp (epoch converter), uuid, hash (MD5/SHA), jwt (decoder), lorem (ipsum + placeholders).
**In-browser AI** (transformers.js single-thread WASM / WebLLM, no COOP/COEP needed): transcribe (Whisper), upscale (Swin2SR), depth (Depth-Anything-v2), caption (vit-gpt2), translate (NLLB-600M), summarize (distilbart), chat (WebLLM Llama-3.2-1B, needs WebGPU).
**Docs & utility:** pdf (toolkit), subs (subtitle editor), password, units (converter), colours (gradients/palettes), cron (builder), barcode, invoice (→PDF), resume (CV builder→PDF), sign (e-signature on PDF).

## Tech stack + shared kit

- **Per app:** Vite + React 18 + TypeScript (strict) + Mantine v7 + Zustand + Biome. Node 22.
- **Shared kit** (`kit/`, currently *vendored* into each app under `src/` - there is no published `@marzukia/ui` package yet; that extraction is a TODO):
  - `theme.ts` - Mantine theme: `Inter` (UI/headings, 800 weight) + `JetBrains Mono` (mono), teal primary.
  - `styles.css` - CSS-var design tokens, light + dark:
    - light: `--canvas #fafafa`, `--surface #fff`, `--ink #1a2530`, `--accent #2f9d8d`, `--rule #e8eaed`, radius 16px.
    - dark: `--canvas #13171a`, `--surface #1b2126`, `--ink #e9eef1`, `--accent #41b6a6`.
    - includes the `@media (pointer:coarse)` iOS-zoom guard (`input,textarea,select{font-size:16px}`) + 40px theme-toggle tap targets.
  - `Header`, `Footer` (the "more tools" link points to `https://mrzk.io/apps/`), `BrandMark`, `ThemeToggle` (System/Light/Dark).

## Brand

This is an **extension of the mrzk.io brand**, not a separate identity. Owner: **Andryo Marzuki**, site **mrzk.io** (Hugo/Congo blog, green/red/pink logo palette - that's the BLOG brand). The **tools/charted brand** is the **teal #2f9d8d / amber #e8b04b / coral #d9594c** palette (the "brand strip" across the top of every tool banner + card-hover). All tool banners + the hub use this. `charted.mrzk.io` is the polish bar.

## What has been done (quality passes)

Three audits + two build waves + a verification sweep, all multi-agent:
1. **UX/QoL audit** → **round-1 build wave**: every tool got copy-to-clipboard with "copied" toast, settings persistence (localStorage/zustand-persist), example/empty states, loading/progress states, and the systemic mobile fixes (theme-toggle 40px tap targets + textarea/select iOS-zoom guard).
2. **Feature-gap audit** (vs incumbents) + **experience sweep** (real-use friction + edge-bug hunt) → **round-2 build wave**: each tool got its standard category features + edge-bug fixes + `Cmd/Ctrl+Enter` runs the primary action. Highlights: qr WiFi/vCard/email/SMS QR types + contrast warning; convert AVIF + exact/scale resize + file-validation + "saved X%" banner; og meta-tag snippet + title-overflow fix + size presets; ocr PDF input + batch + region-select + confidence highlights; resume markdown + localStorage + (deferred: CV import); jwt (deferred: signature verification); pdf (deferred: rotate/watermark/page-numbers). Per-tool deferrals are noted in each round-2 commit message.
3. **Post-wave-2 QoL sweep** - running at handover time; verifies round-2 features work + flags regressions/remaining gaps. **Check its output and address findings.**

Earlier history (pre-consolidation) is in each tool's individual repo git log + the maintainer's memory.

## junkyard.sh hub (`hub/`)

A **single-file HTML prototype** of the front door (`hub/index.html`). Design: clean extension of the brand (the tool shell + System/Light/Dark toggle + brand strip + charted teal), **split hero** (headline + lead + CTAs + stat pills on the left; a floating "showcase window" previewing featured tools on the right, mirroring charted's chart-in-a-card), a search/filter command bar, tools grouped into yards as cards (`vs ~~incumbent~~` salvage tags), and an "everything's free" manifesto. Light/dark/mobile all done.
**Status: prototype only - NOT productionized or deployed.** TODO: rebuild as a Vite/React app (live tool list driven by a shared manifest, real search), deploy to **junkyard.sh**.

## Analytics

Self-hosted **Umami** at `umami.junkyard.sh` (admin user `andryo`). Each tool's `index.html` loads `https://umami.junkyard.sh/script.js` with its `data-website-id`. The slug→id map is `umami-ids.txt`. (Beware: a tool shipping the literal `__UMAMI_ID__` placeholder = Umami 400 "Invalid UUID"; always inject the real id.)

## Deployment (current)

Each tool deploys independently:
- Push to `main` of `marzukia/<slug>` → `.github/workflows/deploy-pages.yml` builds (`npm ci && npm run build`) and publishes `dist/` to GitHub Pages.
- Custom domain `<slug>.mrzk.io` via `public/CNAME` + the Pages API `cname` (the workflow's `configure-pages@v5` does NOT auto-set the cname from the artifact - it must be PUT once: `gh api -X PUT repos/marzukia/<slug>/pages -f cname=<slug>.mrzk.io`). DNS: wildcard `*.mrzk.io` → `marzukia.github.io`, so no per-subdomain DNS.
- New-repo recipe: `gh repo create marzukia/<slug> --private` → `gh api -X POST repos/.../pages -f build_type=workflow` (Pages must be pre-enabled) → push → PUT cname.
- **OG banners** are generated centrally (Playwright renders an HTML template with the tool's `favicon.svg` inlined + title/tagline). NOTE: never resize the inlined SVG via a `width="..."` regex - it matches `stroke-width` and corrupts the glyph; size via CSS. Banner dark variant must be genuinely dark.

**Git identity:** always commit as `Andryo Marzuki <42439397+marzukia@users.noreply.github.com>` (never the AI/automation account). `gh` is authed as `marzukia` on the `hydrogen` box; push via `git push https://x-access-token:$(ssh hydrogen 'gh auth token')@github.com/marzukia/<repo>.git`.

## Next phase (the actual goal)

**One server hosting all 42 tools + MCP capabilities.** Direction to flesh out:
- A single app/server (the junkyard) that serves the hub at `junkyard.sh` and routes to each tool, instead of 42 separate GH Pages deploys.
- Expose each tool's core logic as an **MCP tool** so the whole fleet is callable by agents (e.g. `junkyard.convert`, `junkyard.qr`, `junkyard.summarize`). Each app already separates pure logic into `src/lib/*` - those are the natural MCP handlers. Browser-only tools (the transformers.js/WebLLM ones) need a server-side inference path or a clearly-scoped "browser-only" marker.
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

## Session update - 2026-06-23 (LATEST - read first) - 44 tools, features, brand, tags

**Fleet is now 44 tools.** Added 2 NEW apps: **#43 Video Toolkit** (`apps/video`, ffmpeg.wasm SINGLE-THREAD via CDN - trim/convert/compress/video-to-GIF; no COOP/COEP) and **#44 Cleanup** (`apps/cleanup`, object eraser - CLASSICAL Telea/FMM inpainting, no neural model is web-viable at single-thread/GH-Pages constraints; neural WebGPU version is a documented follow-up). Upgraded 3: **qr** (batch CSV->ZIP + 4 eye styles - NOTE a prior builder claimed canvas eye styles worked but they did NOT, the canvas+SVG paths both had a fragile row-0 pixel-scan bug, now fixed to use `QRCode.create()` matrix + shared `computeFinderRegions`/`isFinderModule`), **ocr** (searchable-PDF export via pdf-lib + per-word invisible text layer), **bg** (background replacement: solid/gradient/image composite). Deferred features that were ALREADY done: pdf rotate/watermark/page-numbers, jwt signature verify, resume CV/JSON import.

**Tags system** - `AppTag = webgpu|on-device-ai|large-download|beta` in `scripts/catalogue-schema.ts`, `tags?` per `junkyard.ts`, rendered as badges on hub cards (`ToolCard.tsx` `.card-tags`/`.tag-badge`). Plus an auto-derived **MCP badge** from `mcp.exposed`. CRITICAL FIX: `mcp.exposed` had been defaulted to `runtime==="client"` which wrongly flagged Canvas/binary tools; corrected so ONLY the 17 genuinely headless-safe tools are exposed:true: **json, csv, hash, base64, jwt, regex, cron, uuid, timestamp, diff, units, colours, password, lorem, markdown, qr, barcode**. These 17 are the MCP server's target list.

**New brand** - salvage-tag logo (tri-band teal/amber/coral tag + always-white `>`) in header/favicon, all-mono JetBrains Mono 800 wordmark (`junkyard` ink / `.sh` accent, dot `-.1em`, `.sh` letter-spacing `-.1em`) in header AND hero h1. OG banners regenerate via Playwright (ALWAYS `await document.fonts.ready`). Tagline: "Your favourite online tools, salvaged from behind paywalls" (no hardcoded count; hero pill = `TOOLS.length`).

**Other:** sticky brand strip (moved into the sticky `<header>`); hub theme toggle restyled to match the apps' kit toggle (icon + System/Light/Dark, `.space-toggle`); all 42 old `<slug>.mrzk.io` repos REDIRECT to junkyard paths (redirect workflow pushed to each `marzukia/<slug>`); mrzk.io `/apps` portfolio page UNPUBLISHED (`content/apps/_index.md` `draft:true` + "Apps" removed from `config/_default/menus.en.toml` in `marzukia/blog`; reversible). Adversarial-review issues #1-#9 all closed.

**NEXT (deferred, owner's call):** the **MCP server** - decided stack is **Bun** (NOT Node; the work direct5or in this channel, peepercat / 108801968763305984, said go Bun). v1 = wrap the 17 headless-safe tools' pure logic from a shared `@junkyard/core` package (extract pure libs so app + server share one source). Phase 2 = a GATED private backend: user registration + API tokens + admin panel + per-AI-tool server-side model config; AI tools (bg etc.) run the model server-side (transformers.js works in Node/Bun via onnxruntime) with sharp for image I/O, gated by token so randoms don't burn compute. Owner wants a private auth-gated deployment for their own agents. Was told "do it after this wave."

**junkyard.sh hub is LIVE** - deployed on the `hydrogen` box (122.199.31.95): an `nginx:alpine` container named `junkyard` serving `/opt/junkyard/index.html`, on the `traefik-public` docker network, behind the existing **traefik v3.6** with labels `traefik.http.routers.junkyard.rule=Host(\`junkyard.sh\`)` + `entrypoints=websecure` + `tls.certresolver=cloudflare` + `services.junkyard.loadbalancer.server.port=80`. The apex `junkyard.sh` already DNS-resolves to hydrogen. **To update the hub:** replace `/opt/junkyard/index.html` on hydrogen (source is `hub/index.html` here, latest working copy was `~/projects/junkyard-proto/index.html` on the planky box). traefik configs live at `/opt/traefik` (traefik.yml + dynamic/ + acme/). hydrogen ssh alias = `andryo@122.199.31.95`.

**ROUTING DECISION (owner, this session):** the target is **path-based routing - `junkyard.sh/<appname>`** (e.g. `junkyard.sh/qr`, `junkyard.sh/pdf`), NOT the current `<slug>.mrzk.io` subdomains. So the productionized hub + server should serve each app under a path on junkyard.sh. The 42 `<slug>.mrzk.io` deploys stay live during migration; redirect or alias them to the new paths later. (This pairs with the one-server + MCP goal.)

**Post-wave-2 QoL sweep - DONE.** 23/42 tools came back genuinely **solid**. ~10 had real issues; a targeted fix wave was dispatched for them (workflow task `wxm31o9oa`).
- **MAJOR:** `bg` result-preview `<img>` collapses to height:0px (cutout invisible) · `colours` mobile copy-actions row overflows 390px (no wrap).
- **MINOR:** `regex` mobile horizontal overflow (~50px) · `depth`/`caption`/`pdf` swallow bad files with no error message · `convert` AVIF emitted as PNG-under-.avif with no capability check · `units` Copy-result has no "Copied!" toast · `lorem` style selection doesn't persist · `css` clipboard write throws uncaught in locked-down contexts · assorted sub-40px mobile tap targets.

## Session update - 2026-06-23 (later) - fix wave shipped + hub productionized

**Fix wave `wxm31o9oa` SHIPPED.** All 10 tools (bg, colours, regex, depth, caption, pdf, units, convert, lorem, css) committed as Andryo, pushed to their `marzukia/<slug>` repos, deploy-pages CI green on every one, all serving 200 on `<slug>.mrzk.io`. Two builder commits (bg, regex) had been authored as the bot account and were amended to Andryo before push. Monorepo `apps/` re-synced from the fixed sources (commit `0ec164d`).

**Hub PRODUCTIONIZED + LIVE at https://junkyard.mrzk.io.** The single-file prototype is now a Vite + React 18 + TS app under `hub/` (no Mantine, plain ported CSS in `hub/src/styles.css`, fontsource fonts, FOUC-safe System/Light/Dark toggle). The 42-tool list is a typed shared manifest at `hub/src/tools.ts` (this is the manifest the app-migration + MCP phases reuse). Deployed via a **monorepo-root** workflow `.github/workflows/deploy-pages.yml` (builds `hub/`, uploads `hub/dist`, `paths: hub/**`), GH Pages enabled on `marzukia/junkyard` with `build_type=workflow`, CNAME `junkyard.mrzk.io`. Playwright-verified live: 42 cards, correct chip counts (13/12/7/10), search + empty-state work, dark toggle flips `data-scheme`, 0px overflow at 390px. Cards still link to `<slug>.mrzk.io` (PHASE 2 comment in `ToolCard.tsx` marks the switch to path routing).

- **Hub follow-ups (non-blocking):** generate `hub/public/og.png` (1200x630 banner; referenced in meta with a TODO); wire Umami (needs a new hub site-id; script intentionally omitted, no `__UMAMI_ID__` placeholder).
- **`junkyard.sh` (hydrogen nginx prototype) still serves the OLD static prototype** - left untouched intentionally. When the consolidated path-routing site (`junkyard.sh/<app>`) is ready, point `junkyard.sh` at it and retire the individual `marzukia/<slug>` repos.

## Session update - 2026-06-23 (later still) - CONSOLIDATION LIVE + self-describing apps

**All 42 apps now served under `https://junkyard.mrzk.io/<slug>/`** (path-based routing, the owner's decision). The GH Pages deploy on `marzukia/junkyard` now builds the WHOLE site via `scripts/build-site.sh`: generates the catalogue, builds the hub into `dist/` root, then builds each `apps/<slug>` with `--base=/<slug>/` into `dist/<slug>/`. The deploy workflow `.github/workflows/deploy-pages.yml` runs that script (triggers on `hub/** apps/** scripts/**` + the workflow). Hub cards link to `/<slug>/` (trailing slash avoids the GH Pages 301). Header padding bug fixed (`.hbar` was killing `.wrap`'s horizontal padding; now `padding-block`). Live-verified: hub + all sampled paths 200 incl. transformer apps, subpath assets resolve (e.g. `/depth/` 21MB wasm), 0px mobile overflow.
- **CI gotcha fixed:** the transformers apps (bg, caption, depth, summarize, transcribe, translate, upscale) pull `onnxruntime-node`, whose postinstall 403s downloading CUDA binaries. `build-site.sh` exports `npm_config_onnxruntime_node_install_cuda=skip` + `ONNXRUNTIME_NODE_INSTALL_CUDA=skip` to skip it (browser apps only use onnxruntime-web). Without this the whole build fails.
- **`junkyard.sh` (hydrogen nginx) still serves the OLD static prototype.** Next: point it at the consolidated site (or redirect to junkyard.mrzk.io) and delete/disable the individual `marzukia/<slug>` repos once happy.

**Self-describing apps + TS-native (single source of truth for catalogue + nav + MCP).** Each app declares itself in a TYPED `apps/<slug>/junkyard.ts` (`export const app: JunkyardApp`; shared type in `scripts/catalogue-schema.ts`): `slug, name, category, order, tagline, description, incumbent, path, runtime (client|client-ai), mcp {exposed, lib, tools}`. `scripts/gen-catalogue.ts` (run via **tsx** - pinned in `hub/package.json` devDeps; `node --experimental-strip-types` is NOT available on this Node 22.22 build, `ERR_NO_TYPESCRIPT`) reads + validates all 42 (fails the build on missing/dup/invalid - never silently drops a tool) and emits TWO artifacts: `hub/src/catalogue.generated.ts` (the hub grid; `tools.ts` re-exports `TOOLS` from it) and **`hub/public/catalogue.json`** (served at `https://junkyard.mrzk.io/catalogue.json`). Gen runs in hub `prebuild`/`predev` AND in `build-site.sh` (after hub `npm ci`, since build-site invokes `vite` directly and the prebuild hook does not fire). **The MCP phase reads `/catalogue.json` (or the per-app `junkyard.ts`)** - `mcp.lib` points at each tool's pure-logic module; `runtime: client-ai` = browser-only, `mcp.exposed:false` for now. Identical-render proof passed.

**Nav wrapper on every app (`AppSwitcher`).** Canonical at `kit/components/AppSwitcher.{tsx,css}`, vendored (copied) into all 42 apps next to their `.utility-bar` file by `scripts/vendor-switcher.mjs` (idempotent; handles the 3 structural variants: `src/components/Header.tsx`, `src/kit/components/Header.tsx`, inline `src/App.tsx`). It renders a "Dashboard" link (-> `/`) + an "All Tools" searchable menu (grouped by category, current tool active) that **fetches `/catalogue.json` at runtime** (no per-app tool list to drift). CSS namespaced `.jy-switcher`, uses only shared design tokens (theme-aware). To re-vendor after editing the canonical component: run `node scripts/vendor-switcher.mjs`. Live-verified across all variants + a transformer app + mobile.

**Brand refresh + old-subdomain retirement DONE (2026-06-23, latest).** New logo: a "salvage tag" mark (tilted tri-band teal/amber/coral tag with an always-white `>` prompt) - canonical SVG lives in `hub/src/components/Header.tsx` + `hub/public/favicon.svg`. Wordmark is now ALL JetBrains Mono 800 (`junkyard` in `--ink`, `.sh` in `--accent`, dot pulled in `-.1em`) in the header AND the hero h1 (both must stay in sync). New OG banner at `hub/public/og.png` (regenerate via a Playwright-rendered 1200x630 HTML template; ALWAYS `await document.fonts.ready` before screenshot or the `.sh` renders scuffed). Tagline is "Your favourite online tools, salvaged from behind paywalls" (no hardcoded count); the hero "tools" pill derives from `TOOLS.length`. **All 42 old `<slug>.mrzk.io` repos now redirect** to `junkyard.mrzk.io/<slug>/`: each `marzukia/<slug>` repo's `.github/workflows/deploy-pages.yml` was replaced with a redirect workflow that publishes a static canonical+meta-refresh+JS redirect page (keeps the per-repo CNAME). To retire fully later, the repos can now be deleted/archived. Adversarial-review issues #1-#9 all CLOSED.

**Adversarial review done (2026-06-23, 4 reviewers across domains).** Findings filed as GitHub **issues #1-#9** on `marzukia/junkyard` (the canonical punch-list - read those before MCP). One live BLOCKER already fixed + deployed: `upscale` description was truncated mid-word ("...A Let", broke on the apostrophe) and had propagated to the live `catalogue.json`; restored to full text. Verified-clean: all 42 `mcp.lib` pointers exist + point at real primary logic, `runtime` classification correct (8 client-ai / 34 client), no `__UMAMI_ID__` placeholder, no partial-deploy path. Top open: #1 (all 42 apps still canonical/og/sitemap/robots/Footer -> retired `<slug>.mrzk.io`, which still serve 200 = self-canonicalizing duplicates; needs rewrite + 301 decision), #4 (AppSwitcher hardcodes the 4 categories - a 5th silently drops tools), #5 (add CI drift/quality guards), #6 (delete 42 stale per-app CNAMEs + dead per-app `.github`).

### Open items (updated)
- [x] Push + deploy the `wxm31o9oa` fix-wave results.
- [x] Re-sync `apps/` from the latest tool sources after the fix wave.
- [x] Productionize the hub and deploy to `junkyard.mrzk.io`.
- [x] Consolidate all 42 apps under `junkyard.mrzk.io/<slug>/` (path-based routing) + hub cards link to paths.
- [x] Per-app definition single source of truth (now typed `apps/<slug>/junkyard.ts`); hub catalogue + `/catalogue.json` generated from it.
- [x] Nav wrapper (`AppSwitcher`: Dashboard link + tool jump menu) on all 42 apps, reading `/catalogue.json`.
- [ ] Point `junkyard.sh` (hydrogen) at the consolidated site / redirect to junkyard.mrzk.io, then delete or disable the individual `marzukia/<slug>` repos.
- [ ] Generate the hub OG banner (`hub/public/og.png`) + wire Umami on the hub.
- [ ] Per-app SEO: each app's `<link rel=canonical>`/`og:url` still points at `<slug>.mrzk.io` - update to the `/<slug>/` paths.
- [ ] Per-tool deferred features (round-2 commit messages): resume CV-import, jwt signature verify, pdf rotate/watermark/page-numbers, qr batch/eye-shapes, ocr searchable-PDF/DOCX, bg background-replacement, etc.
- [ ] **Build the MCP server** - read `/catalogue.json` (or `apps/*/junkyard.ts`), wrap each `mcp.lib` as a handler (`junkyard.<slug>`); client-ai tools need a server-side inference path or a browser-only marker.
