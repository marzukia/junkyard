/**
 * Tests for the shouldEmitProgress throttle guard in workerTask.ts.
 *
 * The invariant: transformers.js fires progress_callback many times per second
 * per file chunk. shouldEmitProgress gates which events reach the UI, so only
 * whole-percent changes trigger a re-render. Terminal/edge states always pass:
 *   - first event (lastPct === -1)
 *   - indeterminate (total === 0)
 *   - 100% completion
 *   - status transitions
 */
import { describe, expect, it } from "vitest";
import { shouldEmitProgress } from "./workerTask";

describe("shouldEmitProgress — first event", () => {
  it("always emits the very first event (lastPct === -1)", () => {
    expect(shouldEmitProgress(0, 1000, "download", -1, "")).toBe(true);
  });

  it("emits first event even when loaded is 0 and total is 0", () => {
    expect(shouldEmitProgress(0, 0, "initiate", -1, "")).toBe(true);
  });
});

describe("shouldEmitProgress — indeterminate (total === 0)", () => {
  it("always emits when total is 0 (indeterminate state)", () => {
    expect(shouldEmitProgress(0, 0, "download", 0, "download")).toBe(true);
  });

  it("emits indeterminate even after previous events have been seen", () => {
    expect(shouldEmitProgress(500, 0, "download", 50, "download")).toBe(true);
  });
});

describe("shouldEmitProgress — status transitions", () => {
  it("emits when status changes from download to done", () => {
    expect(shouldEmitProgress(1000, 1000, "done", 100, "download")).toBe(true);
  });

  it("emits when status changes from initiate to download", () => {
    expect(shouldEmitProgress(0, 1000, "download", 0, "initiate")).toBe(true);
  });

  it("emits when status changes even if percent is unchanged", () => {
    // Same 50% but status changed — must emit
    expect(shouldEmitProgress(500, 1000, "progress", 50, "download")).toBe(true);
  });
});

describe("shouldEmitProgress — 100% completion", () => {
  it("emits when progress reaches 100%", () => {
    // Last seen was 99%, now 100%
    expect(shouldEmitProgress(1000, 1000, "download", 99, "download")).toBe(true);
  });

  it("emits 100% even when same status", () => {
    expect(shouldEmitProgress(999, 999, "progress", 99, "progress")).toBe(true);
  });
});

describe("shouldEmitProgress — suppression (the throttle)", () => {
  it("suppresses sub-percent update within the same whole percent", () => {
    // 50.1% and 50.4% both round to 50 — the second should be suppressed.
    // 501/1000 = 50.1% → rounds to 50
    // 504/1000 = 50.4% → rounds to 50
    const loaded1 = 501;
    const loaded2 = 504;
    const total = 1000;
    // First crosses the 50% boundary (lastPct was 49): emits
    expect(shouldEmitProgress(loaded1, total, "download", 49, "download")).toBe(true);
    // Second is still 50% rounded (lastPct now 50): suppress
    expect(shouldEmitProgress(loaded2, total, "download", 50, "download")).toBe(false);
  });

  it("suppresses repeated events at the same whole percent", () => {
    // Many rapid callbacks at ~25%
    const total = 100_000_000; // 100 MB
    // 24.9MB → 24.9% → rounds to 25
    // 24.95MB → 24.95% → rounds to 25
    // All of these should be suppressed once lastPct is 25
    for (let loaded = 24_900_000; loaded <= 24_994_999; loaded += 10_000) {
      expect(shouldEmitProgress(loaded, total, "download", 25, "download")).toBe(false);
    }
  });

  it("does not suppress when whole-percent advances by 1", () => {
    // 51% after lastPct=50 → should emit
    expect(shouldEmitProgress(510, 1000, "download", 50, "download")).toBe(true);
  });

  it("does not suppress when whole-percent jumps by multiple", () => {
    // A large chunk arrives that jumps from 10% to 40%
    expect(shouldEmitProgress(400, 1000, "download", 10, "download")).toBe(true);
  });
});

describe("shouldEmitProgress — realistic download sequence", () => {
  it("emits at most 101 times across a realistic download (0→100 + first)", () => {
    const total = 50_000_000; // 50 MB file
    const chunkSize = 32_768; // 32 KB chunks, typical fetch stream
    let emitCount = 0;
    let lastPct = -1;
    let lastStatus = "";

    for (let loaded = chunkSize; loaded <= total; loaded += chunkSize) {
      if (shouldEmitProgress(loaded, total, "download", lastPct, lastStatus)) {
        lastPct = Math.round((loaded / total) * 100);
        lastStatus = "download";
        emitCount++;
      }
    }
    // Ensure 100% fires (may need a final event at exactly total)
    if (shouldEmitProgress(total, total, "download", lastPct, lastStatus)) {
      emitCount++;
    }

    // Should be ≤101 (0% first event + up to 100 whole-percent steps)
    // In practice 50MB/32KB = ~1526 chunks, but we emit ≤101 times
    expect(emitCount).toBeLessThanOrEqual(101);
    // Must have emitted at least a handful of times (not completely suppressed)
    expect(emitCount).toBeGreaterThan(5);
  });
});
