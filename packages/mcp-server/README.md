# @junkyard/mcp-server

MCP (Model Context Protocol) server that exposes all 17 junkyard tool categories (25 ops) over stdio. Works with Claude Desktop, Claude Code, and any MCP-compatible client.

Built on `@modelcontextprotocol/sdk` (v1.29.0) with Bun as the runtime. All tool logic lives in `@junkyard/core`; this package is a thin adapter that iterates `TOOLS` and registers each op with the MCP SDK.

## Transport

Stdio only. The server reads from stdin and writes to stdout using the MCP JSON-RPC framing. No HTTP transport is implemented. The process blocks until the client closes the connection.

## Running

From the monorepo root:

```bash
bun run packages/mcp-server/src/index.ts
```

From inside this package:

```bash
bun run start
```

## MCP Client Config

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "junkyard": {
      "command": "/home/you/.bun/bin/bun",
      "args": ["run", "/absolute/path/to/junkyard/packages/mcp-server/src/index.ts"]
    }
  }
}
```

### Claude Code

Add to your project or user MCP settings:

```json
{
  "mcpServers": {
    "junkyard": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/junkyard/packages/mcp-server/src/index.ts"]
    }
  }
}
```

Replace the path with the absolute path to your checkout. Bun must be on `PATH` or use the full path to the binary.

## Tool Naming

MCP tool names follow the pattern `junkyard_<slug>_<opname>`. Slugs and most op names are lowercase; camelCase op names (e.g. `csvToJson`, `toHtml`, `verifyHmac`) are preserved as-is since the MCP spec permits uppercase letters. Names are truncated to 64 characters if needed (none of the current ops exceed this).

## Available Tools

25 tools across 17 categories:

| MCP Tool Name | Description |
|---|---|
| `junkyard_json_format` | Pretty-print JSON with configurable indent (2, 4, or tab) |
| `junkyard_json_minify` | Strip whitespace from JSON |
| `junkyard_json_validate` | Validate JSON; returns line/col on error |
| `junkyard_csv_csvToJson` | Parse CSV to JSON array (auto-detects delimiter) |
| `junkyard_csv_jsonToCsv` | Serialize JSON array to CSV |
| `junkyard_hash_hash` | Hash text with MD5, SHA-1, SHA-256, or SHA-512 |
| `junkyard_hash_hmac` | Compute HMAC with a secret key |
| `junkyard_base64_encode` | Base64 encode (standard alphabet) |
| `junkyard_base64_decode` | Base64 decode (standard alphabet) |
| `junkyard_jwt_decode` | Decode a JWT and return header + payload |
| `junkyard_jwt_verifyHmac` | Verify an HMAC-signed JWT against a secret |
| `junkyard_regex_test` | Test a regex pattern against text; returns all match spans |
| `junkyard_cron_describe` | Explain a cron expression in plain English + next N run times |
| `junkyard_uuid_generate` | Generate one or more UUIDs (v4 or v7) |
| `junkyard_timestamp_convert` | Convert a Unix timestamp to ISO, local, and relative forms |
| `junkyard_timestamp_now` | Return the current time in all formats |
| `junkyard_diff_diff` | Structured side-by-side diff between two texts |
| `junkyard_units_convert` | Convert between units (length, mass, temperature, volume, and more) |
| `junkyard_colours_convert` | Convert a colour between hex, RGB, and HSL |
| `junkyard_colours_contrast` | Compute WCAG contrast ratio and AA/AAA pass/fail |
| `junkyard_password_generate` | Generate a password with configurable character sets |
| `junkyard_lorem_generate` | Generate lorem ipsum words, sentences, or paragraphs |
| `junkyard_markdown_toHtml` | Render Markdown to HTML (XSS-safe renderer) |
| `junkyard_qr_generate` | Generate a QR code as an SVG string |
| `junkyard_barcode_generate` | Generate a barcode as an SVG string (CODE128, EAN13, UPC, and more) |

## Relationship to @junkyard/core

This package imports `TOOLS` from `../../core/src/index.ts` directly (no build step required when running with Bun). Each `ToolDef` in `TOOLS` contains a list of `ToolOp` values; each op's Zod `inputSchema` is passed directly to the MCP SDK and its `run` function becomes the tool handler.

To add a new tool: add it to `@junkyard/core` and include it in the `TOOLS` array. The MCP server picks it up automatically with no changes needed here.

## Integration Test

```bash
bun run src/test-client.ts
```

Spawns the server as a child process, lists all 25 tools, calls 5 tools with known outputs, and verifies error handling.
