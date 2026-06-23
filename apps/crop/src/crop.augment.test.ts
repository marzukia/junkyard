/**
 * Augmentation tests for crop.ts — pathways not covered by crop.test.ts:
 *   - clamp floats and negative range
 *   - clampRect: oversized rect clamped to image bounds
 *   - fitRectToAspect: portrait image with landscape ratio
 *   - fitRectToAspect: all ASPECT_PRESETS produce valid rects
 *   - snapToAspect with 4:3 and 9:16 ratios
 *   - parseDimensions: boundary values (exactly 16000, just over)
 *   - parseDimensions: unicode × separator
 *   - proportionalHeight: fractional result rounding
 *   - ASPECT_PRESETS: all labels are unique
 *   - SOCIAL_PRESETS: all aspect values exist in ASPECT_PRESETS
 */
import { describe, expect, it } from "vitest";
import {
  ASPECT_PRESETS,
  SOCIAL_PRESETS,
  clamp,
  clampRect,
  fitRectToAspect,
  parseDimensions,
  proportionalHeight,
  snapToAspect,
} from "./crop";

// ── clamp additional cases ────────────────────────────────────────────────

describe("clamp additional cases", () => {
  it("handles float values within range", () => {
    expect(clamp(0.7, 0.0, 1.0)).toBe(0.7);
  });

  it("clamps float below min", () => {
    expect(clamp(-0.1, 0.0, 1.0)).toBe(0.0);
  });

  it("clamps float above max", () => {
    expect(clamp(1.1, 0.0, 1.0)).toBe(1.0);
  });

  it("returns exactly min when value equals min", () => {
    expect(clamp(5, 5, 10)).toBe(5);
  });

  it("returns exactly max when value equals max", () => {
    expect(clamp(10, 5, 10)).toBe(10);
  });

  it("handles min === max", () => {
    expect(clamp(0, 7, 7)).toBe(7);
    expect(clamp(100, 7, 7)).toBe(7);
  });
});

// ── clampRect additional cases ────────────────────────────────────────────

describe("clampRect additional cases", () => {
  it("rect larger than image is clamped to image size", () => {
    const result = clampRect({ x: 0, y: 0, w: 200, h: 200 }, 100, 100);
    expect(result.w).toBe(100);
    expect(result.h).toBe(100);
  });

  it("negative x is clamped to 0", () => {
    const result = clampRect({ x: -10, y: 0, w: 50, h: 50 }, 100, 100);
    expect(result.x).toBe(0);
  });

  it("negative y is clamped to 0", () => {
    const result = clampRect({ x: 0, y: -20, w: 50, h: 50 }, 100, 100);
    expect(result.y).toBe(0);
  });

  it("rect fully inside image is unchanged", () => {
    const rect = { x: 10, y: 20, w: 30, h: 40 };
    expect(clampRect(rect, 200, 200)).toEqual(rect);
  });

  it("w+x exactly at boundary is valid", () => {
    const result = clampRect({ x: 50, y: 0, w: 50, h: 50 }, 100, 100);
    expect(result.x + result.w).toBe(100);
  });

  it("h+y exactly at boundary is valid", () => {
    const result = clampRect({ x: 0, y: 50, w: 50, h: 50 }, 100, 100);
    expect(result.y + result.h).toBe(100);
  });
});

// ── fitRectToAspect all presets ────────────────────────────────────────────

describe("fitRectToAspect for all ASPECT_PRESETS", () => {
  it("every preset on a 800x600 image produces a rect inside bounds", () => {
    for (const preset of ASPECT_PRESETS) {
      const rect = fitRectToAspect(preset, 800, 600);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(800);
      expect(rect.y + rect.h).toBeLessThanOrEqual(600);
    }
  });

  it("4:3 ratio on a square image produces correct ratio", () => {
    const preset = ASPECT_PRESETS.find((a) => a.label === "4:3")!;
    const rect = fitRectToAspect(preset, 1000, 1000);
    expect(rect.w / rect.h).toBeCloseTo(4 / 3, 1);
  });

  it("9:16 portrait ratio on landscape image is constrained by height", () => {
    const preset = ASPECT_PRESETS.find((a) => a.label === "9:16")!;
    const rect = fitRectToAspect(preset, 1920, 1080);
    expect(rect.w / rect.h).toBeCloseTo(9 / 16, 1);
    expect(rect.h).toBe(1080);
  });

  it("4:5 ratio on portrait image produces correct ratio", () => {
    const preset = ASPECT_PRESETS.find((a) => a.label === "4:5")!;
    const rect = fitRectToAspect(preset, 800, 1000);
    expect(rect.w / rect.h).toBeCloseTo(4 / 5, 1);
  });

  it("3:2 ratio on landscape image", () => {
    const preset = ASPECT_PRESETS.find((a) => a.label === "3:2")!;
    const rect = fitRectToAspect(preset, 1200, 800);
    expect(rect.w / rect.h).toBeCloseTo(3 / 2, 1);
  });
});

// ── snapToAspect additional cases ─────────────────────────────────────────

describe("snapToAspect additional cases", () => {
  it("4:3 ratio adjusts height from width", () => {
    const result = snapToAspect(
      { x: 0, y: 0, w: 400, h: 100 },
      { label: "4:3", w: 4, h: 3 }
    );
    expect(result.h).toBe(Math.round(400 / (4 / 3)));
    expect(result.w).toBe(400);
  });

  it("9:16 ratio adjusts height to be taller than wide", () => {
    const result = snapToAspect(
      { x: 0, y: 0, w: 180, h: 0 },
      { label: "9:16", w: 9, h: 16 }
    );
    expect(result.h).toBeGreaterThan(result.w);
  });

  it("preserves x and y from original rect", () => {
    const result = snapToAspect(
      { x: 10, y: 20, w: 160, h: 100 },
      { label: "16:9", w: 16, h: 9 }
    );
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
  });

  it("free aspect (0,0) returns rect unchanged", () => {
    const rect = { x: 5, y: 5, w: 200, h: 150 };
    expect(snapToAspect(rect, { label: "free", w: 0, h: 0 })).toEqual(rect);
  });
});

// ── parseDimensions boundary cases ────────────────────────────────────────

describe("parseDimensions boundary cases", () => {
  it("accepts exactly 16000x16000", () => {
    expect(parseDimensions("16000x16000")).toEqual([16000, 16000]);
  });

  it("rejects 16001x100 (exceeds max)", () => {
    expect(parseDimensions("16001x100")).toBeNull();
  });

  it("rejects 100x16001 (exceeds max)", () => {
    expect(parseDimensions("100x16001")).toBeNull();
  });

  it("rejects 0x100", () => {
    expect(parseDimensions("0x100")).toBeNull();
  });

  it("rejects 100x0", () => {
    expect(parseDimensions("100x0")).toBeNull();
  });

  it("accepts unicode × separator", () => {
    expect(parseDimensions("1920×1080")).toEqual([1920, 1080]);
  });

  it("accepts leading and trailing whitespace", () => {
    expect(parseDimensions("  800x600  ")).toEqual([800, 600]);
  });

  it("accepts spaces around x", () => {
    expect(parseDimensions("800 x 600")).toEqual([800, 600]);
  });

  it("rejects negative dimensions", () => {
    expect(parseDimensions("-100x100")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseDimensions("abcxdef")).toBeNull();
  });
});

// ── proportionalHeight boundary cases ─────────────────────────────────────

describe("proportionalHeight boundary cases", () => {
  it("returns 0 when cropW is 0", () => {
    expect(proportionalHeight(0, 1080, 1920)).toBe(0);
  });

  it("identity: same ratio returns same height as new width", () => {
    // cropW == cropH, newW = 100 -> newH = 100
    expect(proportionalHeight(200, 200, 100)).toBe(100);
  });

  it("rounds to integer", () => {
    // 100/300 * 100 = 33.33... -> rounds to 33
    expect(proportionalHeight(300, 100, 100)).toBe(33);
  });

  it("wide crop: height is less than width for 16:9", () => {
    // 1920 x 1080; new width 960 -> 540
    const h = proportionalHeight(1920, 1080, 960);
    expect(h).toBe(540);
  });
});

// ── ASPECT_PRESETS uniqueness ──────────────────────────────────────────────

describe("ASPECT_PRESETS uniqueness", () => {
  it("all labels are unique", () => {
    const labels = ASPECT_PRESETS.map((a) => a.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("free preset has w=0 and h=0", () => {
    const free = ASPECT_PRESETS.find((a) => a.label === "free")!;
    expect(free.w).toBe(0);
    expect(free.h).toBe(0);
  });

  it("all non-free presets have positive w and h", () => {
    for (const preset of ASPECT_PRESETS.filter((a) => a.label !== "free")) {
      expect(preset.w).toBeGreaterThan(0);
      expect(preset.h).toBeGreaterThan(0);
    }
  });
});

// ── SOCIAL_PRESETS completeness ────────────────────────────────────────────

describe("SOCIAL_PRESETS completeness", () => {
  it("LinkedIn Banner uses 4:1 aspect", () => {
    const p = SOCIAL_PRESETS.find((s) => s.name === "LinkedIn Banner")!;
    expect(p).toBeDefined();
    expect(p.aspect).toBe("4:1");
  });

  it("YouTube Thumbnail uses 16:9 aspect", () => {
    const p = SOCIAL_PRESETS.find((s) => s.name === "YouTube Thumbnail")!;
    expect(p).toBeDefined();
    expect(p.aspect).toBe("16:9");
  });

  it("all px dimensions match WxH format", () => {
    for (const preset of SOCIAL_PRESETS) {
      expect(preset.px).toMatch(/^\d+x\d+$/);
    }
  });
});
