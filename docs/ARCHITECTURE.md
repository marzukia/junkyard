# Architecture

## Self-describing apps

Each tool declares itself in a single file: `apps/<slug>/junkyard.ts`. This file exports a typed `JunkyardApp` object (schema in `scripts/catalogue-schema.ts`) containing the tool's metadata, category, runtime type, and MCP exposure information.

`scripts/gen-catalogue.ts` reads all 44 of these files, validates them, and emits two artifacts:

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

## Shared kit

`kit/` holds the canonical copies of shared UI components and config:

- `theme.ts` - Mantine theme (Inter + JetBrains Mono, teal primary `#2f9d8d`)
- `styles.css` - design-system CSS variables for light and dark modes
- `components/AppSwitcher.tsx` + `AppSwitcher.css` - nav switcher, fetches `/catalogue.json` at runtime and renders a tool picker
- `components/MobileWarning.tsx` + `MobileWarning.css` - mobile warning overlay for heavy AI apps
- `components/BrandMark.tsx`, `Header.tsx`, `Footer.tsx`, `ThemeToggle.tsx` - shared UI shells

The kit is **vendored** rather than published to npm. `scripts/vendor-switcher.mjs` copies `AppSwitcher.*` into every app's `src/` tree. `scripts/vendor-mobilewarn.mjs` copies `MobileWarning.*` into the 9 heavy-AI apps. CI checks that vendored copies match the canonical source, preventing drift.

This approach was chosen over a published workspace package so that parallel tool builds have no dependency on a package registry publish step. The natural extraction point to a real `@junkyard/ui` package would be after the component API has stabilised across several tools.

## @junkyard/core and the MCP server

`packages/core` (`@junkyard/core`) contains 17 headless, pure-logic tool implementations with no browser dependencies:

`barcode, base64, colours, cron, csv, diff, hash, json, jwt, lorem, markdown, password, qr, regex, timestamp, units, uuid`

Each is exported as a `ToolDef` with a `slug`, a description, and an array of `ToolOp` entries. Each `ToolOp` has a Zod `inputSchema` and an async `run` function.

`packages/mcp-server` (`@junkyard/mcp-server`) wraps `@junkyard/core` in an MCP stdio server using the `@modelcontextprotocol/sdk`. Each `ToolOp` becomes an MCP tool named `junkyard_<slug>_<opname>`. The server runs with Bun (`bun run src/index.ts`) and is intended to be deployed on hydrogen.

## Client-only tools

The remaining 27 tools are browser-only and cannot be made headless:

- **Browser API tools** (file reading, Canvas, Blob URLs): `convert, crop, exif, favicon, gif, meme, og, pdf, screenshot, sign, svg`
- **In-browser AI** (transformers.js WASM, WebLLM/WebGPU): `bg, caption, chat, cleanup, depth, summarize, transcribe, translate, upscale`
- **Rich editor tools** (DOM, contenteditable, interactive state): `collage, css, invoice, resume, subs, video`

These are catalogued with `runtime: "client"` or `runtime: "client-ai"` and `mcp.exposed: false`. They participate in the self-describing-app model and appear in the hub and nav switcher, but have no headless counterpart in `@junkyard/core`.
