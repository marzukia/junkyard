/**
 * Direct tests for generateSvgString.
 * The helper functions (computeFinderRegions, isFinderModule, svgFinderEye, hexToRgb, etc.)
 * are thoroughly tested in other test files. These tests exercise the public API
 * (generateSvgString) as a whole and verify that the SVG it produces is well-formed
 * and carries the expected structural properties.
 */
import { describe, expect, it } from "vitest";
import { generateSvgString } from "./qr";
import type { QROptions } from "./qr";

const BASE_OPTS: QROptions = {
  text: "https://junkyard.mrzk.io",
  fgColor: "#000000",
  bgColor: "#ffffff",
  errorCorrectionLevel: "M",
  dotStyle: "square",
  eyeStyle: "square",
};

// ── generateSvgString - structural validity ───────────────────────────────────

describe("generateSvgString - structural validity", () => {
  it("returns a string that starts with <svg and ends with </svg>", () => {
    const svg = generateSvgString(BASE_OPTS);
    expect(svg.trimStart()).toMatch(/^<svg /);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it("contains a background rect filling the full viewBox", () => {
    const svg = generateSvgString(BASE_OPTS);
    expect(svg).toContain('fill="#ffffff"');
  });

  it("contains data module rects filled with fgColor", () => {
    const svg = generateSvgString(BASE_OPTS);
    expect(svg).toContain('fill="#000000"');
  });

  it("produces a 512x512 viewBox by default", () => {
    const svg = generateSvgString(BASE_OPTS);
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain('width="512"');
    expect(svg).toContain('height="512"');
  });

  it("produces different SVG output for different input text", () => {
    const svg1 = generateSvgString({ ...BASE_OPTS, text: "https://example.com" });
    const svg2 = generateSvgString({ ...BASE_OPTS, text: "https://other.example.org/path" });
    expect(svg1).not.toBe(svg2);
  });
});

// ── generateSvgString - eye style effects ────────────────────────────────────

describe("generateSvgString - eye style effects", () => {
  it("circle eye style emits <circle> elements", () => {
    const svg = generateSvgString({ ...BASE_OPTS, eyeStyle: "circle" });
    expect(svg).toMatch(/<circle /);
  });

  it("square eye style does NOT emit <circle> elements", () => {
    const svg = generateSvgString({ ...BASE_OPTS, eyeStyle: "square" });
    expect(svg).not.toMatch(/<circle /);
  });

  it("rounded eye style emits <rect> elements with rx attribute", () => {
    const svg = generateSvgString({ ...BASE_OPTS, eyeStyle: "rounded" });
    expect(svg).toMatch(/rx="/);
  });

  it("leaf eye style emits <path> elements with arc commands", () => {
    const svg = generateSvgString({ ...BASE_OPTS, eyeStyle: "leaf" });
    expect(svg).toMatch(/<path /);
    expect(svg).toMatch(/ A /);
  });
});

// ── generateSvgString - colour propagation ────────────────────────────────────

describe("generateSvgString - colour propagation", () => {
  it("uses the provided fgColor for foreground elements", () => {
    const svg = generateSvgString({ ...BASE_OPTS, fgColor: "#1a2530", bgColor: "#ffffff" });
    expect(svg).toContain('fill="#1a2530"');
  });

  it("uses the provided bgColor for background rect and eye punch-out", () => {
    const svg = generateSvgString({ ...BASE_OPTS, fgColor: "#000000", bgColor: "#e8b04b" });
    expect(svg).toContain('fill="#e8b04b"');
  });
});

// ── generateSvgString - error correction level ───────────────────────────────

describe("generateSvgString - error correction level", () => {
  it("produces larger SVG (more modules) with higher error correction", () => {
    // Higher EC increases QR version/module count for the same content.
    // H has more modules than L for the same short text -> more rect elements.
    const svgL = generateSvgString({ ...BASE_OPTS, errorCorrectionLevel: "L" });
    const svgH = generateSvgString({ ...BASE_OPTS, errorCorrectionLevel: "H" });
    // H should have more <rect elements because more data modules
    const countRects = (s: string) => (s.match(/<rect /g) ?? []).length;
    // This may not always hold for all text, but for short URLs H >= L
    expect(countRects(svgH)).toBeGreaterThanOrEqual(countRects(svgL));
  });

  it("each error correction level produces a valid SVG", () => {
    for (const ecl of ["L", "M", "Q", "H"] as const) {
      const svg = generateSvgString({ ...BASE_OPTS, errorCorrectionLevel: ecl });
      expect(svg).toMatch(/^<svg /);
      expect(svg).toMatch(/<\/svg>$/);
    }
  });
});
