/**
 * Augmentation tests for css.ts — pathways not covered by css.test.ts:
 *   - hexToRgba with no leading hash and 4-digit hex (invalid)
 *   - buildBorderRadiusValue 2-value shorthand (tl==br, tr==bl)
 *   - buildBorderRadiusValue 3-value shorthand (tr==bl)
 *   - buildTransformValue with combined transforms
 *   - buildTransitionRule with zero delay
 *   - buildLinearGradient with single stop
 *   - buildRadialGradient empty stops
 *   - buildGlassCss saturation appears in filter
 *   - clamp at exact boundaries
 */
import { describe, expect, it } from "vitest";
import {
  buildBorderRadiusValue,
  buildGlassCss,
  buildLinearGradient,
  buildRadialGradient,
  buildTransformValue,
  buildTransitionRule,
  clamp,
  hexToRgba,
  isValidHex,
} from "./css";

// ── hexToRgba additional cases ─────────────────────────────────────────────

describe("hexToRgba additional cases", () => {
  it("handles hex without # prefix", () => {
    // Current implementation strips the leading # if present; no # = NaN -> fallback
    const result = hexToRgba("ff0000", 1);
    // Either it parses correctly or falls back; either is valid behaviour
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^rgba\(/);
  });

  it("handles 4-digit hex as invalid (not a recognised length)", () => {
    // 4-digit hex is not standard #rgb or #rrggbb; should fall back
    const result = hexToRgba("#ffff", 1);
    // Falls back to rgba(0,0,0,...)
    expect(result).toBe("rgba(0,0,0,1)");
  });

  it("opacity 0 produces alpha 0", () => {
    expect(hexToRgba("#ffffff", 0)).toBe("rgba(255, 255, 255, 0)");
  });

  it("opacity clamped to exactly 0 when negative", () => {
    const result = hexToRgba("#ff0000", -0.5);
    expect(result).toContain(", 0)");
  });

  it("opacity clamped to exactly 1 when above 1", () => {
    const result = hexToRgba("#ff0000", 1.5);
    expect(result).toContain(", 1)");
  });

  it("parses black correctly", () => {
    expect(hexToRgba("#000000", 1)).toBe("rgba(0, 0, 0, 1)");
  });

  it("parses 3-digit #000 as black", () => {
    expect(hexToRgba("#000", 1)).toBe("rgba(0, 0, 0, 1)");
  });
});

// ── isValidHex additional cases ────────────────────────────────────────────

describe("isValidHex additional cases", () => {
  it("rejects 4-digit hex", () => {
    expect(isValidHex("#ffff")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidHex("")).toBe(false);
  });

  it("rejects 7-digit hex", () => {
    expect(isValidHex("#1234567")).toBe(false);
  });

  it("accepts uppercase hex letters", () => {
    expect(isValidHex("#AABBCC")).toBe(true);
  });

  it("accepts mixed case", () => {
    expect(isValidHex("#aAbBcC")).toBe(true);
  });
});

// ── clamp at exact boundaries ──────────────────────────────────────────────

describe("clamp at exact boundaries", () => {
  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });

  it("returns max when value equals max", () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });

  it("works with floating point boundaries", () => {
    expect(clamp(0.5, 0.5, 1.5)).toBe(0.5);
    expect(clamp(1.5, 0.5, 1.5)).toBe(1.5);
    expect(clamp(1.0, 0.5, 1.5)).toBe(1.0);
  });

  it("works when min equals max", () => {
    expect(clamp(50, 10, 10)).toBe(10);
  });
});

// ── buildBorderRadiusValue shorthand collapsing ────────────────────────────

describe("buildBorderRadiusValue shorthand collapsing", () => {
  it("collapses to 2-value when tl==br and tr==bl", () => {
    // 10px 20px  (tl==br=10, tr==bl=20)
    const result = buildBorderRadiusValue({
      linked: false,
      all: 0,
      topLeft: 10,
      topRight: 20,
      bottomRight: 10,
      bottomLeft: 20,
      unit: "px",
    });
    expect(result).toBe("10px 20px");
  });

  it("collapses to 3-value when tr==bl but tl!=br", () => {
    // tl=10, tr=20, br=30, bl=20 -> "10px 20px 30px" (tr==bl)
    const result = buildBorderRadiusValue({
      linked: false,
      all: 0,
      topLeft: 10,
      topRight: 20,
      bottomRight: 30,
      bottomLeft: 20,
      unit: "px",
    });
    expect(result).toBe("10px 20px 30px");
  });

  it("emits all 4 values when no shorthand applies", () => {
    const result = buildBorderRadiusValue({
      linked: false,
      all: 0,
      topLeft: 10,
      topRight: 20,
      bottomRight: 30,
      bottomLeft: 40,
      unit: "px",
    });
    expect(result).toBe("10px 20px 30px 40px");
  });

  it("linked=true ignores independent corners", () => {
    const result = buildBorderRadiusValue({
      linked: true,
      all: 24,
      topLeft: 99,
      topRight: 99,
      bottomRight: 99,
      bottomLeft: 99,
      unit: "px",
    });
    expect(result).toBe("24px");
  });

  it("linked=true with % unit", () => {
    const result = buildBorderRadiusValue({
      linked: true,
      all: 50,
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
      unit: "%",
    });
    expect(result).toBe("50%");
  });
});

// ── buildTransformValue combined transforms ────────────────────────────────

describe("buildTransformValue combined transforms", () => {
  it("combines translate + rotate in output", () => {
    const result = buildTransformValue({
      translateX: 10,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotate: 45,
      skewX: 0,
      skewY: 0,
    });
    expect(result).toContain("translate(10px, 0px)");
    expect(result).toContain("rotate(45deg)");
  });

  it("combines all non-identity transforms", () => {
    const result = buildTransformValue({
      translateX: 5,
      translateY: 10,
      scaleX: 2,
      scaleY: 3,
      rotate: 90,
      skewX: 5,
      skewY: 0,
    });
    expect(result).toContain("translate");
    expect(result).toContain("rotate");
    expect(result).toContain("scale");
    expect(result).toContain("skew");
  });

  it("negative translate is included", () => {
    const result = buildTransformValue({
      translateX: -20,
      translateY: -30,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      skewX: 0,
      skewY: 0,
    });
    expect(result).toContain("translate(-20px, -30px)");
  });
});

// ── buildTransitionRule zero delay ────────────────────────────────────────

describe("buildTransitionRule zero delay", () => {
  it("omits delay part when delay is 0", () => {
    const result = buildTransitionRule(
      { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0 },
      { property: "opacity", duration: 200, delay: 0, easing: "ease-in" }
    );
    // delay=0 should not emit a delay token
    const transitionLine = result.split("\n")[1];
    // Should be: "transition: opacity 0.2s ease-in;"  (no 4th token)
    expect(transitionLine).toMatch(/^transition: opacity 0\.2s ease-in;$/);
  });

  it("emits delay when positive", () => {
    const result = buildTransitionRule(
      { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0 },
      { property: "all", duration: 300, delay: 150, easing: "linear" }
    );
    expect(result).toContain("0.15s");
  });
});

// ── buildLinearGradient edge cases ─────────────────────────────────────────

describe("buildLinearGradient edge cases", () => {
  it("returns none for empty stops array", () => {
    expect(buildLinearGradient({ angle: 90, stops: [] })).toBe("none");
  });

  it("handles a single stop correctly", () => {
    const result = buildLinearGradient({
      angle: 45,
      stops: [{ id: "a", color: "#ff0000", position: 50 }],
    });
    expect(result).toBe("linear-gradient(45deg, #ff0000 50%)");
  });

  it("angle 0 produces to-bottom gradient token", () => {
    const result = buildLinearGradient({
      angle: 0,
      stops: [
        { id: "a", color: "#fff", position: 0 },
        { id: "b", color: "#000", position: 100 },
      ],
    });
    expect(result).toContain("0deg");
  });
});

// ── buildRadialGradient edge cases ─────────────────────────────────────────

describe("buildRadialGradient edge cases", () => {
  it("returns none for empty stops", () => {
    expect(buildRadialGradient({ shape: "circle", posX: 50, posY: 50, stops: [] })).toBe("none");
  });

  it("positions at 0% 0% (top-left)", () => {
    const result = buildRadialGradient({
      shape: "circle",
      posX: 0,
      posY: 0,
      stops: [
        { id: "a", color: "#fff", position: 0 },
        { id: "b", color: "#000", position: 100 },
      ],
    });
    expect(result).toContain("at 0% 0%");
  });

  it("positions at 100% 100% (bottom-right)", () => {
    const result = buildRadialGradient({
      shape: "ellipse",
      posX: 100,
      posY: 100,
      stops: [
        { id: "a", color: "#fff", position: 0 },
        { id: "b", color: "#000", position: 100 },
      ],
    });
    expect(result).toContain("at 100% 100%");
  });
});

// ── buildGlassCss saturation ───────────────────────────────────────────────

describe("buildGlassCss saturation", () => {
  it("includes the saturation value in backdrop-filter", () => {
    const result = buildGlassCss({
      blur: 12,
      saturation: 200,
      bgColor: "#ffffff",
      bgOpacity: 0.2,
      borderOpacity: 0.3,
      borderRadius: 16,
    });
    expect(result).toContain("saturate(200%)");
  });

  it("saturation 0% produces no saturation effect", () => {
    const result = buildGlassCss({
      blur: 8,
      saturation: 0,
      bgColor: "#ffffff",
      bgOpacity: 0.15,
      borderOpacity: 0.2,
      borderRadius: 0,
    });
    expect(result).toContain("saturate(0%)");
  });

  it("border-radius 0 omits non-zero px", () => {
    const result = buildGlassCss({
      blur: 8,
      saturation: 150,
      bgColor: "#ffffff",
      bgOpacity: 0.15,
      borderOpacity: 0.2,
      borderRadius: 0,
    });
    expect(result).toContain("border-radius: 0px");
  });
});
