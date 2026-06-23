/**
 * Augmentation tests for gif.ts — pathways not covered by gif.test.ts:
 *   - clamp at exact boundaries and with floats
 *   - msToCentiseconds exact boundaries (20ms min, 60000ms max)
 *   - msToFpsLabel exact 10ms = 100fps boundary, slow frame decimal
 *   - formatDuration exactly 1000ms, exactly 0ms
 *   - estimateGifBytes with height=0 or width=0 or negative
 *   - estimateGifBytes scales proportionally with resolution
 *   - resolveDelay: delayMs=0 (falsy but valid override)
 *   - makeId returns string of length >= 1 and randomness
 */
import { describe, expect, it } from "vitest";
import type { GifFrame } from "./gif";
import {
  clamp,
  estimateGifBytes,
  formatDuration,
  makeId,
  msToCentiseconds,
  msToFpsLabel,
  resolveDelay,
} from "./gif";

// ── clamp edge cases ───────────────────────────────────────────────────────

describe("clamp edge cases", () => {
  it("returns min when value is exactly min", () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });

  it("returns max when value is exactly max", () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });

  it("handles float arguments", () => {
    expect(clamp(0.5, 0.0, 1.0)).toBe(0.5);
    expect(clamp(-0.1, 0.0, 1.0)).toBe(0.0);
    expect(clamp(1.1, 0.0, 1.0)).toBe(1.0);
  });

  it("handles min === max", () => {
    expect(clamp(50, 10, 10)).toBe(10);
    expect(clamp(0, 10, 10)).toBe(10);
    expect(clamp(20, 10, 10)).toBe(10);
  });

  it("handles negative range", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

// ── msToCentiseconds edge cases ────────────────────────────────────────────

describe("msToCentiseconds edge cases", () => {
  it("clamps 0ms to 2cs (20ms minimum)", () => {
    expect(msToCentiseconds(0)).toBe(2);
  });

  it("clamps 19ms to 2cs (below 20ms minimum)", () => {
    expect(msToCentiseconds(19)).toBe(2);
  });

  it("20ms maps to exactly 2cs", () => {
    expect(msToCentiseconds(20)).toBe(2);
  });

  it("1000ms maps to 100cs", () => {
    expect(msToCentiseconds(1000)).toBe(100);
  });

  it("60000ms maps to 6000cs (upper boundary)", () => {
    expect(msToCentiseconds(60000)).toBe(6000);
  });

  it("exceeding 60000ms clamps to 6000cs", () => {
    expect(msToCentiseconds(120000)).toBe(6000);
  });

  it("rounds 250ms to 25cs", () => {
    expect(msToCentiseconds(250)).toBe(25);
  });
});

// ── msToFpsLabel edge cases ────────────────────────────────────────────────

describe("msToFpsLabel edge cases", () => {
  it("10ms produces '100 fps'", () => {
    expect(msToFpsLabel(10)).toBe("100 fps");
  });

  it("1000ms produces '1.0 fps'", () => {
    expect(msToFpsLabel(1000)).toBe("1.0 fps");
  });

  it("200ms produces '5.0 fps' (< 10fps uses toFixed(1))", () => {
    expect(msToFpsLabel(200)).toBe("5.0 fps");
  });

  it("125ms produces '8.0 fps' (< 10fps uses toFixed(1))", () => {
    expect(msToFpsLabel(125)).toBe("8.0 fps");
  });

  it("result is a non-empty string containing 'fps'", () => {
    for (const ms of [10, 33, 100, 500, 1000]) {
      const label = msToFpsLabel(ms);
      expect(label).toMatch(/fps$/);
    }
  });
});

// ── formatDuration edge cases ──────────────────────────────────────────────

describe("formatDuration edge cases", () => {
  it("0ms produces '0 ms'", () => {
    expect(formatDuration(0)).toBe("0 ms");
  });

  it("999ms produces '999 ms'", () => {
    expect(formatDuration(999)).toBe("999 ms");
  });

  it("exactly 1000ms produces '1.0 s'", () => {
    expect(formatDuration(1000)).toBe("1.0 s");
  });

  it("10000ms produces '10.0 s'", () => {
    expect(formatDuration(10000)).toBe("10.0 s");
  });

  it("1500ms produces '1.5 s'", () => {
    expect(formatDuration(1500)).toBe("1.5 s");
  });

  it("1ms produces '1 ms'", () => {
    expect(formatDuration(1)).toBe("1 ms");
  });
});

// ── estimateGifBytes edge cases ────────────────────────────────────────────

describe("estimateGifBytes edge cases", () => {
  it("returns null for negative width", () => {
    expect(estimateGifBytes(-100, 100, 5)).toBeNull();
  });

  it("returns null for negative height", () => {
    expect(estimateGifBytes(100, -100, 5)).toBeNull();
  });

  it("returns null for negative frameCount", () => {
    expect(estimateGifBytes(100, 100, -1)).toBeNull();
  });

  it("returns null for frameCount=0", () => {
    expect(estimateGifBytes(100, 100, 0)).toBeNull();
  });

  it("returns null for width=0", () => {
    expect(estimateGifBytes(0, 100, 5)).toBeNull();
  });

  it("returns a number for minimal valid input (1x1, 1 frame)", () => {
    const result = estimateGifBytes(1, 1, 1);
    expect(result).not.toBeNull();
    expect(result as number).toBeGreaterThan(0);
  });

  it("result increases proportionally with frame count", () => {
    const one = estimateGifBytes(100, 100, 1) as number;
    const two = estimateGifBytes(100, 100, 2) as number;
    const ten = estimateGifBytes(100, 100, 10) as number;
    expect(two).toBeGreaterThan(one);
    expect(ten).toBeGreaterThan(two);
  });

  it("result increases proportionally with resolution", () => {
    const small = estimateGifBytes(100, 100, 1) as number;
    const medium = estimateGifBytes(320, 240, 1) as number;
    const large = estimateGifBytes(1280, 720, 1) as number;
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });
});

// ── resolveDelay edge cases ────────────────────────────────────────────────

describe("resolveDelay edge cases", () => {
  const makeFrame = (delayMs: number | null): GifFrame => ({
    id: "test",
    file: new File([], "test.png"),
    previewUrl: "blob:test",
    delayMs,
    width: 100,
    height: 100,
  });

  it("delayMs=null uses global delay", () => {
    expect(resolveDelay(makeFrame(null), 300)).toBe(300);
  });

  it("delayMs=0 overrides global delay (0 is a valid override, not null)", () => {
    // BUG?: 0 is falsy; if the implementation uses `frame.delayMs || globalMs` instead of
    // `frame.delayMs !== null`, this test reveals it.
    // The correct implementation uses !== null check.
    expect(resolveDelay(makeFrame(0), 300)).toBe(0);
  });

  it("non-null delayMs overrides global", () => {
    expect(resolveDelay(makeFrame(500), 200)).toBe(500);
  });

  it("large global delay is passed through when frame has no override", () => {
    expect(resolveDelay(makeFrame(null), 60000)).toBe(60000);
  });
});

// ── makeId edge cases ──────────────────────────────────────────────────────

describe("makeId edge cases", () => {
  it("returns a non-empty string", () => {
    const id = makeId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique ids across 100 calls", () => {
    const ids = new Set(Array.from({ length: 100 }, makeId));
    // With base36 and 8 chars, collisions in 100 calls are astronomically unlikely
    expect(ids.size).toBe(100);
  });

  it("ids consist of alphanumeric characters (base36)", () => {
    const id = makeId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});
