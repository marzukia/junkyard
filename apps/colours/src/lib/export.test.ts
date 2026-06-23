import { describe, expect, it } from "vitest";
import {
  formatCss,
  formatJson,
  formatPalette,
  formatScss,
  formatSvg,
  formatTailwind,
} from "./export";

const COLORS = ["#ff0000", "#00ff00"];

// ── CSS ───────────────────────────────────────────────────────────────────────

describe("formatCss", () => {
  it("wraps in :root { }", () => {
    const out = formatCss(COLORS);
    expect(out).toMatch(/^:root \{/);
    expect(out).toMatch(/\}$/);
  });

  it("contains --color-1: #ff0000;", () => {
    expect(formatCss(COLORS)).toContain("--color-1: #ff0000;");
  });

  it("contains --color-2: #00ff00;", () => {
    expect(formatCss(COLORS)).toContain("--color-2: #00ff00;");
  });

  it("produces N variables for N colors", () => {
    const out = formatCss(["#111111", "#222222", "#333333"]);
    expect(out).toContain("--color-1");
    expect(out).toContain("--color-2");
    expect(out).toContain("--color-3");
    expect(out).not.toContain("--color-4");
  });
});

// ── Tailwind ──────────────────────────────────────────────────────────────────

describe("formatTailwind", () => {
  it("contains 'color-1': '#ff0000'", () => {
    expect(formatTailwind(COLORS)).toContain("'color-1': '#ff0000'");
  });

  it("contains 'color-2': '#00ff00'", () => {
    expect(formatTailwind(COLORS)).toContain("'color-2': '#00ff00'");
  });

  it("wraps in colors: { }", () => {
    const out = formatTailwind(COLORS);
    expect(out).toMatch(/^colors: \{/);
    expect(out).toMatch(/\}$/);
  });
});

// ── SCSS ──────────────────────────────────────────────────────────────────────

describe("formatScss", () => {
  it("contains $color-1: #ff0000;", () => {
    expect(formatScss(COLORS)).toContain("$color-1: #ff0000;");
  });

  it("contains $color-2: #00ff00;", () => {
    expect(formatScss(COLORS)).toContain("$color-2: #00ff00;");
  });

  it("does not wrap in a block (flat variable declarations)", () => {
    const out = formatScss(COLORS);
    expect(out).not.toContain("{");
    expect(out).not.toContain("}");
  });
});

// ── JSON ──────────────────────────────────────────────────────────────────────

describe("formatJson", () => {
  it("parses back to the input array", () => {
    const out = formatJson(COLORS);
    expect(JSON.parse(out)).toEqual(COLORS);
  });

  it("is pretty-printed (contains newlines)", () => {
    expect(formatJson(COLORS)).toContain("\n");
  });
});

// ── SVG ───────────────────────────────────────────────────────────────────────

describe("formatSvg", () => {
  it("contains two <rect elements for two colors", () => {
    const out = formatSvg(COLORS);
    const matches = out.match(/<rect/g);
    expect(matches).toHaveLength(2);
  });

  it('includes fill="#ff0000"', () => {
    expect(formatSvg(COLORS)).toContain('fill="#ff0000"');
  });

  it('includes fill="#00ff00"', () => {
    expect(formatSvg(COLORS)).toContain('fill="#00ff00"');
  });

  it("is well-formed (opens and closes <svg>)", () => {
    const out = formatSvg(COLORS);
    expect(out).toMatch(/^<svg /);
    expect(out).toContain("</svg>");
  });

  it("includes xmlns attribute (standalone SVG)", () => {
    expect(formatSvg(COLORS)).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("total width equals 80 * count", () => {
    const out = formatSvg(COLORS);
    expect(out).toContain('width="160"');
  });

  it("rects are positioned at x=0 and x=80", () => {
    const out = formatSvg(COLORS);
    expect(out).toContain('x="0"');
    expect(out).toContain('x="80"');
  });
});

// ── Malicious / non-hex input sanitization ────────────────────────────────────

describe("formatSvg — injection safety", () => {
  const MALICIOUS = ['#000"/><script>alert(1)</script><rect fill="', "#000"];

  it("produces no <script tag in output", () => {
    expect(formatSvg(MALICIOUS)).not.toContain("<script");
  });

  it("every fill attribute is a clean #rrggbb value", () => {
    const out = formatSvg(MALICIOUS);
    // Extract all fill="..." values
    const fills = [...out.matchAll(/fill="([^"]*)"/g)].map((m) => m[1]);
    for (const fill of fills) {
      expect(fill).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("formatCss — injection safety", () => {
  it("falls back to #000000 for a non-hex entry and contains no injected text", () => {
    const out = formatCss(['#fff"/><script>', "#ff0000"]);
    expect(out).not.toContain("<script");
    expect(out).toContain("--color-1: #000000;");
  });
});

describe("formatTailwind — injection safety", () => {
  it("falls back to #000000 for a non-hex entry", () => {
    const out = formatTailwind(["bad-color", "#00ff00"]);
    expect(out).toContain("'color-1': '#000000'");
  });
});

describe("formatScss — injection safety", () => {
  it("falls back to #000000 for a non-hex entry", () => {
    const out = formatScss(["notvalid", "#0000ff"]);
    expect(out).toContain("$color-1: #000000;");
  });
});

describe("formatJson — injection safety", () => {
  it("normalizes non-hex entries to #000000 in the JSON array", () => {
    // "notvalid" is not a 3- or 6-digit hex string so it must fall back to #000000
    const parsed = JSON.parse(formatJson(["notvalid", "#123456"]));
    expect(parsed[0]).toBe("#000000");
    expect(parsed[1]).toBe("#123456");
  });
});

// ── formatPalette dispatcher ──────────────────────────────────────────────────

describe("formatPalette", () => {
  it("dispatches css", () => {
    expect(formatPalette(COLORS, "css")).toContain("--color-1");
  });

  it("dispatches tailwind", () => {
    expect(formatPalette(COLORS, "tailwind")).toContain("'color-1'");
  });

  it("dispatches scss", () => {
    expect(formatPalette(COLORS, "scss")).toContain("$color-1");
  });

  it("dispatches json", () => {
    expect(JSON.parse(formatPalette(COLORS, "json"))).toEqual(COLORS);
  });

  it("dispatches svg", () => {
    expect(formatPalette(COLORS, "svg")).toContain("<rect");
  });
});
