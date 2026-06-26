/**
 * Augmented tests for colours app:
 * - color.ts additional negative/boundary cases for normalizeHex, COLOR_SPACES,
 *   interpolateTwo/Three
 * - contrast.ts: wcagAssessment all threshold levels
 * - share.ts: encodeState/decodeState additional error paths
 */
import { describe, expect, it } from "vitest";
import {
  COLOR_SPACES,
  interpolateThree,
  interpolateTwo,
  normalizeHex,
  useBlackText,
} from "./color";
import { contrastRatio, wcagAssessment } from "./contrast";
import { decodeState, encodeState } from "./share";
import type { ShareableState } from "./share";

// ── normalizeHex - additional cases ───────────────────────────────────────────

describe("normalizeHex - additional cases", () => {
  it("returns null for 2-digit hex", () => {
    expect(normalizeHex("ab")).toBeNull();
  });

  it("returns null for 5-digit hex", () => {
    expect(normalizeHex("#12345")).toBeNull();
  });

  it("returns null for 7-digit hex (too long without hash)", () => {
    expect(normalizeHex("1234567")).toBeNull();
  });

  it("handles all-zeros (black)", () => {
    expect(normalizeHex("000000")).toBe("#000000");
  });

  it("handles all-ffs (white)", () => {
    expect(normalizeHex("ffffff")).toBe("#ffffff");
  });
});

// ── COLOR_SPACES ──────────────────────────────────────────────────────────────

describe("COLOR_SPACES", () => {
  it("contains exactly 3 spaces", () => {
    expect(COLOR_SPACES).toHaveLength(3);
  });

  it("contains lab, rgb, hsl", () => {
    expect(COLOR_SPACES).toContain("lab");
    expect(COLOR_SPACES).toContain("rgb");
    expect(COLOR_SPACES).toContain("hsl");
  });
});

// ── interpolateTwo - additional cases ─────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

describe("interpolateTwo - additional cases", () => {
  it("works correctly in RGB space", () => {
    const result = interpolateTwo("#000000", "#ffffff", 5, "rgb");
    expect(result).toHaveLength(5);
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("works correctly in HSL space", () => {
    const result = interpolateTwo("#ff0000", "#0000ff", 4, "hsl");
    expect(result).toHaveLength(4);
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("first result is red-ish for red start", () => {
    const result = interpolateTwo("#ff0000", "#0000ff", 5, "lab");
    const r = Number.parseInt(result[0].slice(1, 3), 16);
    const b = Number.parseInt(result[0].slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
  });

  it("last result is blue-ish for blue end", () => {
    const result = interpolateTwo("#ff0000", "#0000ff", 5, "lab");
    const r = Number.parseInt(result[4].slice(1, 3), 16);
    const b = Number.parseInt(result[4].slice(5, 7), 16);
    expect(b).toBeGreaterThan(r);
  });

  it("steps=1 returns a single value", () => {
    const result = interpolateTwo("#ff0000", "#0000ff", 1, "rgb");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(HEX_RE);
  });
});

// ── interpolateThree - additional cases ──────────────────────────────────────

describe("interpolateThree - additional cases", () => {
  it("steps < 3 falls back to two-point interpolation", () => {
    const result = interpolateThree("#ff0000", "#00ff00", "#0000ff", 2, "rgb");
    expect(result).toHaveLength(2);
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("mid color is green-ish at center index for odd step count", () => {
    // 5 steps: midIdx = round((5-1)/2) = 2
    const result = interpolateThree("#ff0000", "#00ff00", "#0000ff", 5, "rgb");
    expect(result).toHaveLength(5);
    const g = Number.parseInt(result[2].slice(3, 5), 16);
    const r = Number.parseInt(result[2].slice(1, 3), 16);
    const b = Number.parseInt(result[2].slice(5, 7), 16);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("works with all three colors the same (flat ramp)", () => {
    const result = interpolateThree("#aabbcc", "#aabbcc", "#aabbcc", 4, "rgb");
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(1);
  });
});

// ── contrast - additional cases ───────────────────────────────────────────────

describe("contrastRatio - additional cases", () => {
  it("white on white has ratio 1:1", () => {
    const ratio = contrastRatio("#ffffff", "#ffffff");
    expect(ratio).toBeCloseTo(1, 1);
  });

  it("black on black has ratio 1:1", () => {
    const ratio = contrastRatio("#000000", "#000000");
    expect(ratio).toBeCloseTo(1, 1);
  });

  it("ratio is symmetric (order of colors does not matter)", () => {
    const r1 = contrastRatio("#ff0000", "#ffffff");
    const r2 = contrastRatio("#ffffff", "#ff0000");
    expect(r1).toBeCloseTo(r2, 3);
  });
});

describe("wcagAssessment - full threshold coverage", () => {
  it("very low contrast (ratio=1.5) fails all thresholds", () => {
    const a = wcagAssessment(1.5);
    expect(a.aaNormal).toBe(false);
    expect(a.aaLarge).toBe(false);
    expect(a.aaaNormal).toBe(false);
    expect(a.aaaLarge).toBe(false);
  });

  it("ratio=3 passes aaLarge only", () => {
    const a = wcagAssessment(3);
    expect(a.aaLarge).toBe(true);
    expect(a.aaNormal).toBe(false);
    expect(a.aaaNormal).toBe(false);
    expect(a.aaaLarge).toBe(false);
  });

  it("ratio=4.5 passes aaNormal, aaLarge, and aaaLarge", () => {
    const a = wcagAssessment(4.5);
    expect(a.aaNormal).toBe(true);
    expect(a.aaLarge).toBe(true);
    expect(a.aaaLarge).toBe(true);
    expect(a.aaaNormal).toBe(false);
  });

  it("ratio=7 passes all thresholds including aaaNormal", () => {
    const a = wcagAssessment(7);
    expect(a.aaNormal).toBe(true);
    expect(a.aaLarge).toBe(true);
    expect(a.aaaNormal).toBe(true);
    expect(a.aaaLarge).toBe(true);
  });
});

// ── share.ts - encodeState/decodeState error paths ───────────────────────────

const SAMPLE: ShareableState = {
  palette: {
    colors: ["#ff0000", "#00ff00"],
    locked: [false, false],
    count: 2,
    harmonyMode: "analogous",
  },
  twoPoint: { start: "#ff0000", end: "#0000ff", steps: 5 },
  threePoint: { start: "#ff0000", mid: "#00ff00", end: "#0000ff", steps: 5 },
  space: "lab",
};

describe("encodeState / decodeState - additional error paths", () => {
  it("decodeState returns null for empty string", () => {
    expect(decodeState("")).toBeNull();
  });

  it("decodeState returns null for garbage base64url", () => {
    expect(decodeState("!!!garbage!!!")).toBeNull();
  });

  it("decodeState returns null for valid base64url that is not JSON", () => {
    // base64url of "not json"
    const b64 = btoa("not json").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeState(b64)).toBeNull();
  });

  it("encodeState produces a non-empty string", () => {
    expect(encodeState(SAMPLE).length).toBeGreaterThan(0);
  });

  it("encode/decode roundtrip preserves all space values", () => {
    for (const space of ["lab", "rgb", "hsl"] as const) {
      const state = { ...SAMPLE, space };
      const decoded = decodeState(encodeState(state));
      expect(decoded?.space).toBe(space);
    }
  });
});

// ── useBlackText - NaN/undefined guard (culori wcagLuminance) ─────────────────

describe("useBlackText - degenerate input", () => {
  it("returns true (use black text) for an invalid hex string", () => {
    // culori wcagLuminance throws on unparseable input; useBlackText must
    // not propagate the exception or silently return false.
    expect(useBlackText("not-a-colour")).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(useBlackText("")).toBe(true);
  });

  it("returns false (use white text) for a very dark colour", () => {
    expect(useBlackText("#000000")).toBe(false);
  });

  it("returns true (use black text) for a very light colour", () => {
    expect(useBlackText("#ffffff")).toBe(true);
  });
});
