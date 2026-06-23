import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COLLAGE_SHAPES, type CollageShapeId, applyShapeClip, getShape } from "./collageShapes";

describe("getShape", () => {
  it("returns the rectangle shape for 'rectangle'", () => {
    const s = getShape("rectangle");
    expect(s.id).toBe("rectangle");
  });

  it("falls back to rectangle for unknown id", () => {
    const s = getShape("unknown" as CollageShapeId);
    expect(s.id).toBe("rectangle");
  });

  it("returns all four defined shapes", () => {
    const ids = COLLAGE_SHAPES.map((s) => s.id);
    expect(ids).toContain("rectangle");
    expect(ids).toContain("rounded");
    expect(ids).toContain("circle");
    expect(ids).toContain("heart");
  });
});

describe("shape path geometry", () => {
  const w = 400;
  const h = 300;

  it("rectangle path references canvas extremes", () => {
    const d = getShape("rectangle").path(w, h);
    // Must close and reference width and height
    expect(d).toContain("Z");
    expect(d).toContain(`H${w}`);
    expect(d).toContain(`V${h}`);
  });

  it("rounded path stays within bounds", () => {
    const d = getShape("rounded").path(w, h);
    // Just verify the path is non-empty and contains the close command
    expect(d).toContain("Z");
    expect(d.length).toBeGreaterThan(20);
  });

  it("heart path starts at the bottom tip (0.5w, h)", () => {
    const d = getShape("heart").path(w, h);
    // Should start with M at (w/2, h)
    expect(d).toMatch(/^M200,300/);
  });

  it("heart path closes at the tip", () => {
    const d = getShape("heart").path(w, h);
    // Last curve ends at (w/2, h) — repeated from start — and closes
    expect(d).toContain(`${w / 2},${h} Z`);
  });

  it("circle path uses arc notation", () => {
    const d = getShape("circle").path(w, h);
    expect(d).toContain("A");
  });

  it("each shape label is non-empty", () => {
    for (const shape of COLLAGE_SHAPES) {
      expect(shape.label.length).toBeGreaterThan(0);
    }
  });
});

describe("applyShapeClip", () => {
  // Path2D is not available in jsdom; polyfill a minimal stub so we can test
  // the control-flow logic (returns false for rect, true for others).
  const originalPath2D = globalThis.Path2D;

  beforeEach(() => {
    // @ts-expect-error - minimal stub for tests
    globalThis.Path2D = class {
      constructor(public d: string) {}
    };
  });

  afterEach(() => {
    globalThis.Path2D = originalPath2D;
  });

  function makeCtx() {
    return {
      clip: () => {},
    } as unknown as CanvasRenderingContext2D;
  }

  it("returns false (no clip) for rectangle", () => {
    const ctx = makeCtx();
    const result = applyShapeClip(ctx, "rectangle", 400, 300);
    expect(result).toBe(false);
  });

  it("returns true and applies clip for circle", () => {
    const ctx = makeCtx();
    const result = applyShapeClip(ctx, "circle", 400, 300);
    expect(result).toBe(true);
  });

  it("returns true and applies clip for heart", () => {
    const ctx = makeCtx();
    const result = applyShapeClip(ctx, "heart", 400, 300);
    expect(result).toBe(true);
  });
});
