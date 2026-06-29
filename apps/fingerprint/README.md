# fingerprint

Browser fingerprint & bot detection scanner. Ported from [ghostprint](https://github.com/marzukia/ghostprint). Shows what an anti-bot stack reads off your browser: canvas/WebGL/WebGPU/audio/font fingerprints, automation tells, a derived visitor ID, and a bot risk score. Client-side only, nothing leaves your browser.

## Features
- Navigator / system signal collection
- Client hints (Sec-CH-UA via UserAgentData API)
- Canvas fingerprint (SHA-256 hash of rendered canvas)
- WebGL / GPU fingerprint (vendor, renderer, params, extensions)
- WebGPU adapter info
- Audio fingerprint (OfflineAudioContext oscillator + dynamics compressor)
- Installed fonts probe (dimension comparison against fallback fonts)
- Automation tells (webdriver, headless UA, chrome object, CDP console probe)
- Visitor ID derived from all signals
- Bot risk score (0-99%) with verdict

## Pure logic (`src/lib`)
All fingerprinting logic lives directly in `App.tsx` — no external lib files needed since everything uses browser APIs.

**MCP:** not exposed; fingerprint scanning is a visual/interactive tool.

## Local dev
```bash
cd apps/fingerprint
bun install
bun run dev          # vite dev server
bun run build        # production build -> dist/
bunx biome ci src/    # lint
bunx tsc --noEmit     # typecheck
```

## Deployment
Part of the junkyard monorepo. Live at https://junkyard.sh/fingerprint/ . Deploy is the consolidated `scripts/build-site.sh` (run by `.github/workflows/deploy-pages.yml` on push to `main`), which builds this app with `--base=/fingerprint/` into `dist/fingerprint/`. Umami analytics are injected at build from the repo-root `umami-ids.txt`.

## Attribution
Fingerprinting logic ported from [banky/ghostprint](https://github.com/marzukia/ghostprint) — a live browser-fingerprint mirror.
