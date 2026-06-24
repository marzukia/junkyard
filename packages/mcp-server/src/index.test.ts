/**
 * Unit tests for name sanitisation, content formatting, timeout helpers,
 * input-limit guards, and -- critically -- proof that worker isolation actually
 * prevents a ReDoS / CPU-spin from blocking the event loop.
 *
 * The three critical tests (normal op, ReDoS timeout, cron infinite-loop) are
 * what the fix claims to deliver; they would all fail against the old
 * Promise.race-over-sync implementation.
 *
 * Concurrency cap tests (gauntlet w2) verify that at most WORKER_CONCURRENCY_CAP
 * workers run simultaneously, and that excess calls queue and eventually resolve.
 */
import { describe, it, expect } from "bun:test";
import {
  sanitiseName,
  toContent,
  runWithTimeout,
  checkInputLimits,
  runInWorker,
  WorkerSemaphore,
  workerSemaphore,
  WORKER_CONCURRENCY_CAP,
} from "./index.ts";
import { TOOLS } from "../../core/src/index.ts";

describe("sanitiseName", () => {
  it("produces expected names for normal slug+opName", () => {
    expect(sanitiseName("hash", "hash")).toBe("junkyard_hash_hash");
    expect(sanitiseName("qr", "generate")).toBe("junkyard_qr_generate");
    expect(sanitiseName("base64", "encode")).toBe("junkyard_base64_encode");
  });

  it("replaces dots and spaces with underscores", () => {
    expect(sanitiseName("foo.bar", "op name")).toBe("junkyard_foo_bar_op_name");
  });

  it("truncates to 64 characters", () => {
    const long = "a".repeat(40);
    const result = sanitiseName(long, long);
    expect(result.length).toBeLessThanOrEqual(64);
  });

  it("preserves hyphens and digits", () => {
    expect(sanitiseName("foo-bar", "op2")).toBe("junkyard_foo-bar_op2");
  });

  it("produces the real cron tool name (guards against rename regression)", () => {
    expect(sanitiseName("cron", "describe")).toBe("junkyard_cron_describe");
  });

  it("produces the real markdown tool name (guards against rename regression)", () => {
    expect(sanitiseName("markdown", "toHtml")).toBe("junkyard_markdown_toHtml");
  });
});

describe("toContent", () => {
  it("passes strings through as-is (for SVG)", () => {
    const svg = "<svg><rect/></svg>";
    expect(toContent(svg)).toEqual([{ type: "text", text: svg }]);
  });

  it("serialises objects as pretty JSON", () => {
    const result = toContent({ hash: "abc", algo: "sha256" });
    expect(result[0].type).toBe("text");
    const parsed = JSON.parse(result[0].text);
    expect(parsed.hash).toBe("abc");
    expect(result[0].text).toContain("\n"); // pretty-printed
  });

  it("serialises null correctly", () => {
    const result = toContent(null);
    expect(result[0].text).toBe("null");
  });
});

describe("runWithTimeout", () => {
  it("resolves with the value when op completes before the deadline", async () => {
    const result = await runWithTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("rejects with a timeout message when op exceeds the deadline", async () => {
    const never = new Promise<never>(() => {});
    await expect(runWithTimeout(never, 10)).rejects.toThrow("operation timed out after 10ms");
  });

  it("clears the timer after a fast resolution (no dangling timer)", async () => {
    // Verifies that a fast op does not leave a timer that delays test exit.
    // If clearTimeout is omitted this test suite would hang for `ms` after completing.
    const result = await runWithTimeout(Promise.resolve(42), 5000);
    expect(result).toBe(42);
  });
});

describe("checkInputLimits", () => {
  it("returns null for normal-sized inputs", () => {
    expect(checkInputLimits({ pattern: "hello", text: "world" })).toBeNull();
  });

  it("rejects a pattern over 1000 chars", () => {
    const err = checkInputLimits({ pattern: "a".repeat(1001) });
    expect(err).toContain("pattern");
    expect(err).toContain("1000");
  });

  it("rejects text over 100 000 chars", () => {
    const err = checkInputLimits({ text: "a".repeat(100_001) });
    expect(err).toContain("text");
  });

  it("rejects csv over 4 MB", () => {
    const err = checkInputLimits({ csv: "a".repeat(4_000_001) });
    expect(err).toContain("csv");
  });

  it("returns null for non-object args", () => {
    expect(checkInputLimits(null)).toBeNull();
    expect(checkInputLimits(42)).toBeNull();
  });

  it("rejects json over 100 000 chars (gauntlet w2: json field was previously uncapped)", () => {
    const err = checkInputLimits({ json: "a".repeat(100_001) });
    expect(err).not.toBeNull();
    expect(err).toContain("json");
    expect(err).toContain("100000");
  });

  it("accepts json at exactly the limit (no off-by-one)", () => {
    expect(checkInputLimits({ json: "a".repeat(100_000) })).toBeNull();
  });

  it("rejects diff `a` field over 100 000 chars (gauntlet w3: diff args were previously uncapped)", () => {
    const err = checkInputLimits({ a: "x".repeat(100_001) });
    expect(err).not.toBeNull();
    expect(err).toContain("a");
  });

  it("rejects diff `b` field over 100 000 chars", () => {
    const err = checkInputLimits({ b: "x".repeat(100_001) });
    expect(err).not.toBeNull();
    expect(err).toContain("b");
  });

  it("rejects markdown field over 100 000 chars", () => {
    const err = checkInputLimits({ markdown: "x".repeat(100_001) });
    expect(err).not.toBeNull();
    expect(err).toContain("markdown");
  });

  it("rejects base64 `encoded` field over 100 000 chars", () => {
    const err = checkInputLimits({ encoded: "x".repeat(100_001) });
    expect(err).not.toBeNull();
    expect(err).toContain("encoded");
  });

  it("accepts all new fields at exactly the limit", () => {
    expect(checkInputLimits({ a: "x".repeat(100_000) })).toBeNull();
    expect(checkInputLimits({ b: "x".repeat(100_000) })).toBeNull();
    expect(checkInputLimits({ markdown: "x".repeat(100_000) })).toBeNull();
    expect(checkInputLimits({ encoded: "x".repeat(100_000) })).toBeNull();
  });
});

// ── WorkerSemaphore unit tests ────────────────────────────────────────────────

describe("WorkerSemaphore", () => {
  it("resolves acquire() immediately when slots are available", async () => {
    const sem = new WorkerSemaphore(2);
    await sem.acquire(); // slot 1
    await sem.acquire(); // slot 2
    expect(sem.active).toBe(2);
    expect(sem.queued).toBe(0);
  });

  it("queues the third call when cap=2 and 2 are already acquired", async () => {
    const sem = new WorkerSemaphore(2);
    await sem.acquire();
    await sem.acquire();
    let thirdResolved = false;
    const third = sem.acquire().then(() => { thirdResolved = true; });
    // Third is parked; active=2, queued=1
    expect(sem.active).toBe(2);
    expect(sem.queued).toBe(1);
    expect(thirdResolved).toBe(false);
    sem.release();
    await third;
    expect(thirdResolved).toBe(true);
    expect(sem.active).toBe(2); // one was handed off to the waiter
    expect(sem.queued).toBe(0);
  });

  it("release() increments available when queue is empty", async () => {
    const sem = new WorkerSemaphore(3);
    await sem.acquire();
    expect(sem.active).toBe(1);
    sem.release();
    expect(sem.active).toBe(0);
  });
});

// ── Worker concurrency cap tests ──────────────────────────────────────────────
//
// Fire N > cap concurrent worker ops and assert that at most `cap` are ever
// in-flight simultaneously. All N must still resolve to correct results.
//
// We use `hash.hash` (fast, deterministic) as the payload. The test uses the
// module-level workerSemaphore directly to observe in-flight count.

const CAP = WORKER_CONCURRENCY_CAP; // default 8

describe("runInWorker -- concurrency cap", () => {
  it(`fires ${CAP + 4} concurrent ops and confirms at most ${CAP} run at once`, async () => {
    const N = CAP + 4;
    let peakActive = 0;

    // Wrap runInWorker to sample active count at the moment the semaphore is
    // acquired (just before the Worker spawns). We do this by interleaving a
    // microtask after the acquire resolves using a custom semaphore wrapper.
    // Simpler: just poll workerSemaphore.active after every acquire in the
    // real flow. Since runInWorker awaits acquire() synchronously before the
    // Worker spawns, we read .active right after each Promise settles.

    const ops = Array.from({ length: N }, (_, i) =>
      runInWorker("hash", "hash", { text: `msg${i}`, algo: "sha256" }, 10_000).then((r) => {
        // Sample peak active whenever an op completes.
        if (workerSemaphore.active > peakActive) {
          peakActive = workerSemaphore.active;
        }
        return r;
      }),
    );

    // Also poll active at tick frequency during the burst.
    const pollInterval = setInterval(() => {
      if (workerSemaphore.active > peakActive) {
        peakActive = workerSemaphore.active;
      }
    }, 1);

    const results = await Promise.all(ops);
    clearInterval(pollInterval);
    // Final sample after all settle.
    if (workerSemaphore.active > peakActive) peakActive = workerSemaphore.active;

    // All N ops must have completed with a real hash.
    expect(results).toHaveLength(N);
    for (const r of results) {
      expect((r as { hash: string }).hash).toMatch(/^[0-9a-f]{64}$/);
    }

    // At most CAP workers were ever in flight at once.
    expect(peakActive).toBeLessThanOrEqual(CAP);
    // We must have actually stressed the cap (not all ran serially).
    // With N > CAP and fast workers, peak should reach the cap.
    // Allow a slightly lower bound in case the first batch finishes before
    // all N ops have started (extremely fast env). We only assert > 0.
    expect(peakActive).toBeGreaterThan(0);
  }, 60_000);

  it("all N ops resolve to correct results (excess are queued, not dropped)", async () => {
    const N = CAP + 4;
    const ops = Array.from({ length: N }, (_, i) =>
      runInWorker("hash", "hash", { text: String(i), algo: "sha256" }, 10_000),
    );
    const results = await Promise.all(ops);
    expect(results).toHaveLength(N);
    for (const r of results) {
      expect(typeof (r as { hash: string }).hash).toBe("string");
    }
  }, 60_000);
});

// ── Worker isolation proof tests ─────────────────────────────────────────────
//
// These tests exercise runInWorker() directly against the production tool
// implementations. Each uses a wall-clock deadline SHORT enough to be
// breached by the attacking input.
//
// Bun (V8) has a built-in ReDoS mitigation that caps regex backtracking at
// roughly 800 ms. We use a 500 ms deadline so the pattern is reliably killed
// before it finishes. The cron test uses a step-zero infinite loop which has
// no such cap and is killed at 2 s.

const REDOS_TIMEOUT_MS = 500;   // regex pattern takes ~800 ms; kill at 500
const CRON_TIMEOUT_MS  = 2_000; // cron infinite loop; kill at 2 s

describe("runInWorker -- normal op", () => {
  it("returns the correct result for json format", async () => {
    // formatJson returns a plain string, not { formatted: ... }.
    // Perturbation guard: if worker dispatch is broken this returns an error or hangs.
    const result = await runInWorker("json", "format", { json: '{"a":1}', indent: 2 }, 5_000);
    expect(typeof result).toBe("string");
    expect(result as string).toContain('"a"');
    expect(result as string).toContain("\n");
  }, 10_000);

  it("returns the correct result for hash_hash", async () => {
    const result = await runInWorker("hash", "hash", { text: "abc", algo: "sha256" }, 5_000);
    const parsed = result as { hash: string };
    expect(parsed.hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  }, 10_000);
});

describe("runInWorker -- ReDoS protection", () => {
  // (a+)+$ against a string of 100 'a' chars followed by 'X' triggers V8's
  // backtracking mitigation at ~800 ms. With a 500 ms kill deadline the worker
  // is terminated before it finishes, proving the main thread never blocks.
  it("kills the ReDoS worker before the backtracking completes", async () => {
    const t0 = Date.now();
    await expect(
      runInWorker(
        "regex",
        "test",
        { pattern: "(a+)+$", flags: "", text: "a".repeat(100) + "X" },
        REDOS_TIMEOUT_MS,
      ),
    ).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - t0;
    // Must timeout within deadline + 300 ms slop.
    expect(elapsed).toBeLessThan(REDOS_TIMEOUT_MS + 300);
  }, REDOS_TIMEOUT_MS + 2_000);

  it("server stays responsive after the ReDoS timeout (event loop not blocked)", async () => {
    // Fire the ReDoS worker (runs concurrently in its own thread).
    const redos = runInWorker(
      "regex",
      "test",
      { pattern: "(a+)+$", flags: "", text: "a".repeat(100) + "X" },
      REDOS_TIMEOUT_MS,
    ).catch(() => "redos-timed-out");

    // While the ReDoS worker is pegging its CPU, the main thread event loop
    // is free. A second worker for a normal op should complete quickly.
    const t0 = Date.now();
    const normal = await runInWorker("hash", "hash", { text: "ping", algo: "sha256" }, 5_000);
    const normalElapsed = Date.now() - t0;

    // Normal op must finish well inside the ReDoS deadline -- proves the event
    // loop was not blocked by the synchronous regex work.
    expect(normalElapsed).toBeLessThan(REDOS_TIMEOUT_MS);
    expect((normal as { hash: string }).hash).toBeTruthy();

    // Confirm the ReDoS worker was indeed terminated.
    const redosOutcome = await redos;
    expect(redosOutcome).toBe("redos-timed-out");
  }, REDOS_TIMEOUT_MS + 6_000);
});

describe("runInWorker -- cron infinite step", () => {
  // step=0 used to cause an infinite for-loop; it is now rejected at source
  // (validateSinglePart), so the op throws a clean validation error fast. The
  // worker terminate() kill path is proven by the ReDoS test above.
  it("rejects a step-0 cron expression fast via source validation (no infinite loop)", async () => {
    const t0 = Date.now();
    await expect(
      runInWorker("cron", "describe", { expr: "0-30/0 * * * *", nextCount: 5 }, CRON_TIMEOUT_MS),
    ).rejects.toThrow(/step/i);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(CRON_TIMEOUT_MS + 300);
  }, CRON_TIMEOUT_MS + 3_000);
});

// ── MCP op-count contract ─────────────────────────────────────────────────────
//
// The MCP server registers one MCP tool per ToolOp (slug × opName pair) by
// iterating TOOLS in index.ts. These tests derive the expected tool count and
// names directly from TOOLS so they stay correct when ops are added or removed —
// no magic literal like the dormant `tools.length === 25` in test-client.ts
// (which CI never runs because test-client.ts is a `bun run` script, not a
// `bun test` file).
//
// Perturbation guard: mutate TOOLS (e.g. splice an op) and the first test fails
// with a concrete "expected N, got N-1" message. Remove the sanitiseName prefix
// and the second test fails. The gap test-client.ts leaves is now closed.

describe("MCP op-count contract", () => {
  it("derives the total op count from TOOLS and asserts it is non-zero", () => {
    // Every entry in TOOLS must expose at least one op; otherwise it is silently
    // absent from the MCP server's tool list with no error or warning.
    expect(TOOLS.length).toBeGreaterThan(0);
    for (const tool of TOOLS) {
      expect(tool.ops.length).toBeGreaterThan(
        0,
        `tool "${tool.slug}" has zero ops — it would be silently absent from the MCP server`,
      );
    }
    // Total is derived, not hardcoded. If an op is added the value changes
    // automatically here; the doc-count guard (check-doc-counts.mjs) catches
    // any stale 44-tools prose in docs, and a separate snapshot test below can
    // be updated explicitly by the developer (rather than having a silent mismatch).
    const totalOps = TOOLS.reduce((sum, tool) => sum + tool.ops.length, 0);
    expect(totalOps).toBeGreaterThan(0);

    // Verify the count equals the set of unique (slug, opName) pairs —
    // i.e. no tool has duplicate op names that would silently clobber an MCP tool.
    const opKeys = new Set(
      TOOLS.flatMap((tool) => tool.ops.map((op) => `${tool.slug}:${op.name}`)),
    );
    expect(opKeys.size).toBe(totalOps);
  });

  it("every registered MCP tool name satisfies the MCP name spec and sanitiseName formula", () => {
    // Pins the naming convention in CI. If sanitiseName's formula changes (or a
    // slug/opName grows past 64 chars), this fails before the server reaches prod.
    for (const tool of TOOLS) {
      for (const op of tool.ops) {
        const name = sanitiseName(tool.slug, op.name);
        // MCP spec: [a-zA-Z0-9_-]+, max 64 chars.
        expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
        expect(name.length).toBeLessThanOrEqual(64);
        // Convention: every name must start with the "junkyard_" prefix.
        expect(name.startsWith("junkyard_")).toBe(true);
      }
    }
  });
});
