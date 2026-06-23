import { describe, expect, it } from "vitest";
import {
  CONTRAST_THRESHOLD_GOOD,
  CONTRAST_THRESHOLD_WARN,
  classifyContrast,
  contrastRatio,
  relativeLuminance,
  suggestFgForBg,
} from "./contrast";

describe("relativeLuminance", () => {
  it("returns 0 for black", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("returns 1 for white", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("returns null for invalid hex", () => {
    expect(relativeLuminance("notcolour")).toBeNull();
  });

  it("returns a value between 0 and 1 for grey", () => {
    const L = relativeLuminance("#888888");
    expect(L).not.toBeNull();
    if (L !== null) {
      expect(L).toBeGreaterThan(0);
      expect(L).toBeLessThan(1);
    }
  });
});

describe("contrastRatio", () => {
  it("returns ~21 for black on white", () => {
    const ratio = contrastRatio("#000000", "#ffffff");
    expect(ratio).not.toBeNull();
    if (ratio !== null) expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 1 for identical colours", () => {
    const ratio = contrastRatio("#aabbcc", "#aabbcc");
    expect(ratio).not.toBeNull();
    if (ratio !== null) expect(ratio).toBeCloseTo(1, 5);
  });

  it("is symmetric: fg/bg order does not matter", () => {
    const r1 = contrastRatio("#1a2530", "#ffffff");
    const r2 = contrastRatio("#ffffff", "#1a2530");
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    if (r1 !== null && r2 !== null) expect(r1).toBeCloseTo(r2, 5);
  });

  it("returns null if either colour is invalid", () => {
    expect(contrastRatio("bad", "#ffffff")).toBeNull();
    expect(contrastRatio("#ffffff", "bad")).toBeNull();
  });
});

describe("suggestFgForBg", () => {
  it("suggests white text on a dark background", () => {
    expect(suggestFgForBg("#1a2530")).toBe("#ffffff");
  });

  it("suggests black text on a light background", () => {
    expect(suggestFgForBg("#ffffff")).toBe("#000000");
  });

  it("falls back to black for invalid hex", () => {
    expect(suggestFgForBg("invalid")).toBe("#000000");
  });
});

describe("classifyContrast", () => {
  it("classifies >= 4.5 as good", () => {
    expect(classifyContrast(CONTRAST_THRESHOLD_GOOD)).toBe("good");
    expect(classifyContrast(10)).toBe("good");
  });

  it("classifies >= 3 and < 4.5 as warn", () => {
    expect(classifyContrast(CONTRAST_THRESHOLD_WARN)).toBe("warn");
    expect(classifyContrast(3.5)).toBe("warn");
  });

  it("classifies < 3 as fail", () => {
    expect(classifyContrast(1.5)).toBe("fail");
    expect(classifyContrast(2.9)).toBe("fail");
  });
});
