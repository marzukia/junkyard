import { describe, expect, it } from "bun:test";
import { shouldEmitOcrProgress } from "./progressThrottle";

describe("shouldEmitOcrProgress", () => {
  it("passes the first event (lastPct === -1)", () => {
    expect(shouldEmitOcrProgress(42, "Scanning... 42%", -1, "")).toBe(true);
  });

  it("suppresses same pct + same message", () => {
    expect(shouldEmitOcrProgress(42, "Scanning... 42%", 42, "Scanning... 42%")).toBe(false);
  });

  it("passes when pct changes", () => {
    expect(shouldEmitOcrProgress(43, "Scanning... 43%", 42, "Scanning... 42%")).toBe(true);
  });

  it("passes when message changes even at same pct", () => {
    expect(shouldEmitOcrProgress(5, "Loading language data...", 5, "Initialising...")).toBe(true);
  });

  it("always passes 0%", () => {
    expect(shouldEmitOcrProgress(0, "Initialising...", 0, "Initialising...")).toBe(true);
  });

  it("always passes 100%", () => {
    expect(shouldEmitOcrProgress(100, "Done", 99, "Scanning... 99%")).toBe(true);
    // even when message is also same
    expect(shouldEmitOcrProgress(100, "Done", 100, "Done")).toBe(true);
  });

  it("synthetic realistic sequence: 500 sub-percent events emit <= 110 times (vs 500 raw)", () => {
    // Simulate tesseract firing every 0.2% from 0->100 (500 ticks)
    let lastPct = -1;
    let lastMessage = "";
    let emitted = 0;
    for (let i = 0; i <= 500; i++) {
      const rawFraction = i / 500; // 0.000 .. 1.000
      const pct = Math.round(rawFraction * 100); // 0..100
      const message = `Scanning... ${pct}%`;
      if (shouldEmitOcrProgress(pct, message, lastPct, lastMessage)) {
        emitted++;
        lastPct = pct;
        lastMessage = message;
      }
    }
    // At most 101 distinct whole-percent values (0..100) plus first-event
    expect(emitted).toBeLessThanOrEqual(110);
    // Must have emitted at least 0% and 100%
    expect(emitted).toBeGreaterThanOrEqual(2);
  });

  it("always emits when lastPct is -1 regardless of pct value", () => {
    for (const pct of [0, 1, 50, 99, 100]) {
      expect(shouldEmitOcrProgress(pct, "msg", -1, "")).toBe(true);
    }
  });
});
