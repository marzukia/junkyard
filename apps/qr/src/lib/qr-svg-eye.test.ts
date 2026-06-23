import { describe, expect, it } from "vitest";
import { computeFinderRegions, isFinderModule, svgFinderEye } from "./qr";

// ---------------------------------------------------------------------------
// computeFinderRegions / isFinderModule
// ---------------------------------------------------------------------------

describe("computeFinderRegions", () => {
  it("returns finderSize 7", () => {
    const r = computeFinderRegions(2, 21);
    expect(r.finderSize).toBe(7);
  });

  it("places top-left finder at (margin, margin)", () => {
    const r = computeFinderRegions(2, 21);
    expect(r.tlRow).toBe(2);
    expect(r.tlCol).toBe(2);
  });

  it("places top-right finder at (margin, margin+qrModules-7)", () => {
    const r = computeFinderRegions(2, 21);
    expect(r.trRow).toBe(2);
    expect(r.trCol).toBe(2 + 21 - 7); // 16
  });

  it("places bottom-left finder at (margin+qrModules-7, margin)", () => {
    const r = computeFinderRegions(2, 21);
    expect(r.blRow).toBe(2 + 21 - 7); // 16
    expect(r.blCol).toBe(2);
  });
});

describe("isFinderModule", () => {
  const regions = computeFinderRegions(2, 21);

  it("returns true for a cell in the top-left finder block", () => {
    // top-left occupies rows 2-8, cols 2-8
    expect(isFinderModule(2, 2, regions)).toBe(true);
    expect(isFinderModule(8, 8, regions)).toBe(true);
  });

  it("returns true for a cell in the top-right finder block", () => {
    // top-right occupies rows 2-8, cols 16-22
    expect(isFinderModule(2, 16, regions)).toBe(true);
  });

  it("returns true for a cell in the bottom-left finder block", () => {
    // bottom-left occupies rows 16-22, cols 2-8
    expect(isFinderModule(16, 2, regions)).toBe(true);
  });

  it("returns false for a data module between finders", () => {
    // e.g. (10, 10) is well clear of all three 7x7 blocks
    expect(isFinderModule(10, 10, regions)).toBe(false);
  });

  it("returns false for cells just outside the top-left finder", () => {
    // row 9 is one beyond tlRow+finderSize-1 (8)
    expect(isFinderModule(9, 2, regions)).toBe(false);
    // col 1 is one before tlCol (2)
    expect(isFinderModule(2, 1, regions)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// svgFinderEye - geometry per eye style
// ---------------------------------------------------------------------------

describe("svgFinderEye - circle", () => {
  const fg = "#000000";
  const bg = "#ffffff";
  const cellSize = 20;
  const elements = svgFinderEye(0, 0, cellSize, fg, bg, "circle");

  it("emits exactly 3 SVG elements", () => {
    expect(elements).toHaveLength(3);
  });

  it("all three elements are <circle>", () => {
    for (const el of elements) {
      expect(el).toMatch(/^<circle /);
    }
  });

  it("outer circle uses fgColor", () => {
    expect(elements[0]).toContain(`fill="${fg}"`);
  });

  it("punch circle uses bgColor", () => {
    expect(elements[1]).toContain(`fill="${bg}"`);
  });

  it("inner dot uses fgColor", () => {
    expect(elements[2]).toContain(`fill="${fg}"`);
  });

  it("outer radius = 7*cellSize/2 = 70", () => {
    // outerSize = 7*20 = 140; outerR = 140/2 = 70
    expect(elements[0]).toContain('r="70.000"');
  });

  it("gap radius = 7*cellSize/2 - cellSize = 50", () => {
    // gapR = 70 - 20 = 50
    expect(elements[1]).toContain('r="50.000"');
  });

  it("inner radius = 3*cellSize/2 = 30", () => {
    // innerSize = 3*20 = 60; innerR = 60/2 = 30
    expect(elements[2]).toContain('r="30.000"');
  });

  it("all circles share the same centre (cx=cy=70)", () => {
    // outerSize/2 = 70; px=py=0 so cx=cy=70
    for (const el of elements) {
      expect(el).toContain('cx="70.000"');
      expect(el).toContain('cy="70.000"');
    }
  });

  it("contains no <rect elements", () => {
    for (const el of elements) {
      expect(el).not.toMatch(/^<rect /);
    }
  });
});

describe("svgFinderEye - square", () => {
  const fg = "#000000";
  const bg = "#ffffff";
  const cellSize = 20;
  const elements = svgFinderEye(0, 0, cellSize, fg, bg, "square");

  it("emits exactly 3 SVG elements", () => {
    expect(elements).toHaveLength(3);
  });

  it("all three elements are <rect>", () => {
    for (const el of elements) {
      expect(el).toMatch(/^<rect /);
    }
  });

  it("contains no <circle elements", () => {
    for (const el of elements) {
      expect(el).not.toMatch(/^<circle /);
    }
  });

  it("outer rect has no rx attribute (plain square)", () => {
    expect(elements[0]).not.toContain("rx=");
  });

  it("outer rect is 7*cellSize wide", () => {
    expect(elements[0]).toContain('width="140.000"');
  });

  it("punch rect is 5*cellSize wide positioned at cellSize offset", () => {
    expect(elements[1]).toContain('x="20.000"');
    expect(elements[1]).toContain('width="100.000"');
    expect(elements[1]).toContain(`fill="${bg}"`);
  });

  it("inner rect is 3*cellSize wide positioned at 2*cellSize offset", () => {
    expect(elements[2]).toContain('x="40.000"');
    expect(elements[2]).toContain('width="60.000"');
    expect(elements[2]).toContain(`fill="${fg}"`);
  });
});

describe("svgFinderEye - rounded", () => {
  const elements = svgFinderEye(0, 0, 20, "#000000", "#ffffff", "rounded");

  it("all three elements are <rect>", () => {
    for (const el of elements) {
      expect(el).toMatch(/^<rect /);
    }
  });

  it("all three elements carry an rx attribute (rounded corners)", () => {
    for (const el of elements) {
      expect(el).toContain("rx=");
    }
  });
});

describe("svgFinderEye - leaf", () => {
  const elements = svgFinderEye(0, 0, 20, "#000000", "#ffffff", "leaf");

  it("emits exactly 3 SVG elements", () => {
    expect(elements).toHaveLength(3);
  });

  it("all three elements are <path>", () => {
    for (const el of elements) {
      expect(el).toMatch(/^<path /);
    }
  });

  it("paths contain arc commands (A) for the leaf curve", () => {
    for (const el of elements) {
      expect(el).toContain(" A ");
    }
  });
});

// ---------------------------------------------------------------------------
// All three finder corners are styled (not just one)
// Regression: verify svgFinderEye is called for all three origins.
// We test via the geometry: for circle style, all 3 corners should emit
// circles at different cx/cy values depending on their pixel origin.
// ---------------------------------------------------------------------------

describe("svgFinderEye - three distinct corners produce distinct circle centres", () => {
  const cellSize = 20;
  const fg = "#000000";
  const bg = "#ffffff";

  // Simulate the three origins that generateSvgString computes for a 21-module QR:
  // margin=2, qrModules=21
  // tlRow=2,tlCol=2 -> px=40, py=40
  // trRow=2,trCol=16 -> px=320, py=40
  // blRow=16,blCol=2 -> px=40, py=320
  const origins = [
    { px: 2 * cellSize, py: 2 * cellSize },
    { px: 16 * cellSize, py: 2 * cellSize },
    { px: 2 * cellSize, py: 16 * cellSize },
  ];

  it("each origin produces a different circle centre (cx,cy pair)", () => {
    const centres = origins.map(({ px, py }) => {
      const els = svgFinderEye(px, py, cellSize, fg, bg, "circle");
      const cx = els[0].match(/cx="([^"]+)"/)?.[1];
      const cy = els[0].match(/cy="([^"]+)"/)?.[1];
      return `${cx},${cy}`;
    });
    const unique = new Set(centres);
    expect(unique.size).toBe(3);
  });
});
