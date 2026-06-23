# @junkyard/mcp-server

MCP (Model Context Protocol) server that exposes all 17 junkyard tool categories (25 ops) over stdio. Works with Claude Desktop, Claude Code, and any MCP-compatible client.

## Running

```bash
bun run packages/mcp-server/src/index.ts
```

Or from inside this package:

```bash
bun run start
```

The server communicates over stdio and blocks until the client disconnects.

## MCP Client Config

Add to `claude_desktop_config.json` (or your client's MCP config):

```json
{
  "mcpServers": {
    "junkyard": {
      "command": "/home/planky/.bun/bin/bun",
      "args": ["run", "/path/to/jy-core/packages/mcp-server/src/index.ts"]
    }
  }
}
```

## Available Tools

25 tools derived from 17 tool categories. Names follow the pattern `junkyard_<slug>_<opname>`:

| MCP Tool Name | Description |
|---|---|
| `junkyard_json_format` | Pretty-print JSON |
| `junkyard_json_minify` | Minify JSON |
| `junkyard_json_validate` | Validate JSON with line/col errors |
| `junkyard_csv_csvToJson` | CSV to JSON array |
| `junkyard_csv_jsonToCsv` | JSON array to CSV |
| `junkyard_hash_hash` | MD5/SHA-1/SHA-256/SHA-512 hash |
| `junkyard_hash_hmac` | HMAC with key |
| `junkyard_base64_encode` | Base64 encode (standard or URL-safe) |
| `junkyard_base64_decode` | Base64 decode |
| `junkyard_jwt_decode` | Decode JWT payload |
| `junkyard_jwt_verifyHmac` | Verify HMAC-signed JWT |
| `junkyard_regex_test` | Test regex against text |
| `junkyard_cron_describe` | Explain cron expression |
| `junkyard_uuid_generate` | Generate UUID v4 or v7 |
| `junkyard_timestamp_convert` | Convert Unix timestamp |
| `junkyard_timestamp_now` | Current time in multiple formats |
| `junkyard_diff_diff` | Unified diff between two texts |
| `junkyard_units_convert` | Unit conversion |
| `junkyard_colours_convert` | Colour space conversion |
| `junkyard_colours_contrast` | WCAG contrast ratio |
| `junkyard_password_generate` | Password generator |
| `junkyard_lorem_generate` | Lorem ipsum text |
| `junkyard_markdown_toHtml` | Markdown to HTML |
| `junkyard_qr_generate` | QR code as SVG |
| `junkyard_barcode_generate` | Barcode as SVG |

## Integration Test

```bash
bun run src/test-client.ts
```

Spawns the server, lists all 25 tools, calls 5 tools with known outputs, and verifies error handling.
