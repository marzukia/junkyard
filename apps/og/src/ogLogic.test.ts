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

describe("parseHex", () => {
  it("parses a 6-char hex", () => {
    expect(parseHex("#2f9d8d")).toEqual([47, 157, 141]);
  });

  it("parses a 3-char hex (shorthand)", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
  });

  it("returns null for invalid hex", () => {
    expect(parseHex("#zzzzzz")).toBeNull();
    expect(parseHex("notahex")).toBeNull();
  });

  it("handles no-hash input", () => {
    expect(parseHex("1a2530")).toEqual([26, 37, 48]);
  });
});

describe("isValidHex", () => {
  it("returns true for valid hex", () => {
    expect(isValidHex("#2f9d8d")).toBe(true);
    expect(isValidHex("#fff")).toBe(true);
  });

  it("returns false for invalid hex", () => {
    expect(isValidHex("#xyzxyz")).toBe(false);
    expect(isValidHex("rgb(0,0,0)")).toBe(false);
  });
});

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(-5, 0, 100)).toBe(0));
  it("clamps above max", () => expect(clamp(200, 0, 100)).toBe(100));
  it("passes through value in range", () => expect(clamp(50, 0, 100)).toBe(50));
  it("handles exact min/max", () => {
    expect(clamp(0, 0, 1)).toBe(0);
    expect(clamp(1, 0, 1)).toBe(1);
  });
});

describe("resolveBgCss", () => {
  it("returns colour for solid type", () => {
    expect(
      resolveBgCss({
        bgType: "solid",
        bgColor: "#ff0000",
        bgColorEnd: "#00ff00",
        gradientAngle: 90,
      })
    ).toBe("#ff0000");
  });

  it("returns gradient CSS for gradient type", () => {
    const result = resolveBgCss({
      bgType: "gradient",
      bgColor: "#2f9d8d",
      bgColorEnd: "#1a2530",
      gradientAngle: 135,
    });
    expect(result).toBe("linear-gradient(135deg, #2f9d8d, #1a2530)");
  });
});

describe("resolveFontFamily", () => {
  it("returns Inter for 'inter'", () => {
    expect(resolveFontFamily("inter")).toContain("Inter");
  });

  it("returns JetBrains Mono for 'mono'", () => {
    expect(resolveFontFamily("mono")).toContain("JetBrains Mono");
  });

  it("returns Georgia for 'serif'", () => {
    expect(resolveFontFamily("serif")).toContain("Georgia");
  });
});

describe("applyTemplate", () => {
  it("applies a partial patch to the base config", () => {
    const brandTpl = TEMPLATES.brand;
    if (!brandTpl) throw new Error("brand template missing");
    const result = applyTemplate(DEFAULT_CONFIG, brandTpl);
    expect(result.bgType).toBe("gradient");
    expect(result.layout).toBe("brand");
    // Properties not in the patch remain from base
    expect(result.title).toBe(DEFAULT_CONFIG.title);
    expect(result.subtitle).toBe(DEFAULT_CONFIG.subtitle);
  });

  it("does not mutate the base config", () => {
    const originalBgColor = DEFAULT_CONFIG.bgColor;
    const coralTpl = TEMPLATES.coral;
    if (!coralTpl) throw new Error("coral template missing");
    applyTemplate(DEFAULT_CONFIG, coralTpl);
    expect(DEFAULT_CONFIG.bgColor).toBe(originalBgColor);
  });

  it("applies light template correctly", () => {
    const lightTpl = TEMPLATES.light;
    if (!lightTpl) throw new Error("light template missing");
    const result = applyTemplate(DEFAULT_CONFIG, lightTpl);
    expect(result.bgType).toBe("solid");
    expect(result.bgColor).toBe("#fafafa");
    expect(result.textColor).toBe("#1a2530");
  });
});

describe("TEMPLATES", () => {
  it("has all expected keys", () => {
    expect(Object.keys(TEMPLATES)).toEqual(
      expect.arrayContaining(["dark", "brand", "light", "coral", "mono"])
    );
  });

  it("brand template has brand layout", () => {
    expect(TEMPLATES.brand?.layout).toBe("brand");
  });
});

describe("SIZE_PRESETS", () => {
  it("includes OG preset at 1200x630", () => {
    const og = SIZE_PRESETS.find((p) => p.width === 1200 && p.height === 630);
    expect(og).toBeDefined();
    expect(og?.label).toContain("OG");
  });

  it("includes Twitter preset at 1200x600", () => {
    const tw = SIZE_PRESETS.find((p) => p.width === 1200 && p.height === 600);
    expect(tw).toBeDefined();
    expect(tw?.label).toMatch(/Twitter|X/);
  });

  it("includes a square preset", () => {
    const sq = SIZE_PRESETS.find((p) => p.width === p.height);
    expect(sq).toBeDefined();
  });
});

describe("buildMetaSnippet", () => {
  it("includes og:title with the given title", () => {
    const snippet = buildMetaSnippet("My Page", "A description", "https://x.com/og.png", 1200, 630);
    expect(snippet).toContain(`og:title" content="My Page"`);
  });

  it("includes twitter:card summary_large_image", () => {
    const snippet = buildMetaSnippet("T", "D", "https://x.com/og.png", 1200, 630);
    expect(snippet).toContain(`twitter:card" content="summary_large_image"`);
  });

  it("includes og:image:width and og:image:height", () => {
    const snippet = buildMetaSnippet("T", "D", "https://x.com/og.png", 1200, 627);
    expect(snippet).toContain(`og:image:width" content="1200"`);
    expect(snippet).toContain(`og:image:height" content="627"`);
  });

  it("escapes double quotes in title", () => {
    const snippet = buildMetaSnippet(`Say "hello"`, "D", "https://x.com/og.png", 1200, 630);
    expect(snippet).toContain("&quot;hello&quot;");
    expect(snippet).not.toContain(`content="Say "hello""`);
  });

  it("includes the image URL in both og:image and twitter:image", () => {
    const url = "https://example.com/share.png";
    const snippet = buildMetaSnippet("T", "D", url, 1200, 630);
    const matches = snippet.match(new RegExp(url, "g"));
    expect(matches?.length).toBe(2);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("includes logoImage and logoSize fields", () => {
    expect(DEFAULT_CONFIG).toHaveProperty("logoImage", null);
    expect(DEFAULT_CONFIG).toHaveProperty("logoSize", 80);
  });
});

describe("estimateTitleLines", () => {
  it("returns 1 for a short title", () => {
    expect(estimateTitleLines("Hello", 1200, 71)).toBe(1);
  });

  it("returns 0 for empty string", () => {
    expect(estimateTitleLines("", 1200, 71)).toBe(0);
  });

  it("returns more than 1 for a very long title", () => {
    const longTitle =
      "This is a very long title that should definitely wrap across multiple lines on the canvas";
    expect(estimateTitleLines(longTitle, 1200, 71)).toBeGreaterThan(1);
  });

  it("reports more lines for smaller canvas width", () => {
    const title = "Four words here done";
    const wideLines = estimateTitleLines(title, 1200, 71);
    const narrowLines = estimateTitleLines(title, 400, 71);
    expect(narrowLines).toBeGreaterThanOrEqual(wideLines);
  });
});
