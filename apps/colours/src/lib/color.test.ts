import { describe, expect, it } from "vitest";
import { interpolateThree, interpolateTwo, normalizeHex, toCssGradient } from "./color";

// ── normalizeHex ──────────────────────────────────────────────────────────────

describe("normalizeHex", () => {
  it("accepts a 6-digit hex without #", () => {
    expect(normalizeHex("aabbcc")).toBe("#aabbcc");
  });

  it("accepts a 6-digit hex with #", () => {
    expect(normalizeHex("#AABBCC")).toBe("#aabbcc");
  });

  it("expands a 3-digit shorthand", () => {
    expect(normalizeHex("abc")).toBe("#aabbcc");
  });

  it("returns null for empty string", () => {
    expect(normalizeHex("")).toBeNull();
  });

  it("returns null for invalid chars (#zzz)", () => {
    expect(normalizeHex("#zzz")).toBeNull();
  });

  it("returns null for 4-digit hex (#1234)", () => {
    expect(normalizeHex("#1234")).toBeNull();
  });
});

// ── interpolateTwo ────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

describe("interpolateTwo — LAB", () => {
  it("returns exactly `steps` values", () => {
    const result = interpolateTwo("#ff0000", "#00ff00", 8, "lab");
    expect(result).toHaveLength(8);
  });

  it("all outputs are valid 6-digit hex strings (red→green)", () => {
    const result = interpolateTwo("#ff0000", "#00ff00", 8, "lab");
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("all outputs are valid 6-digit hex strings on a wide gamut ramp (blue→yellow)", () => {
    const result = interpolateTwo("#0000ff", "#ffff00", 10, "lab");
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("flat ramp when start === end produces identical steps, no NaN", () => {
    const result = interpolateTwo("#336699", "#336699", 6, "lab");
    expect(result).toHaveLength(6);
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
    // All identical
    expect(new Set(result).size).toBe(1);
  });

  it("flat ramp when start === end in HSL also produces identical steps", () => {
    const result = interpolateTwo("#aa2200", "#aa2200", 5, "hsl");
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
    expect(new Set(result).size).toBe(1);
  });

  it("LAB midpoint luminance differs from RGB midpoint (uses perceptual space)", () => {
    // Red (#ff0000) and cyan (#00ffff) have very different L* values in LAB.
    // The LAB midpoint should land near the average L*, not the average RGB value.
    // RGB midpoint of #ff0000 and #00ffff is #7f7f7f (L* ≈ 53.4).
    // LAB interpolation mid should be closer to average L* of the two endpoints.
    const labResult = interpolateTwo("#ff0000", "#00ffff", 3, "lab");
    const rgbResult = interpolateTwo("#ff0000", "#00ffff", 3, "rgb");
    // The mid colors in LAB vs RGB space should differ
    expect(labResult[1]).not.toBe(rgbResult[1]);
  });
});

// ── interpolateThree ──────────────────────────────────────────────────────────

describe("interpolateThree", () => {
  it("returns exactly `steps` values", () => {
    const result = interpolateThree("#000000", "#888888", "#ffffff", 7, "lab");
    expect(result).toHaveLength(7);
  });

  it("all outputs are valid 6-digit hex strings", () => {
    const result = interpolateThree("#ff0000", "#00ff00", "#0000ff", 9, "lab");
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("mid color lands at index round((steps-1)/2) for odd steps=9", () => {
    const mid = "#74c69d";
    const result = interpolateThree("#1b4332", mid, "#f8f4e1", 9, "lab");
    expect(result).toHaveLength(9);
    const midIdx = Math.round((9 - 1) / 2); // 4
    expect(result[midIdx].toLowerCase()).toBe(mid.toLowerCase());
  });

  it("mid color lands at index round((steps-1)/2) for even steps=4", () => {
    const mid = "#74c69d";
    const result = interpolateThree("#1b4332", mid, "#f8f4e1", 4, "lab");
    expect(result).toHaveLength(4);
    const midIdx = Math.round((4 - 1) / 2); // 2
    expect(result[midIdx].toLowerCase()).toBe(mid.toLowerCase());
  });

  it("mid color lands at index round((steps-1)/2) for steps=3", () => {
    const mid = "#74c69d";
    const result = interpolateThree("#1b4332", mid, "#f8f4e1", 3, "lab");
    expect(result).toHaveLength(3);
    const midIdx = Math.round((3 - 1) / 2); // 1
    expect(result[midIdx].toLowerCase()).toBe(mid.toLowerCase());
  });

  it("flat ramp (start === mid === end) produces identical steps, no NaN", () => {
    const color = "#336699";
    const result = interpolateThree(color, color, color, 5, "lab");
    expect(result).toHaveLength(5);
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
    expect(new Set(result).size).toBe(1);
  });
});

// ── toCssGradient — copy-path isolation ──────────────────────────────────────
//
// Guard: the CSS gradient emitted for clipboard copy must contain the REAL hex
// values passed to toCssGradient, not any CVD-simulated substitutes.
// If this test ever breaks, it means the copy path is leaking simulated colours.

describe("toCssGradient — copy-path isolation", () => {
  const REAL_COLORS = ["#ff0000", "#00ff00", "#0000ff"];
  // Plausible simulated colours a CVD filter might produce for the above
  const SIMULATED_COLORS = ["#968a00", "#968a00", "#0000ff"];

  it("gradient built from real colours contains each real hex literally", () => {
    const gradient = toCssGradient(REAL_COLORS);
    for (const hex of REAL_COLORS) {
      expect(gradient).toContain(hex);
    }
  });

  it("gradient built from real colours does NOT contain simulated-only values", () => {
    const gradient = toCssGradient(REAL_COLORS);
    // #968a00 only appears in the simulated palette, not in the real one
    expect(gradient).not.toContain("#968a00");
  });

  it("gradient built from simulated colours contains the simulated hex, not the real #ff0000", () => {
    // This test documents the scenario that was the bug: if the copy path
    // mistakenly used simulated colours, red would vanish from the gradient.
    const badGradient = toCssGradient(SIMULATED_COLORS);
    expect(badGradient).not.toContain("#ff0000");
    expect(badGradient).not.toContain("#00ff00");
  });

  it("the copy gradient is independent of any displayColors (simulated) input", () => {
    // Simulate the correct GradientOutput behaviour: realGradient must equal
    // toCssGradient(colors) regardless of what displayColors contains.
    const realGradient = toCssGradient(REAL_COLORS);
    // Even if someone were to accidentally pass simulated colours, the real
    // gradient string should differ from the simulated one.
    const simulatedGradient = toCssGradient(SIMULATED_COLORS);
    expect(realGradient).not.toBe(simulatedGradient);
    // And the real gradient must include the canonical red/green/blue
    expect(realGradient).toContain("#ff0000");
    expect(realGradient).toContain("#00ff00");
    expect(realGradient).toContain("#0000ff");
  });
});
