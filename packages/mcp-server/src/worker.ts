/**
 * Worker entry for op execution.
 *
 * Receives {slug, opName, args} from the host thread, looks up the matching
 * ToolOp in TOOLS, runs it, and postMessages {ok, result} or {ok: false, error}.
 * Imported as a Bun Worker so a wall-clock terminate() on the host side actually
 * kills any synchronous CPU work (ReDoS, infinite loop, huge CSV parse) -- which
 * Promise.race cannot do when the event loop is blocked by synchronous code.
 */
import { TOOLS } from "../../core/src/index.ts";

interface WorkerRequest {
  slug: string;
  opName: string;
  args: unknown;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { slug, opName, args } = e.data;

  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) {
    self.postMessage({ ok: false, error: `Unknown tool slug: ${slug}` });
    return;
  }

  const op = tool.ops.find((o) => o.name === opName);
  if (!op) {
    self.postMessage({ ok: false, error: `Unknown op: ${slug}.${opName}` });
    return;
  }

  try {
    const result = await op.run(args);
    self.postMessage({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ ok: false, error: message });
  }
};
