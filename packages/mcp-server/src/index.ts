/**
 * @junkyard/mcp-server
 *
 * Exposes all @junkyard/core tool ops over the Model Context Protocol via stdio.
 * Each core ToolOp becomes an MCP tool named `junkyard_<slug>_<opname>`.
 *
 * Why this file is self-contained rather than split:
 * The registration logic is a single pass over TOOLS (< 60 lines of substantive
 * code); splitting into a registry module would add indirection for no gain.
 * If the op count grows beyond ~50, extracting a registerOps() helper is the
 * natural next step.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS } from "../../core/src/index.ts";

// MCP tool names must match [a-zA-Z0-9_-]+ (max 64 chars per spec).
// Slugs and op names from core use only lowercase letters + digits, so only
// camelCase op names need sanitisation (replace uppercase with _lower).
export function sanitiseName(slug: string, opName: string): string {
  const safe = `junkyard_${slug}_${opName}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return safe.slice(0, 64);
}

// Format op output as MCP content. Stringify objects as pretty JSON;
// pass strings (e.g. SVG from qr/barcode) through as-is.
export function toContent(value: unknown): { type: "text"; text: string }[] {
  if (typeof value === "string") {
    return [{ type: "text", text: value }];
  }
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

async function main() {
  const server = new McpServer(
    { name: "junkyard-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  for (const tool of TOOLS) {
    for (const op of tool.ops) {
      const mcpName = sanitiseName(tool.slug, op.name);

      server.registerTool(
        mcpName,
        {
          description: op.description,
          // The SDK accepts a full ZodTypeAny as inputSchema (AnySchema).
          // Core ops all use z.object({...}) so validated args are plain objects.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputSchema: op.inputSchema as any,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (args: any) => {
          try {
            const result = await op.run(args);
            return { content: toContent(result) };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              isError: true,
              content: [{ type: "text" as const, text: `Error: ${message}` }],
            };
          }
        },
      );
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep alive - stdio transport blocks on stdin until the client closes.
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
