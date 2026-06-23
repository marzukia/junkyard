![junkyard](https://junkyard.sh/og.png)

# junkyard

Your favourite online tools, salvaged from behind paywalls.

44 free, 100% client-side web tools. Everything runs in your browser: no server, no upload, no account. Tools that used to be paywalled, freemium, or just annoying are here, for free, forever. Live at **https://junkyard.sh**.

## Tool catalogue

Tools are grouped into four categories. Examples:

| Category | Count | Examples |
|----------|-------|---------|
| image/media | 15 | [Image Converter](https://junkyard.sh/convert/), [QR Code](https://junkyard.sh/qr/), [Background Remover](https://junkyard.sh/bg/), [OG Image](https://junkyard.sh/og/) |
| text/code | 12 | [JSON Formatter](https://junkyard.sh/json/), [Diff](https://junkyard.sh/diff/), [Regex Tester](https://junkyard.sh/regex/), [Base64](https://junkyard.sh/base64/) |
| ai | 7 | [Transcribe](https://junkyard.sh/transcribe/), [Upscale](https://junkyard.sh/upscale/), [Chat](https://junkyard.sh/chat/), [Summarize](https://junkyard.sh/summarize/) |
| docs/utility | 10 | [PDF Tools](https://junkyard.sh/pdf/), [Password Generator](https://junkyard.sh/password/), [Unit Converter](https://junkyard.sh/units/), [Invoice](https://junkyard.sh/invoice/) |

Browse the full grid at **https://junkyard.sh** or fetch the machine-readable catalogue at `https://junkyard.sh/catalogue.json`.

## MCP server

`@junkyard/mcp-server` exposes 17 tool categories (25 ops) over stdio for use with Claude Desktop, Claude Code, and any MCP-compatible client. All logic is headless and runs in Node/Bun with no browser dependencies.

See [`packages/mcp-server/README.md`](packages/mcp-server/README.md) for setup, tool listing, and client config.

## Architecture

Single GitHub Pages site built from a monorepo. Each of the 44 tools is a self-contained Vite + React app under `apps/<slug>/`. Shared UI lives in `kit/`. The hub landing page is in `hub/`. Headless tool logic lives in `packages/core` (`@junkyard/core`).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture.

## Develop / contribute

```bash
# Run any single tool locally
cd apps/<slug>
bun install
bun run dev

# Run the hub landing page
cd hub
bun install
bun run dev
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for adding tools, vendoring components, running tests, and lint conventions. Source is at **https://github.com/marzukia/junkyard**.

## Deploy

```bash
bash scripts/build-site.sh
```

Builds all 44 apps + the hub into `dist/`, ready for GitHub Pages. See [`DEPLOY.md`](DEPLOY.md) for the full pipeline.

## License

MIT. See [`LICENSE`](LICENSE).

## Maintainer

[Andryo Marzuki](https://mrzk.io)
