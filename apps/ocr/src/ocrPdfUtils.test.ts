/**
 * Unit tests for ocrPdfUtils.ts.
 *
 * Covers the pure, synchronous exports: scaleBboxToPdfCoords and detectFontVariant.
 * The async build* functions require browser APIs (fetch, Image, PDFDocument) and
 * are exercised end-to-end in the app rather than here.
 */
import { describe, expect, it } from "vitest";
import { detectFontVariant, scaleBboxToPdfCoords } from "./ocrPdfUtils";

// ── scaleBboxToPdfCoords ───────────────────────────────────────────────────────

describe("scaleBboxToPdfCoords", () => {
  it("maps top-left image origin to bottom-left PDF origin (y-flip)", () => {
    // Image 100x100, page 100x100, word at rows 10-20 -> PDF y = 100 - 20 = 80
    const coords = scaleBboxToPdfCoords(
      { x0: 0, y0: 10, x1: 50, y1: 20 },
      { width: 100, height: 100 },
      { width: 100, height: 100 }
    );
    expect(coords.y).toBe(80);
  });

  it("scales coordinates proportionally when page differs from image", () => {
    // Image 200x200, page 100x100 (50% scale)
    const coords = scaleBboxToPdfCoords(
      { x0: 40, y0: 60, x1: 80, y1: 100 },
      { width: 200, height: 200 },
      { width: 100, height: 100 }
    );
    expect(coords.x).toBe(20);
    expect(coords.w).toBe(20);
    expect(coords.h).toBe(20);
    // y = 100 - (100 * 0.5) = 50
    expect(coords.y).toBe(50);
  });

  it("returns zero dimensions for zero-area bbox", () => {
    const coords = scaleBboxToPdfCoords(
      { x0: 10, y0: 10, x1: 10, y1: 10 },
      { width: 100, height: 100 },
      { width: 100, height: 100 }
    );
    expect(coords.w).toBe(0);
    expect(coords.h).toBe(0);
  });
});

// ── detectFontVariant ─────────────────────────────────────────────────────────

describe("detectFontVariant", () => {
  it("returns 'noto' for empty text array", () => {
    expect(detectFontVariant([])).toBe("noto");
  });

  it("returns 'noto' for ASCII-only text", () => {
    expect(detectFontVariant(["Hello world", "foo bar"])).toBe("noto");
  });

  it("returns 'noto' for Latin-extended text (accented chars)", () => {
    expect(detectFontVariant(["Aabenraa", "Copenhague"])).toBe("noto");
  });

  it("returns 'cjk' when a CJK ideograph is present", () => {
    // U+4E2D = 中
    expect(detectFontVariant(["Hello", "中文"])).toBe("cjk");
  });

  it("returns 'cjk' for Japanese hiragana", () => {
    // U+3042 = あ
    expect(detectFontVariant(["あいうえお"])).toBe("cjk");
  });

  it("returns 'cjk' for Japanese katakana", () => {
    // U+30A2 = ア
    expect(detectFontVariant(["アイウエオ"])).toBe("cjk");
  });

  it("returns 'arabic' for Arabic script text", () => {
    // U+0645 = م
    expect(detectFontVariant(["مرحبا"])).toBe("arabic");
  });

  it("returns 'cjk' (first match) when both CJK and Arabic appear", () => {
    // CJK appears in first string -> short-circuits to cjk
    expect(detectFontVariant(["中文", "مرحبا"])).toBe("cjk");
  });

  it("returns 'arabic' when Arabic appears before any CJK", () => {
    expect(detectFontVariant(["مرحبا", "中文"])).toBe("arabic");
  });

  it("returns 'noto' for Korean Hangul (not in CJK block -- no mis-detection)", () => {
    // Hangul is U+AC00-D7AF; not in our CJK ranges -> 'noto'
    // This is a known limitation: Hangul is not covered by noto-sans-sc.
    // Document: future improvement would add a 'korean' variant.
    expect(detectFontVariant(["안녕하세요"])).toBe("noto");
  });
});
