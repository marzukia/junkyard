import { describe, expect, it } from "vitest";
import {
  applyColourMap,
  magmaColour,
  plasmaColour,
  turboColour,
  viridisColour,
} from "./depthEstimation";

describe("viridisColour", () => {
  it("returns dark purple at t=0 (far)", () => {
    const [r, , b] = viridisColour(0);
    // viridis starts near (68,1,84), very low red/green, moderate blue
    expect(r).toBeLessThan(100);
    expect(b).toBeGreaterThan(50);
  });

  it("returns bright yellow at t=1 (close)", () => {
    const [r, g, b] = viridisColour(1);
    // viridis ends near (253,231,37)
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeLessThan(100);
  });

  it("clamps values below 0", () => {
    const a = viridisColour(-0.5);
    const b = viridisColour(0);
    expect(a).toEqual(b);
  });

  it("clamps values above 1", () => {
    const a = viridisColour(1.5);
    const b = viridisColour(1);
    expect(a).toEqual(b);
  });

  it("returns an [R,G,B] triple with values in 0-255", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [r, g, b] = viridisColour(t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("midpoint (t=0.5) is distinctly different from both endpoints", () => {
    const [r0] = viridisColour(0);
    const [r1] = viridisColour(1);
    const [rm] = viridisColour(0.5);
    // the mid point should not be identical to either extreme
    expect(rm).not.toBe(r0);
    expect(rm).not.toBe(r1);
  });

  it("t=0.857 is greenish-yellow, not identical to t=1.0 bright yellow", () => {
    // Regression: viridis at 0.857 is ~(160,218,57), not (253,231,37).
    // Both stops being identical flattened the yellow-green segment of the gradient.
    const [r857, g857, b857] = viridisColour(0.857);
    const [r1, , b1] = viridisColour(1);
    // At 0.857 the blue channel should be noticeably higher than at 1.0
    expect(b857).toBeGreaterThan(b1 + 5);
    // Red at 0.857 should be distinctly less than at 1.0
    expect(r857).toBeLessThan(r1 - 50);
    // Green at 0.857 should be high (>180)
    expect(g857).toBeGreaterThan(180);
  });
});

describe("magmaColour", () => {
  it("returns near-black at t=0 (far)", () => {
    const [r, g, b] = magmaColour(0);
    expect(r).toBeLessThan(20);
    expect(g).toBeLessThan(20);
    expect(b).toBeLessThan(20);
  });

  it("returns near-white/yellow at t=1 (close)", () => {
    const [r, g, b] = magmaColour(1);
    expect(r).toBeGreaterThan(230);
    expect(g).toBeGreaterThan(230);
    expect(b).toBeGreaterThan(150);
  });

  it("all values in 0-255", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [r, g, b] = magmaColour(t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("clamps out-of-range values", () => {
    expect(magmaColour(-1)).toEqual(magmaColour(0));
    expect(magmaColour(2)).toEqual(magmaColour(1));
  });
});

describe("turboColour", () => {
  it("returns dark indigo at t=0 (far)", () => {
    const [r, , b] = turboColour(0);
    // turbo starts at #30123b = (48, 18, 59)
    expect(r).toBeLessThan(80);
    expect(b).toBeGreaterThan(40);
  });

  it("returns dark red at t=1 (close)", () => {
    const [r, g, b] = turboColour(1); // #7a0403 = (122, 4, 3)
    expect(r).toBeGreaterThan(80);
    expect(g).toBeLessThan(20);
    expect(b).toBeLessThan(20);
  });

  it("all values in 0-255", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [r, g, b] = turboColour(t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("clamps out-of-range values", () => {
    expect(turboColour(-1)).toEqual(turboColour(0));
    expect(turboColour(2)).toEqual(turboColour(1));
  });
});

describe("plasmaColour", () => {
  it("returns dark blue/purple at t=0 (far)", () => {
    const [r, , b] = plasmaColour(0);
    // plasma starts at #0d0887 = (13, 8, 135)
    expect(r).toBeLessThan(30);
    expect(b).toBeGreaterThan(100);
  });

  it("returns bright yellow-green at t=1 (close)", () => {
    const [r, g, b] = plasmaColour(1);
    // plasma ends at #f0f921 = (240, 249, 33)
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeLessThan(80);
  });

  it("all values in 0-255", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [r, g, b] = plasmaColour(t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("clamps out-of-range values", () => {
    expect(plasmaColour(-1)).toEqual(plasmaColour(0));
    expect(plasmaColour(2)).toEqual(plasmaColour(1));
  });
});

describe("applyColourMap", () => {
  it("delegates viridis correctly", () => {
    expect(applyColourMap(0.5, "viridis")).toEqual(viridisColour(0.5));
  });

  it("delegates magma correctly", () => {
    expect(applyColourMap(0.5, "magma")).toEqual(magmaColour(0.5));
  });

  it("delegates turbo correctly", () => {
    expect(applyColourMap(0.5, "turbo")).toEqual(turboColour(0.5));
  });

  it("delegates plasma correctly", () => {
    expect(applyColourMap(0.5, "plasma")).toEqual(plasmaColour(0.5));
  });

  it("greyscale produces equal R G B", () => {
    for (const t of [0, 0.3, 0.7, 1]) {
      const [r, g, b] = applyColourMap(t, "greyscale");
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("greyscale t=0 is black", () => {
    const [r, g, b] = applyColourMap(0, "greyscale");
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it("greyscale t=1 is white", () => {
    const [r, g, b] = applyColourMap(1, "greyscale");
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });

  it("invert by flipping t gives opposite colour", () => {
    // Far end of viridis flipped should equal near end
    expect(applyColourMap(1 - 0, "viridis")).toEqual(viridisColour(1));
    expect(applyColourMap(1 - 1, "viridis")).toEqual(viridisColour(0));
  });
});
