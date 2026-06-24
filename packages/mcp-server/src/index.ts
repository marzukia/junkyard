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
 *
 * Worker isolation (gauntlet w1 fix):
 * Each op is executed inside a Bun Worker so that synchronous CPU-bound work
 * (ReDoS regex, infinite loop, huge CSV) can be hard-killed via worker.terminate()
 * when the wall-clock deadline fires. Promise.race over op.run() cannot do this
 * because the JS event loop is already blocked before the timeout callback queues.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS } from "../../core/src/index.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, "worker.ts");

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

// Default timeout per op call. Prevents catastrophic-backtracking regex or huge
// CSV payloads from hanging the stdio connection indefinitely.
export const OP_TIMEOUT_MS = Number(process.env.JUNKYARD_OP_TIMEOUT_MS ?? 15_000);

// Input length caps -- fast rejection before a Worker is even spawned.
// These defend against the most obvious abuse vectors with cheap string-length checks.
export const INPUT_LIMITS: Record<string, number> = {
  // regex: catastrophic-backtracking risk; anything useful fits in 1 000 chars
  pattern: 1_000,
  // general text inputs: 100 KB is generous for any tool op
  text: 100_000,
  // CSV: a few MB; large enough for real use, small enough to not exhaust memory
  csv: 4_000_000,
  input: 100_000,
  // cron expression: no legitimate expression exceeds 200 chars
  expr: 200,
};

// Returns an error string if any arg exceeds its limit, otherwise null.
export function checkInputLimits(args: unknown): string | null {
  if (typeof args !== "object" || args === null) return null;
  for (const [key, limit] of Object.entries(INPUT_LIMITS)) {
    const val = (args as Record<string, unknown>)[key];
    if (typeof val === "string" && val.length > limit) {
      return `Input field '${key}' exceeds maximum length of ${limit} characters (got ${val.length})`;
    }
  }
  return null;
}

// Races the old-style Promise.race for backward compatibility in tests
// (still exported; worker dispatch is the real path in main).
export function runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Runs a ToolOp inside a fresh Bun Worker and enforces a wall-clock deadline via
// worker.terminate(). Unlike Promise.race, terminating the worker actually stops
// synchronous CPU work (ReDoS regex, infinite loop, huge CSV parse) so the main
// thread event loop is never blocked.
export function runInWorker(
  slug: string,
  opName: string,
  args: unknown,
  ms: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(WORKER_PATH);

    const cleanup = (fn: () => void) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      fn();
    };

    const timer = setTimeout(() => {
      cleanup(() =>
        reject(new Error(`operation timed out after ${ms}ms`)),
      );
    }, ms);

    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: unknown; error?: string }>) => {
      clearTimeout(timer);
      const { ok, result, error } = e.data;
      if (ok) {
        cleanup(() => resolve(result));
      } else {
        cleanup(() => reject(new Error(error ?? "worker op failed")));
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      clearTimeout(timer);
      cleanup(() => reject(new Error(err.message ?? "worker spawn error")));
    };

    worker.postMessage({ slug, opName, args });
  });
}

async function main() {
  const server = new McpServer(
    { name: "junkyard-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  for (const tool of TOOLS) {
    for (const op of tool.ops) {
      const mcpName = sanitiseName(tool.slug, op.name);
      // Capture slug and opName so the closure references the correct values
      // for each iteration (avoids the classic loop-closure bug).
      const slug = tool.slug;
      const opName = op.name;

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
          // Fast pre-check: reject oversized inputs before spending a Worker spawn.
          const limitErr = checkInputLimits(args);
          if (limitErr) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: `Error: ${limitErr}` }],
            };
          }

          try {
            const result = await runInWorker(slug, opName, args, OP_TIMEOUT_MS);
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
