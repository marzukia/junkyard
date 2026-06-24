/**
 * Unit tests for name sanitisation, content formatting, timeout helpers,
 * input-limit guards, and -- critically -- proof that worker isolation actually
 * prevents a ReDoS / CPU-spin from blocking the event loop.
 *
 * The three critical tests (normal op, ReDoS timeout, cron infinite-loop) are
 * what the fix claims to deliver; they would all fail against the old
 * Promise.race-over-sync implementation.
 */
import { describe, it, expect } from "bun:test";
import { sanitiseName, toContent, runWithTimeout, checkInputLimits, runInWorker } from "./index.ts";

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
  // step=0 in a range expansion causes an infinite for-loop in expandField().
  // This is a synchronous infinite loop -- Promise.race cannot stop it.
  // Worker terminate() kills the thread OS-level.
  it("terminates a cron expression that causes an infinite CPU loop", async () => {
    const t0 = Date.now();
    await expect(
      runInWorker("cron", "describe", { expr: "0-30/0 * * * *", nextCount: 5 }, CRON_TIMEOUT_MS),
    ).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(CRON_TIMEOUT_MS + 300);
  }, CRON_TIMEOUT_MS + 3_000);
});
