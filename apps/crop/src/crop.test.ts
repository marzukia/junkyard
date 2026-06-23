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

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to min", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });
  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("clampRect", () => {
  it("clamps rect that overflows right edge", () => {
    const result = clampRect({ x: 90, y: 0, w: 40, h: 40 }, 100, 100);
    expect(result.x + result.w).toBeLessThanOrEqual(100);
  });

  it("clamps rect that overflows bottom edge", () => {
    const result = clampRect({ x: 0, y: 80, w: 40, h: 40 }, 100, 100);
    expect(result.y + result.h).toBeLessThanOrEqual(100);
  });

  it("keeps rect entirely within image", () => {
    const result = clampRect({ x: 10, y: 10, w: 50, h: 50 }, 100, 100);
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
    expect(result.w).toBe(50);
    expect(result.h).toBe(50);
  });

  it("enforces minimum size of 1", () => {
    const result = clampRect({ x: 0, y: 0, w: 0, h: 0 }, 100, 100);
    expect(result.w).toBe(1);
    expect(result.h).toBe(1);
  });
});

describe("fitRectToAspect", () => {
  it("returns full bounding box for free aspect", () => {
    const free = ASPECT_PRESETS.find((a) => a.label === "free");
    expect(free).toBeDefined();
    if (!free) return;
    const result = fitRectToAspect(free, 800, 600);
    expect(result).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it("produces a 1:1 square for 1:1 preset on landscape image", () => {
    const square = ASPECT_PRESETS.find((a) => a.label === "1:1");
    expect(square).toBeDefined();
    if (!square) return;
    const result = fitRectToAspect(square, 1000, 600);
    expect(result.w).toBe(result.h);
    expect(result.w).toBe(600);
  });

  it("produces a 16:9 rect for 16:9 preset on portrait image", () => {
    const wide = ASPECT_PRESETS.find((a) => a.label === "16:9");
    expect(wide).toBeDefined();
    if (!wide) return;
    const result = fitRectToAspect(wide, 400, 900);
    const ratio = result.w / result.h;
    expect(ratio).toBeCloseTo(16 / 9, 1);
  });

  it("centres the rect within the bounding box", () => {
    const square = ASPECT_PRESETS.find((a) => a.label === "1:1");
    expect(square).toBeDefined();
    if (!square) return;
    const result = fitRectToAspect(square, 800, 600);
    expect(result.x).toBe(100); // (800-600)/2
    expect(result.y).toBe(0);
  });
});

describe("snapToAspect", () => {
  it("adjusts height to match 1:1 ratio", () => {
    const result = snapToAspect(
      { x: 0, y: 0, w: 200, h: 400 },
      {
        label: "1:1",
        w: 1,
        h: 1,
      }
    );
    expect(result.w).toBe(result.h);
    expect(result.w).toBe(200);
  });

  it("adjusts height to match 16:9 ratio", () => {
    const result = snapToAspect(
      { x: 0, y: 0, w: 160, h: 200 },
      {
        label: "16:9",
        w: 16,
        h: 9,
      }
    );
    expect(result.h).toBe(Math.round(160 / (16 / 9)));
  });

  it("leaves rect unchanged for free aspect (0,0)", () => {
    const rect = { x: 5, y: 5, w: 100, h: 200 };
    const result = snapToAspect(rect, { label: "free", w: 0, h: 0 });
    expect(result).toEqual(rect);
  });
});

describe("parseDimensions", () => {
  it("parses WxH string", () => {
    expect(parseDimensions("1920x1080")).toEqual([1920, 1080]);
  });

  it("parses with spaces and unicode x", () => {
    expect(parseDimensions("800 x 600")).toEqual([800, 600]);
  });

  it("returns null for invalid input", () => {
    expect(parseDimensions("abc")).toBeNull();
    expect(parseDimensions("0x100")).toBeNull();
    expect(parseDimensions("100x0")).toBeNull();
    expect(parseDimensions("99999x100")).toBeNull();
  });
});

describe("proportionalHeight", () => {
  it("computes proportional height for square crop", () => {
    expect(proportionalHeight(100, 100, 200)).toBe(200);
  });

  it("computes proportional height for landscape crop", () => {
    // 1920x1080 -> new width 960 -> height 540
    expect(proportionalHeight(1920, 1080, 960)).toBe(540);
  });

  it("returns 0 when cropW is 0", () => {
    expect(proportionalHeight(0, 100, 500)).toBe(0);
  });
});

describe("SOCIAL_PRESETS", () => {
  it("every social preset references a valid AspectPreset label", () => {
    const validAspects = new Set(ASPECT_PRESETS.map((a) => a.label));
    for (const preset of SOCIAL_PRESETS) {
      expect(validAspects.has(preset.aspect)).toBe(true);
    }
  });

  it("every social preset has a non-empty name and pixel dimensions", () => {
    for (const preset of SOCIAL_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.px).toMatch(/^\d+x\d+$/);
    }
  });

  it("includes Instagram Square (1:1) and Story (9:16)", () => {
    const names = SOCIAL_PRESETS.map((p) => p.name);
    expect(names).toContain("Instagram Square");
    expect(names).toContain("Instagram Story");
  });
});

describe("ASPECT_PRESETS includes 4:1", () => {
  it("has a 4:1 preset for banner crops", () => {
    const found = ASPECT_PRESETS.find((a) => a.label === "4:1");
    expect(found).toBeDefined();
    expect(found?.w).toBe(4);
    expect(found?.h).toBe(1);
  });
});
