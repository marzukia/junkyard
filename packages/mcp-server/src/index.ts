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
 *
 * Worker concurrency cap (gauntlet w2 fix):
 * Rapid MCP calls with no cap would spawn an unbounded number of OS threads, each
 * pegging a core for up to the timeout (15 s). WORKER_CONCURRENCY_CAP limits
 * in-flight workers; excess calls queue on a FIFO list of resolve callbacks
 * (implemented as a minimal counting semaphore). The cap is intentionally small
 * (default 8) -- MCP callers are interactive assistants, not batch pipelines.
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

// Maximum number of Workers running concurrently. Excess calls are queued (FIFO)
// until a slot is released. Set low intentionally: MCP callers are interactive
// assistants, not batch pipelines. Overridable via env for testing.
export const WORKER_CONCURRENCY_CAP = Number(
  process.env.JUNKYARD_WORKER_CONCURRENCY_CAP ?? 8,
);

// Minimal counting semaphore used to bound concurrent Worker spawns.
// _available tracks free slots; _queue parks callers waiting for a slot.
// Exported for testing.
export class WorkerSemaphore {
  private _available: number;
  private _cap: number;
  private _queue: Array<() => void> = [];

  constructor(cap: number) {
    this._cap = cap;
    this._available = cap;
  }

  // Number of currently in-flight (acquired) slots.
  get active(): number {
    return this._cap - this._available;
  }

  // Number of calls queued waiting for a slot.
  get queued(): number {
    return this._queue.length;
  }

  acquire(): Promise<void> {
    if (this._available > 0) {
      this._available--;
      return Promise.resolve();
    }
    // No slot available: park the caller on the queue.
    return new Promise<void>((resolve) => {
      this._queue.push(resolve);
    });
  }

  release(): void {
    const next = this._queue.shift();
    if (next) {
      // Hand the slot directly to the next waiter (no available increment needed).
      next();
    } else {
      this._available++;
    }
  }
}

// Module-level semaphore shared by all runInWorker calls.
export const workerSemaphore = new WorkerSemaphore(WORKER_CONCURRENCY_CAP);

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
  // json.format takes a `json` arg; a multi-MB string must not bypass the cap
  json: 100_000,
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
//
// Concurrency: acquires a slot from workerSemaphore before spawning; releases it
// when the Worker settles (resolve, reject, or timeout). Spawn errors (e.g. path
// not found) are caught and surfaced as clean rejections with no half-open worker.
export async function runInWorker(
  slug: string,
  opName: string,
  args: unknown,
  ms: number,
): Promise<unknown> {
  // Wait for a concurrency slot. This parks the caller (yields the event loop)
  // if WORKER_CONCURRENCY_CAP workers are already in flight.
  await workerSemaphore.acquire();

  return new Promise((resolve, reject) => {
    let settled = false;

    let worker: Worker;
    try {
      worker = new Worker(WORKER_PATH);
    } catch (spawnErr) {
      // Synchronous spawn failure (e.g. file not found). Release the slot and
      // surface a clean error without leaving any half-open state.
      workerSemaphore.release();
      reject(
        new Error(
          `Worker spawn failed: ${spawnErr instanceof Error ? spawnErr.message : String(spawnErr)}`,
        ),
      );
      return;
    }

    const cleanup = (fn: () => void) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      workerSemaphore.release();
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
