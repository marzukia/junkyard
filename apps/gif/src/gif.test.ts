import { describe, expect, it } from "vitest";
import {
  clamp,
  estimateGifBytes,
  formatDuration,
  makeId,
  msToCentiseconds,
  msToFpsLabel,
  resolveDelay,
} from "./gif";
import type { GifFrame } from "./gif";

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
  it("clamps to min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });
  it("clamps to max", () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });
});

describe("msToCentiseconds", () => {
  it("converts 100ms to 10 centiseconds", () => {
    expect(msToCentiseconds(100)).toBe(10);
  });
  it("converts 500ms to 50 centiseconds", () => {
    expect(msToCentiseconds(500)).toBe(50);
  });
  it("clamps below 20ms to 20ms = 2cs", () => {
    expect(msToCentiseconds(5)).toBe(2);
  });
  it("rounds to nearest centisecond", () => {
    expect(msToCentiseconds(150)).toBe(15);
  });
});

describe("msToFpsLabel", () => {
  it("shows fps for 100ms", () => {
    expect(msToFpsLabel(100)).toBe("10 fps");
  });
  it("shows decimal fps for slow frames", () => {
    expect(msToFpsLabel(300)).toBe("3.3 fps");
  });
});

describe("resolveDelay", () => {
  const baseFrame: GifFrame = {
    id: "abc",
    file: new File([], "test.png"),
    previewUrl: "blob:test",
    delayMs: null,
    width: 100,
    height: 100,
  };

  it("falls back to global delay when frame has no override", () => {
    expect(resolveDelay(baseFrame, 200)).toBe(200);
  });

  it("uses per-frame override when set", () => {
    expect(resolveDelay({ ...baseFrame, delayMs: 500 }, 200)).toBe(500);
  });
});

describe("makeId", () => {
  it("returns a non-empty string", () => {
    expect(makeId().length).toBeGreaterThan(0);
  });
  it("returns unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, makeId));
    expect(ids.size).toBe(50);
  });
});

describe("estimateGifBytes", () => {
  it("returns null for zero frames", () => {
    expect(estimateGifBytes(100, 100, 0)).toBeNull();
  });
  it("returns null for zero-dimension canvas", () => {
    expect(estimateGifBytes(0, 100, 5)).toBeNull();
  });
  it("returns a positive number for valid inputs", () => {
    const result = estimateGifBytes(320, 240, 10);
    expect(result).not.toBeNull();
    expect(result as number).toBeGreaterThan(0);
  });
  it("scales with frame count", () => {
    const one = estimateGifBytes(320, 240, 1) as number;
    const ten = estimateGifBytes(320, 240, 10) as number;
    expect(ten).toBeGreaterThan(one);
  });
  it("scales with resolution", () => {
    const small = estimateGifBytes(100, 100, 5) as number;
    const large = estimateGifBytes(800, 600, 5) as number;
    expect(large).toBeGreaterThan(small);
  });
});

describe("formatDuration", () => {
  it("shows ms for sub-second durations", () => {
    expect(formatDuration(600)).toBe("600 ms");
  });
  it("shows seconds for durations >= 1000ms", () => {
    expect(formatDuration(2500)).toBe("2.5 s");
  });
  it("shows exactly 1.0 s for 1000ms", () => {
    expect(formatDuration(1000)).toBe("1.0 s");
  });
});


describe("msToFpsLabel consistency", () => {
  it("shows no decimal for fps >= 10 (integral result)", () => {
    // 100ms = 10fps -> toFixed(0)
    expect(msToFpsLabel(100)).toBe("10 fps");
    // 50ms = 20fps -> toFixed(0)
    expect(msToFpsLabel(50)).toBe("20 fps");
  });

  it("shows one decimal for fps < 10", () => {
    // 300ms = 3.333fps -> toFixed(1) = 3.3
    expect(msToFpsLabel(300)).toBe("3.3 fps");
    // 200ms = 5fps -> toFixed(1) = 5.0
    expect(msToFpsLabel(200)).toBe("5.0 fps");
    // 1000ms = 1fps -> toFixed(1) = 1.0
    expect(msToFpsLabel(1000)).toBe("1.0 fps");
  });

  it("all results end in fps", () => {
    for (const ms of [10, 33, 50, 100, 200, 300, 500, 1000]) {
      expect(msToFpsLabel(ms)).toMatch(/fps$/);
    }
  });
});
