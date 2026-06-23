/**
 * Augmented tests for ogLogic.ts.
 * Covers pathways not reached by existing tests:
 * - parseHex with 5-char / 7-char / empty input
 * - buildMetaSnippet with special chars in URL and description
 * - estimateTitleLines single very long word
 * - resolveBgCss with gradient at 0 degrees
 * - SIZE_PRESETS all entries have positive dimensions
 * - TEMPLATES all entries have bgColor and bgType
 * - applyTemplate with mono template
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  SIZE_PRESETS,
  TEMPLATES,
  applyTemplate,
  buildMetaSnippet,
  clamp,
  estimateTitleLines,
  isValidHex,
  parseHex,
  resolveBgCss,
  resolveFontFamily,
} from "./ogLogic";

// ── parseHex — additional negative cases ─────────────────────────────────────

describe("parseHex — additional negative cases", () => {
  it("returns null for 5-char hex", () => {
    expect(parseHex("#12345")).toBeNull();
  });

  it("returns null for 7-char hex", () => {
    expect(parseHex("#1234567")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHex("")).toBeNull();
  });

  it("returns null for only a hash", () => {
    expect(parseHex("#")).toBeNull();
  });

  it("returns null for non-hex 3-char", () => {
    expect(parseHex("#xyz")).toBeNull();
  });

  it("parses black correctly", () => {
    expect(parseHex("#000000")).toEqual([0, 0, 0]);
  });

  it("parses white correctly", () => {
    expect(parseHex("#ffffff")).toEqual([255, 255, 255]);
  });

  it("parses shorthand black correctly", () => {
    expect(parseHex("#000")).toEqual([0, 0, 0]);
  });
});

// ── isValidHex — additional cases ────────────────────────────────────────────

describe("isValidHex — additional cases", () => {
  it("returns false for rgba()", () => {
    expect(isValidHex("rgba(0,0,0,1)")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidHex("")).toBe(false);
  });

  it("returns true for no-hash 6-char hex", () => {
    // parseHex handles no-hash input
    expect(isValidHex("2f9d8d")).toBe(true);
  });

  it("returns false for a CSS color name", () => {
    expect(isValidHex("red")).toBe(false);
  });
});

// ── clamp — additional cases ──────────────────────────────────────────────────

describe("clamp — additional cases", () => {
  it("handles negative range correctly", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  it("handles equal min and max", () => {
    expect(clamp(0, 5, 5)).toBe(5);
    expect(clamp(5, 5, 5)).toBe(5);
    expect(clamp(10, 5, 5)).toBe(5);
  });

  it("passes float values through unchanged", () => {
    expect(clamp(0.5, 0, 1)).toBeCloseTo(0.5);
  });
});

// ── resolveBgCss — additional cases ──────────────────────────────────────────

describe("resolveBgCss — additional cases", () => {
  it("uses 0-degree angle in gradient", () => {
    const result = resolveBgCss({
      bgType: "gradient",
      bgColor: "#000",
      bgColorEnd: "#fff",
      gradientAngle: 0,
    });
    expect(result).toBe("linear-gradient(0deg, #000, #fff)");
  });

  it("returns exact bgColor string for solid (no angle used)", () => {
    const result = resolveBgCss({
      bgType: "solid",
      bgColor: "rgba(0,0,0,0.5)",
      bgColorEnd: "#fff",
      gradientAngle: 90,
    });
    expect(result).toBe("rgba(0,0,0,0.5)");
  });
});

// ── resolveFontFamily — additional cases ──────────────────────────────────────

describe("resolveFontFamily — additional cases", () => {
  it("returns system-ui fallback for inter", () => {
    expect(resolveFontFamily("inter")).toContain("system-ui");
  });

  it("returns a non-empty string for all three presets", () => {
    for (const preset of ["inter", "mono", "serif"] as const) {
      expect(resolveFontFamily(preset).length).toBeGreaterThan(0);
    }
  });
});

// ── estimateTitleLines — additional cases ────────────────────────────────────

describe("estimateTitleLines — additional cases", () => {
  it("returns 1 for a single very long word (cannot wrap)", () => {
    // A single word never wraps regardless of length in this heuristic
    const result = estimateTitleLines("supercalifragilisticexpialidocious", 1200, 71);
    // Single word means lineW starts at 0 and testW=wordW — only wraps if lineW > 0
    expect(result).toBe(1);
  });

  it("increases line count proportionally with very small canvas", () => {
    const title = "The Quick Brown Fox Jumps Over The Lazy Dog";
    const wideLines = estimateTitleLines(title, 1200, 71);
    const tinyLines = estimateTitleLines(title, 200, 71);
    expect(tinyLines).toBeGreaterThan(wideLines);
  });

  it("handles title with many short words", () => {
    const result = estimateTitleLines("a b c d e f g h i j k l", 1200, 71);
    expect(result).toBeGreaterThanOrEqual(1);
  });
});

// ── SIZE_PRESETS — completeness ───────────────────────────────────────────────

describe("SIZE_PRESETS — completeness", () => {
  it("all presets have positive width and height", () => {
    for (const preset of SIZE_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
  });

  it("all presets have non-empty label", () => {
    for (const preset of SIZE_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("includes LinkedIn preset", () => {
    const li = SIZE_PRESETS.find((p) => p.label.includes("LinkedIn"));
    expect(li).toBeDefined();
  });
});

// ── TEMPLATES — completeness ──────────────────────────────────────────────────

describe("TEMPLATES — completeness", () => {
  it("all templates have bgType and bgColor", () => {
    for (const [name, tpl] of Object.entries(TEMPLATES)) {
      expect(tpl.bgType, `${name}.bgType missing`).toBeTruthy();
      expect(tpl.bgColor, `${name}.bgColor missing`).toBeTruthy();
    }
  });

  it("all templates have textColor", () => {
    for (const [name, tpl] of Object.entries(TEMPLATES)) {
      expect(tpl.textColor, `${name}.textColor missing`).toBeTruthy();
    }
  });

  it("gradient templates have gradientAngle", () => {
    for (const [name, tpl] of Object.entries(TEMPLATES)) {
      if (tpl.bgType === "gradient") {
        expect(tpl.gradientAngle, `${name} missing gradientAngle`).toBeDefined();
      }
    }
  });
});

// ── applyTemplate — additional cases ─────────────────────────────────────────

describe("applyTemplate — additional cases", () => {
  it("applies mono template correctly", () => {
    const monoTpl = TEMPLATES.mono;
    if (!monoTpl) throw new Error("mono template missing");
    const result = applyTemplate(DEFAULT_CONFIG, monoTpl);
    expect(result.font).toBe("mono");
    expect(result.bgType).toBe("solid");
  });

  it("applies coral template with gradient", () => {
    const coralTpl = TEMPLATES.coral;
    if (!coralTpl) throw new Error("coral template missing");
    const result = applyTemplate(DEFAULT_CONFIG, coralTpl);
    expect(result.bgType).toBe("gradient");
    expect(result.gradientAngle).toBe(120);
  });

  it("preserves bgImageOpacity from base when template does not override it", () => {
    const result = applyTemplate(DEFAULT_CONFIG, TEMPLATES.dark ?? {});
    expect(result.bgImageOpacity).toBe(DEFAULT_CONFIG.bgImageOpacity);
  });
});

// ── buildMetaSnippet — additional cases ──────────────────────────────────────

describe("buildMetaSnippet — additional cases", () => {
  it("does not double-escape already-escaped content", () => {
    // Title with a single double-quote
    const snippet = buildMetaSnippet('A"B', "D", "https://x.com/og.png", 1200, 630);
    // Should have &quot; once, not &amp;quot;
    expect(snippet).toContain("&quot;");
    expect(snippet).not.toContain("&amp;quot;");
  });

  it("includes both og: and twitter: description", () => {
    const snippet = buildMetaSnippet("T", "My description", "https://x.com/og.png", 1200, 630);
    expect(snippet).toContain('og:description" content="My description"');
    expect(snippet).toContain('twitter:description" content="My description"');
  });

  it("handles empty title and description", () => {
    const snippet = buildMetaSnippet("", "", "https://x.com/og.png", 1200, 630);
    expect(snippet).toContain('og:title" content=""');
  });

  it("output is a multi-line string", () => {
    const snippet = buildMetaSnippet("T", "D", "https://x.com/og.png", 1200, 630);
    expect(snippet.split("\n").length).toBeGreaterThan(5);
  });
});

// ── DEFAULT_CONFIG — completeness ─────────────────────────────────────────────

describe("DEFAULT_CONFIG — completeness", () => {
  it("has a valid bgType", () => {
    expect(["solid", "gradient"]).toContain(DEFAULT_CONFIG.bgType);
  });

  it("has a valid layout", () => {
    expect(["centered", "left", "brand"]).toContain(DEFAULT_CONFIG.layout);
  });

  it("has a valid font preset", () => {
    expect(["inter", "mono", "serif"]).toContain(DEFAULT_CONFIG.font);
  });

  it("bgImageOpacity is between 0 and 1", () => {
    expect(DEFAULT_CONFIG.bgImageOpacity).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.bgImageOpacity).toBeLessThanOrEqual(1);
  });
});
