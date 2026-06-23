/**
 * Augment tests for svg/svgOptimize.ts -- covers gaps in the existing suite:
 * parseFriendlyError additional patterns, toDataUri/toBase64DataUri edge cases,
 * formatBytes edge cases, byteLength multibyte, optimizeSvg with viewBox removal.
 */
import { describe, expect, it } from "vitest";
import {
  byteLength,
  formatBytes,
  optimizeSvg,
  parseFriendlyError,
  toBase64DataUri,
  toDataUri,
  toJsxComponent,
} from "./svgOptimize";
import type { OptimizeOptions } from "./svgOptimize";

const BASE_OPTS: OptimizeOptions = {
  precision: 2,
  stripMetadata: false,
  collapseGroups: false,
  removeViewBox: false,
  removeComments: false,
  convertShapes: false,
  cleanupIds: false,
};

// ── parseFriendlyError -- additional patterns ─────────────────────────────────

describe("parseFriendlyError -- additional patterns", () => {
  it("maps 'svg' + 'root' pattern to no-root message", () => {
    const msg = parseFriendlyError("No svg root found");
    expect(msg).toMatch(/svg.*root|root.*svg|<svg>/i);
  });

  it("maps 'end tag' to a valid SVG message", () => {
    const msg = parseFriendlyError("Unexpected end tag at line 3");
    expect(msg).toMatch(/valid SVG|well-formed|SVG markup/i);
  });

  it("maps 'mismatched' to a valid SVG message", () => {
    const msg = parseFriendlyError("mismatched tag at line 5");
    expect(msg).toMatch(/valid SVG|well-formed|SVG markup/i);
  });

  it("maps 'unmatched' to a valid SVG message", () => {
    const msg = parseFriendlyError("unmatched opening tag");
    expect(msg).toMatch(/valid SVG|well-formed|SVG markup/i);
  });

  it("maps 'unexpected token' to a valid SVG message", () => {
    const msg = parseFriendlyError("unexpected token <");
    expect(msg).toMatch(/valid SVG|well-formed|SVG markup/i);
  });

  it("always returns a non-empty string", () => {
    expect(parseFriendlyError("").length).toBeGreaterThan(0);
    expect(parseFriendlyError("completely random error xyz").length).toBeGreaterThan(0);
  });
});

// ── toDataUri -- edge cases ───────────────────────────────────────────────────

describe("toDataUri -- edge cases", () => {
  it("handles empty string without throwing", () => {
    const uri = toDataUri("");
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("encodes < and > characters", () => {
    const uri = toDataUri("<svg/>");
    expect(uri).toContain("%3C");
    expect(uri).toContain("%3E");
  });

  it("result can be used as an href (starts with data:)", () => {
    const uri = toDataUri("<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect(uri.startsWith("data:")).toBe(true);
  });
});

// ── toBase64DataUri -- edge cases ─────────────────────────────────────────────

describe("toBase64DataUri -- edge cases", () => {
  it("handles minimal SVG", () => {
    const uri = toBase64DataUri("<svg/>");
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    const b64 = uri.replace("data:image/svg+xml;base64,", "");
    expect(b64.length).toBeGreaterThan(0);
  });

  it("empty string produces valid base64 URI", () => {
    const uri = toBase64DataUri("");
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("round-trips through atob", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
    const uri = toBase64DataUri(svg);
    const b64 = uri.replace("data:image/svg+xml;base64,", "");
    const decoded = atob(b64);
    expect(decoded).toBe(svg);
  });
});

// ── byteLength -- additional paths ────────────────────────────────────────────

describe("byteLength -- additional paths", () => {
  it("empty string is 0 bytes", () => {
    expect(byteLength("")).toBe(0);
  });

  it("Japanese character is 3 bytes", () => {
    // U+3042 HIRAGANA LETTER A -- 3 bytes in UTF-8
    expect(byteLength("あ")).toBe(3);
  });

  it("4-byte emoji character", () => {
    // U+1F600 GRINNING FACE -- 4 bytes
    expect(byteLength("\u{1F600}")).toBe(4);
  });
});

// ── formatBytes -- additional paths ──────────────────────────────────────────

describe("formatBytes -- additional paths", () => {
  it("formats exactly 1024 as 1.0 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1024*1024 as 1.00 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });

  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats 1023 bytes as B (not KB)", () => {
    expect(formatBytes(1023)).toBe("1023 B");
  });
});

// ── optimizeSvg -- additional option paths ────────────────────────────────────

describe("optimizeSvg -- additional option paths", () => {
  const SVG_WITH_VIEWBOX = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40"/>
  </svg>`;

  it("preserves viewBox when removeViewBox=false", () => {
    const result = optimizeSvg(SVG_WITH_VIEWBOX, { ...BASE_OPTS, removeViewBox: false });
    expect(result.optimized).toContain("viewBox");
  });

  it("returns originalBytes equal to byteLength of input", () => {
    const result = optimizeSvg(SVG_WITH_VIEWBOX, BASE_OPTS);
    expect(result.originalBytes).toBe(byteLength(SVG_WITH_VIEWBOX));
  });

  it("saving is between 0 and 1 for a normal SVG", () => {
    const result = optimizeSvg(SVG_WITH_VIEWBOX, { ...BASE_OPTS, precision: 1 });
    expect(result.saving).toBeGreaterThanOrEqual(0);
    expect(result.saving).toBeLessThanOrEqual(1);
  });

  it("throws for empty input (fixed: was silently passing to SVGO)", () => {
    expect(() => optimizeSvg("", BASE_OPTS)).toThrow(/not an SVG/i);
  });

  it("throws for HTML input without <svg> root (fixed: was passing to SVGO)", () => {
    expect(() => optimizeSvg("<html><body>Hello</body></html>", BASE_OPTS)).toThrow(/not an SVG/i);
  });
});

// ── toJsxComponent -- additional paths ───────────────────────────────────────

describe("toJsxComponent -- additional paths", () => {
  it("converts fill-rule to fillRule", () => {
    const jsx = toJsxComponent('<svg><path fill-rule="evenodd"/></svg>');
    expect(jsx).toContain("fillRule=");
  });

  it("does not double-apply className conversion", () => {
    const jsx = toJsxComponent('<svg><g className="x"/></svg>');
    // className already correct; should not appear twice or broken
    expect(jsx).toContain("className=");
  });

  it("does not corrupt class= inside an attribute string value", () => {
    // aria-label value contains the text "class=" -- must not be replaced
    const input = '<svg><g aria-label="has class= here" class="real"/></svg>';
    const jsx = toJsxComponent(input);
    // The attribute-name class= should become className=
    expect(jsx).toContain('className="real"');
    // The string content "has class= here" should NOT be corrupted
    expect(jsx).toContain('"has class= here"');
  });

  it("does not corrupt stroke-width= inside an attribute string value", () => {
    const input = '<svg><path data-info="stroke-width=2" stroke-width="4"/></svg>';
    const jsx = toJsxComponent(input);
    // The attribute stroke-width= must be camelCased
    expect(jsx).toContain("strokeWidth=");
    // The data-info string content stroke-width=2 must be preserved
    expect(jsx).toContain("stroke-width=2");
  });
});
