import { describe, expect, it } from "vitest";
import {
  buildBezierRule,
  buildBezierValue,
  buildBorderRadiusRule,
  buildBorderRadiusValue,
  buildBoxShadow,
  buildBoxShadowRule,
  buildConicGradient,
  buildConicGradientRule,
  buildGlassCss,
  buildLinearGradient,
  buildLinearGradientRule,
  buildRadialGradient,
  buildRadialGradientRule,
  buildTransformValue,
  buildTransitionRule,
  clamp,
  hexToRgba,
  isValidHex,
} from "./css";

describe("hexToRgba", () => {
  it("converts 6-digit hex to rgba", () => {
    expect(hexToRgba("#ff0000", 1)).toBe("rgba(255, 0, 0, 1)");
  });

  it("converts 3-digit hex to rgba", () => {
    expect(hexToRgba("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });

  it("strips leading hash", () => {
    expect(hexToRgba("#2f9d8d", 1)).toBe("rgba(47, 157, 141, 1)");
  });

  it("clamps opacity above 1", () => {
    expect(hexToRgba("#000000", 2)).toBe("rgba(0, 0, 0, 1)");
  });

  it("clamps opacity below 0", () => {
    expect(hexToRgba("#000000", -1)).toBe("rgba(0, 0, 0, 0)");
  });

  it("throws on invalid hex (non-hex characters)", () => {
    expect(() => hexToRgba("notahex", 0.5)).toThrow("Invalid hex colour");
  });
});

describe("isValidHex", () => {
  it("accepts 6-digit hex", () => {
    expect(isValidHex("#2f9d8d")).toBe(true);
  });

  it("accepts 3-digit hex", () => {
    expect(isValidHex("#abc")).toBe(true);
  });

  it("rejects hex without hash", () => {
    expect(isValidHex("2f9d8d")).toBe(false);
  });

  it("rejects 5-digit hex", () => {
    expect(isValidHex("#12345")).toBe(false);
  });

  it("rejects non-hex chars", () => {
    expect(isValidHex("#zzzzzz")).toBe(false);
  });
});

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });

  it("passes through value within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe("buildBoxShadow", () => {
  it("produces correct box-shadow value", () => {
    const result = buildBoxShadow({
      offsetX: 4,
      offsetY: 8,
      blur: 16,
      spread: 0,
      color: "#000000",
      opacity: 0.25,
      inset: false,
    });
    expect(result).toBe("4px 8px 16px 0px rgba(0, 0, 0, 0.25)");
  });

  it("includes inset keyword when inset=true", () => {
    const result = buildBoxShadow({
      offsetX: 0,
      offsetY: 2,
      blur: 4,
      spread: 0,
      color: "#000000",
      opacity: 0.5,
      inset: true,
    });
    expect(result).toContain("inset");
  });

  it("does not include inset keyword when inset=false", () => {
    const result = buildBoxShadow({
      offsetX: 0,
      offsetY: 2,
      blur: 4,
      spread: 0,
      color: "#000000",
      opacity: 0.5,
      inset: false,
    });
    expect(result).not.toContain("inset");
  });
});

describe("buildBoxShadowRule", () => {
  it("wraps value in box-shadow property", () => {
    const result = buildBoxShadowRule({
      offsetX: 0,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: "#000000",
      opacity: 0.2,
      inset: false,
    });
    expect(result).toMatch(/^box-shadow: .+;$/);
  });
});

describe("buildLinearGradient", () => {
  it("produces correct linear-gradient value", () => {
    const result = buildLinearGradient({
      angle: 90,
      stops: [
        { id: "a", color: "#ff0000", position: 0 },
        { id: "b", color: "#0000ff", position: 100 },
      ],
    });
    expect(result).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
  });

  it("sorts stops by position", () => {
    const result = buildLinearGradient({
      angle: 0,
      stops: [
        { id: "a", color: "#blue", position: 100 },
        { id: "b", color: "#red", position: 0 },
      ],
    });
    expect(result.indexOf("0%")).toBeLessThan(result.indexOf("100%"));
  });

  it("returns none for empty stops", () => {
    expect(buildLinearGradient({ angle: 45, stops: [] })).toBe("none");
  });
});

describe("buildLinearGradientRule", () => {
  it("wraps in background property", () => {
    const result = buildLinearGradientRule({
      angle: 45,
      stops: [
        { id: "a", color: "#fff", position: 0 },
        { id: "b", color: "#000", position: 100 },
      ],
    });
    expect(result).toMatch(/^background: linear-gradient/);
  });
});

describe("buildRadialGradient", () => {
  it("produces correct radial-gradient value", () => {
    const result = buildRadialGradient({
      shape: "circle",
      posX: 50,
      posY: 50,
      stops: [
        { id: "a", color: "#ff0000", position: 0 },
        { id: "b", color: "#0000ff", position: 100 },
      ],
    });
    expect(result).toBe("radial-gradient(circle at 50% 50%, #ff0000 0%, #0000ff 100%)");
  });

  it("supports ellipse shape", () => {
    const result = buildRadialGradient({
      shape: "ellipse",
      posX: 50,
      posY: 50,
      stops: [
        { id: "a", color: "#fff", position: 0 },
        { id: "b", color: "#000", position: 100 },
      ],
    });
    expect(result).toContain("ellipse");
  });
});

describe("buildGlassCss", () => {
  it("includes backdrop-filter", () => {
    const result = buildGlassCss({
      blur: 12,
      saturation: 180,
      bgColor: "#ffffff",
      bgOpacity: 0.2,
      borderOpacity: 0.3,
      borderRadius: 16,
    });
    expect(result).toContain("backdrop-filter: blur(12px)");
  });

  it("includes -webkit-backdrop-filter", () => {
    const result = buildGlassCss({
      blur: 8,
      saturation: 150,
      bgColor: "#ffffff",
      bgOpacity: 0.15,
      borderOpacity: 0.2,
      borderRadius: 12,
    });
    expect(result).toContain("-webkit-backdrop-filter:");
  });

  it("includes border-radius", () => {
    const result = buildGlassCss({
      blur: 8,
      saturation: 150,
      bgColor: "#ffffff",
      bgOpacity: 0.15,
      borderOpacity: 0.2,
      borderRadius: 24,
    });
    expect(result).toContain("border-radius: 24px");
  });
});

describe("buildBezierValue", () => {
  it("formats to 3 decimal places max", () => {
    const result = buildBezierValue({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 });
    expect(result).toBe("cubic-bezier(0.42, 0, 0.58, 1)");
  });

  it("produces correct ease-in-out", () => {
    const result = buildBezierValue({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 });
    expect(result).toContain("0.42");
  });
});

describe("buildBezierRule", () => {
  it("wraps in transition-timing-function property", () => {
    const result = buildBezierRule({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
    expect(result).toMatch(/^transition-timing-function: cubic-bezier/);
    expect(result).toMatch(/;$/);
  });
});

// ── Border Radius ─────────────────────────────────────────────────────────────

describe("buildBorderRadiusValue", () => {
  it("returns single value when linked", () => {
    const result = buildBorderRadiusValue({
      linked: true,
      all: 16,
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
      unit: "px",
    });
    expect(result).toBe("16px");
  });

  it("returns 4-value shorthand when all corners differ", () => {
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

  it("collapses to 1 value when all corners are equal", () => {
    const result = buildBorderRadiusValue({
      linked: false,
      all: 0,
      topLeft: 12,
      topRight: 12,
      bottomRight: 12,
      bottomLeft: 12,
      unit: "px",
    });
    expect(result).toBe("12px");
  });

  it("supports % unit", () => {
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

describe("buildBorderRadiusRule", () => {
  it("wraps value in border-radius property", () => {
    const result = buildBorderRadiusRule({
      linked: true,
      all: 8,
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
      unit: "px",
    });
    expect(result).toBe("border-radius: 8px;");
  });
});

// ── Conic Gradient ────────────────────────────────────────────────────────────

describe("buildConicGradient", () => {
  it("produces a conic-gradient with angle and position", () => {
    const result = buildConicGradient({
      angle: 0,
      posX: 50,
      posY: 50,
      stops: [
        { id: "a", color: "#ff0000", position: 0 },
        { id: "b", color: "#0000ff", position: 100 },
      ],
    });
    expect(result).toBe("conic-gradient(from 0deg at 50% 50%, #ff0000 0%, #0000ff 100%)");
  });

  it("sorts stops by position", () => {
    const result = buildConicGradient({
      angle: 0,
      posX: 50,
      posY: 50,
      stops: [
        { id: "b", color: "#0000ff", position: 100 },
        { id: "a", color: "#ff0000", position: 0 },
      ],
    });
    expect(result.indexOf("0%")).toBeLessThan(result.indexOf("100%"));
  });

  it("returns none for empty stops", () => {
    expect(buildConicGradient({ angle: 0, posX: 50, posY: 50, stops: [] })).toBe("none");
  });
});

describe("buildConicGradientRule", () => {
  it("wraps in background property", () => {
    const result = buildConicGradientRule({
      angle: 45,
      posX: 50,
      posY: 50,
      stops: [
        { id: "a", color: "#fff", position: 0 },
        { id: "b", color: "#000", position: 100 },
      ],
    });
    expect(result).toMatch(/^background: conic-gradient/);
  });
});

// ── Transform ─────────────────────────────────────────────────────────────────

describe("buildTransformValue", () => {
  it("returns none when all defaults", () => {
    expect(
      buildTransformValue({
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
        rotate: 0,
        skewX: 0,
        skewY: 0,
      })
    ).toBe("none");
  });

  it("includes translate when non-zero", () => {
    const result = buildTransformValue({
      translateX: 20,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      skewX: 0,
      skewY: 0,
    });
    expect(result).toContain("translate(20px, 0px)");
  });

  it("includes rotate when non-zero", () => {
    const result = buildTransformValue({
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotate: 45,
      skewX: 0,
      skewY: 0,
    });
    expect(result).toContain("rotate(45deg)");
  });

  it("uses shorthand scale() when scaleX === scaleY", () => {
    const result = buildTransformValue({
      translateX: 0,
      translateY: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      rotate: 0,
      skewX: 0,
      skewY: 0,
    });
    expect(result).toContain("scale(1.5)");
    expect(result).not.toContain("scale(1.5, 1.5)");
  });

  it("uses scale(x, y) when scaleX !== scaleY", () => {
    const result = buildTransformValue({
      translateX: 0,
      translateY: 0,
      scaleX: 2,
      scaleY: 0.5,
      rotate: 0,
      skewX: 0,
      skewY: 0,
    });
    expect(result).toContain("scale(2, 0.5)");
  });

  it("includes skew when non-zero", () => {
    const result = buildTransformValue({
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      skewX: 10,
      skewY: 5,
    });
    expect(result).toContain("skew(10deg, 5deg)");
  });
});

describe("buildTransitionRule", () => {
  it("includes both transform and transition properties", () => {
    const result = buildTransitionRule(
      { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0 },
      { property: "all", duration: 300, delay: 0, easing: "ease" }
    );
    expect(result).toContain("transform: none;");
    expect(result).toContain("transition: all 0.3s ease;");
  });

  it("includes delay when non-zero", () => {
    const result = buildTransitionRule(
      { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0 },
      { property: "opacity", duration: 200, delay: 100, easing: "linear" }
    );
    expect(result).toContain("0.1s");
  });
});

// ── Store defaults & resets ───────────────────────────────────────────────────
// These guard that persisted state after a reset returns exactly the default
// values the UI shows on first load.

import {
  DEFAULT_BEZIER,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_CONIC,
  DEFAULT_GLASS,
  DEFAULT_LINEAR,
  DEFAULT_RADIAL,
  DEFAULT_SHADOW,
  DEFAULT_TRANSFORM,
  DEFAULT_TRANSITION,
} from "../store/cssStore";

describe("DEFAULT_SHADOW", () => {
  it("produces expected default box-shadow CSS", () => {
    const result = buildBoxShadowRule(DEFAULT_SHADOW);
    expect(result).toMatch(/^box-shadow:/);
    expect(result).toContain("rgba(0, 0, 0, 0.2)");
  });

  it("has inset=false by default", () => {
    expect(DEFAULT_SHADOW.inset).toBe(false);
  });
});

describe("DEFAULT_LINEAR", () => {
  it("produces a valid linear-gradient rule", () => {
    const result = buildLinearGradientRule(DEFAULT_LINEAR);
    expect(result).toMatch(/^background: linear-gradient/);
    expect(result).toContain("135deg");
  });

  it("has exactly 2 stops", () => {
    expect(DEFAULT_LINEAR.stops).toHaveLength(2);
  });
});

describe("DEFAULT_RADIAL", () => {
  it("produces a valid radial-gradient rule", () => {
    const result = buildRadialGradientRule(DEFAULT_RADIAL);
    expect(result).toMatch(/^background: radial-gradient/);
  });

  it("defaults to circle shape at 50% 50%", () => {
    expect(DEFAULT_RADIAL.shape).toBe("circle");
    expect(DEFAULT_RADIAL.posX).toBe(50);
    expect(DEFAULT_RADIAL.posY).toBe(50);
  });
});

describe("DEFAULT_GLASS", () => {
  it("produces valid glassmorphism CSS", () => {
    const result = buildGlassCss(DEFAULT_GLASS);
    expect(result).toContain("backdrop-filter");
    expect(result).toContain("border-radius: 16px");
  });
});

describe("DEFAULT_BEZIER", () => {
  it("matches ease-in-out values", () => {
    const result = buildBezierValue(DEFAULT_BEZIER);
    expect(result).toBe("cubic-bezier(0.42, 0, 0.58, 1)");
  });
});

describe("DEFAULT_BORDER_RADIUS", () => {
  it("produces a linked 16px border-radius rule", () => {
    const result = buildBorderRadiusRule(DEFAULT_BORDER_RADIUS);
    expect(result).toBe("border-radius: 16px;");
  });
});

describe("DEFAULT_CONIC", () => {
  it("produces a valid conic-gradient rule", () => {
    const result = buildConicGradientRule(DEFAULT_CONIC);
    expect(result).toMatch(/^background: conic-gradient/);
  });

  it("has exactly 3 stops", () => {
    expect(DEFAULT_CONIC.stops).toHaveLength(3);
  });
});

describe("DEFAULT_TRANSFORM", () => {
  it("produces none transform (all defaults)", () => {
    expect(buildTransformValue(DEFAULT_TRANSFORM)).toBe("none");
  });
});

describe("DEFAULT_TRANSITION", () => {
  it("produces valid transition rule with default transform", () => {
    const result = buildTransitionRule(DEFAULT_TRANSFORM, DEFAULT_TRANSITION);
    expect(result).toContain("transition: all");
    expect(result).toContain("0.3s");
  });
});
