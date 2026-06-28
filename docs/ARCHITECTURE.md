# Architecture

## Self-describing apps

Each tool declares itself in a single file: `apps/<slug>/junkyard.ts`. This file exports a typed `JunkyardApp` object (schema in `scripts/catalogue-schema.ts`) containing the tool's metadata, category, runtime type, and MCP exposure information.

`scripts/gen-catalogue.ts` reads all 45 of these files, validates them, and emits two artifacts:

- `hub/src/catalogue.generated.ts` - a typed `TOOLS` array imported by the hub React app
- `hub/public/catalogue.json` - the full catalogue served at `/catalogue.json`, consumed by the AppSwitcher nav component at runtime

This means adding a tool is a single-file declaration. The hub, the nav switcher, and the MCP server all derive their knowledge of the fleet from the same source. CI enforces that the generated artifacts are never stale.

## URL structure

All tools are served under `junkyard.sh`:

| URL | Content |
|-----|---------|
| `junkyard.sh/` | Hub landing page (built from `hub/`) |
| `junkyard.sh/<slug>/` | Tool app (built from `apps/<slug>/` with `--base=/<slug>/`) |
| `junkyard.sh/catalogue.json` | Full catalogue JSON (from `hub/public/catalogue.json`) |

Each app is built independently with Vite's `--base` flag set to `/<slug>/`, so asset paths are self-contained within the subdirectory.

## Shared UI package (`@junkyardsh/ui`)

`kit/` holds the canonical source for shared UI components and config. These are published as the `@junkyardsh/ui` npm package (`packages/ui/`):

- `theme.ts` → `fleetTheme` - Mantine theme (Roboto + Roboto Mono, teal primary `#2f9d8d`)
- `styles.css` - design-system CSS variables for light and dark modes, site layout (header, footer, cards, buttons), and touch-screen zoom prevention
- `components/AppSwitcher.tsx` + `AppSwitcher.css` - nav switcher, fetches `/catalogue.json` at runtime
- `components/MobileWarning.tsx` + `MobileWarning.css` - mobile warning overlay for heavy AI apps
- `components/BrandMark.tsx`, `Header.tsx`, `Footer.tsx`, `ThemeToggle.tsx` - shared UI shells
- `lib/*` - shared utilities (`base64url`, `cronGrammar`, `csvParse`, `imageHelpers`, `qrContent`, `unicodeFont`, `unitsData`, `workerInference`, `workerTask`, `format`)

All 45 apps import from `@junkyardsh/ui` instead of vendoring copies. CI builds the package once in `packages/ui/` and lint checks all apps against it. The package is published to npm public registry under the `@junkyardsh` scope.

Previously the kit was vendored via 17 `scripts/vendor-*.mjs` scripts with CI drift checks. The extraction to `@junkyardsh/ui` eliminates this maintenance overhead.

## @junkyard/core and the MCP server

`packages/core` (`@junkyard/core`) contains 17 headless, pure-logic tool implementations with no browser dependencies:

`barcode, base64, colours, cron, csv, diff, hash, json, jwt, lorem, markdown, password, qr, regex, timestamp, units, uuid`

Each is exported as a `ToolDef` with a `slug`, a description, and an array of `ToolOp` entries. Each `ToolOp` has a Zod `inputSchema` and an async `run` function.

`packages/mcp-server` (`@junkyard/mcp-server`) wraps `@junkyard/core` in an MCP stdio server using the `@modelcontextprotocol/sdk`. Each `ToolOp` becomes an MCP tool named `junkyard_<slug>_<opname>`. The server runs with Bun (`bun run src/index.ts`) and is intended to be deployed on hydrogen.

## Client-only tools

The remaining 28 tools are browser-only and cannot be made headless:

- **Browser API tools** (file reading, Canvas, Blob URLs, screen capture): `convert, crop, exif, favicon, gif, meme, ocr, og, pdf, screenshot, screen-recorder, sign, svg`
- **In-browser AI** (transformers.js WASM, WebLLM/WebGPU): `bg, caption, chat, cleanup, depth, summarize, transcribe, translate, upscale`
- **Rich editor tools** (DOM, contenteditable, interactive state): `collage, css, invoice, resume, subs, video`

These are catalogued with `runtime: "client"` or `runtime: "client-ai"` and `mcp.exposed: false`. They participate in the self-describing-app model and appear in the hub and nav switcher, but have no headless counterpart in `@junkyard/core`.

## Build model: independent apps (no root workspace)

junkyard deliberately has **no root `package.json` / monorepo workspace**. Each `apps/<slug>` is a fully standalone Vite app with its own `package.json` + `bun.lock`, installed and built independently. This is intentional:

- The 45 apps have divergent, sometimes conflicting dependency versions (different transformers.js / pdf-lib / ffmpeg pins). A single hoisted workspace `node_modules` risks cross-app version bleed and breaking individual vite builds.
- Each app stays portable (can be lifted out or deployed on its own).
- `scripts/build-site.sh` already parallelizes the per-app `bun install` phase, so there is no single `bun install` for everything but the install cost is bounded.

Trade-off: there is no one-shot `bun install` at the root, and shared code was previously vendored via `scripts/vendor-*.mjs`. This has been extracted to `@junkyardsh/ui` (`packages/ui/`) — all apps now import from the npm package. CI builds the package once and lint-checks all apps. The package is published separately; apps pin to `^1.0.1`.
