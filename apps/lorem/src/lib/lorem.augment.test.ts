/**
 * Augmented tests for lorem.ts.
 * Covers pathways not fully exercised by the existing tests:
 * - generateParagraph directly
 * - generateListItem directly
 * - makeRng with zero seed (should be treated as 1)
 * - placeholderImgTag with PNG fallback to SVG when no pngDataUrl provided
 * - isValidHexColor with uppercase
 * - withClassicStart empty output passthrough
 */
import { describe, expect, it } from "vitest";
import {
  generateList,
  generateListItem,
  generateParagraph,
  generateWords,
  isValidHexColor,
  makeRng,
  placeholderImgTag,
  placeholderSvgDataUri,
  renderPlaceholderSvg,
  toLoremHtml,
  withClassicStart,
} from "./lorem";

// ── makeRng — zero seed edge case ────────────────────────────────────────────

describe("makeRng — zero seed edge case", () => {
  it("handles seed=0 without getting stuck (treats as seed=1)", () => {
    const rng = makeRng(0);
    // Should produce non-zero values and not hang
    const values = Array.from({ length: 10 }, () => rng());
    // All values should be in [0, 1)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("seed=0 produces deterministic sequence", () => {
    const r1 = makeRng(0);
    const r2 = makeRng(0);
    for (let i = 0; i < 5; i++) {
      expect(r1()).toBe(r2());
    }
  });
});

// ── generateParagraph — direct tests ─────────────────────────────────────────

describe("generateParagraph — direct tests", () => {
  it("produces non-empty output", () => {
    const rng = makeRng(42);
    const para = generateParagraph(rng);
    expect(para.length).toBeGreaterThan(0);
  });

  it("produces a string ending with a period", () => {
    const rng = makeRng(7);
    const para = generateParagraph(rng);
    expect(para.trimEnd().endsWith(".")).toBe(true);
  });

  it("uses the word list provided", () => {
    const rng = makeRng(42);
    // Pass a single-word list so we can verify it's used
    const para = generateParagraph(rng, ["unique42word"]);
    expect(para).toContain("unique42word");
  });

  it("produces different output with different rng state", () => {
    const p1 = generateParagraph(makeRng(1));
    const p2 = generateParagraph(makeRng(999));
    // Very unlikely to be equal
    expect(p1).not.toBe(p2);
  });
});

// ── generateListItem — direct tests ──────────────────────────────────────────

describe("generateListItem — direct tests", () => {
  it("produces non-empty output", () => {
    const rng = makeRng(42);
    const item = generateListItem(rng);
    expect(item.length).toBeGreaterThan(0);
  });

  it("starts with a capital letter", () => {
    const rng = makeRng(42);
    const item = generateListItem(rng);
    expect(item[0]).toBe(item[0].toUpperCase());
  });

  it("does not end with a period (list items are plain phrases)", () => {
    const rng = makeRng(42);
    const item = generateListItem(rng);
    expect(item.endsWith(".")).toBe(false);
  });

  it("contains at least ITEM_MIN_WORDS (3) words", () => {
    const rng = makeRng(42);
    const item = generateListItem(rng);
    expect(item.split(" ").length).toBeGreaterThanOrEqual(3);
  });
});

// ── isValidHexColor — additional cases ───────────────────────────────────────

describe("isValidHexColor — additional cases", () => {
  it("accepts uppercase 6-digit hex", () => {
    expect(isValidHexColor("#FFFFFF")).toBe(true);
  });

  it("accepts mixed-case 6-digit hex", () => {
    expect(isValidHexColor("#2F9D8D")).toBe(true);
  });

  it("rejects hex with alpha component (8 digits)", () => {
    expect(isValidHexColor("#ffffffff")).toBe(false);
  });

  it("rejects just a hash", () => {
    expect(isValidHexColor("#")).toBe(false);
  });

  it("rejects null-like empty values handled as string", () => {
    expect(isValidHexColor("#00000")).toBe(false); // 5 digits
  });
});

// ── renderPlaceholderSvg — negative/edge cases ────────────────────────────────

describe("renderPlaceholderSvg — additional cases", () => {
  it("uses WxH default label for whitespace-only label", () => {
    const svg = renderPlaceholderSvg({
      width: 320,
      height: 240,
      bgColor: "#ffffff",
      textColor: "#000000",
      label: "   ",
    });
    // Label is trimmed; if blank, falls back to WxH
    expect(svg).toContain("320x240");
  });

  it("escapes single quotes in label", () => {
    const svg = renderPlaceholderSvg({
      width: 100,
      height: 100,
      bgColor: "#ffffff",
      textColor: "#000000",
      label: "it's a label",
    });
    // Single quote must be escaped as &#39;
    expect(svg).toContain("&#39;");
    expect(svg).not.toContain("it's");
  });

  it("minimum font size is at least 10 for very small dimensions", () => {
    const svg = renderPlaceholderSvg({
      width: 10,
      height: 10,
      bgColor: "#ffffff",
      textColor: "#000000",
      label: "tiny",
    });
    // Should not throw and should contain a font-size attribute
    expect(svg).toMatch(/font-size="1[0-9]/);
  });
});

// ── placeholderSvgDataUri — additional cases ─────────────────────────────────

describe("placeholderSvgDataUri — additional cases", () => {
  it("encodes label characters in the URI", () => {
    const uri = placeholderSvgDataUri({
      width: 100,
      height: 100,
      bgColor: "#ffffff",
      textColor: "#000000",
      label: "Hello & World",
    });
    // URI must be properly encoded (& -> %26 etc.)
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    // After decoding, the label content should be present
    const decoded = decodeURIComponent(uri.replace("data:image/svg+xml;charset=utf-8,", ""));
    expect(decoded).toContain("amp;");
  });
});

// ── placeholderImgTag — additional cases ─────────────────────────────────────

describe("placeholderImgTag — additional cases", () => {
  const cfg = { width: 400, height: 300, bgColor: "#cccccc", textColor: "#333333", label: "" };

  it("falls back to SVG when format is png but no pngDataUrl is given", () => {
    const tag = placeholderImgTag(cfg, "png", undefined);
    // Should use SVG data URI as fallback
    expect(tag).toContain("data:image/svg+xml");
  });

  it("includes closing > character (well-formed tag)", () => {
    const tag = placeholderImgTag(cfg, "svg");
    expect(tag.endsWith(">")).toBe(true);
  });
});

// ── toLoremHtml — additional negative cases ───────────────────────────────────

describe("toLoremHtml — additional cases", () => {
  it("handles list with mixed ordered/unordered prefix stripping", () => {
    // The function strips "- " or "N. " prefixes from list items
    const input = "1. First item\n2. Second item";
    const result = toLoremHtml(input, "list", "ordered");
    expect(result).toContain("<li>First item</li>");
    expect(result).toContain("<li>Second item</li>");
  });

  it("wraps single paragraph correctly", () => {
    const result = toLoremHtml("Only one paragraph.", "paragraphs", "unordered");
    expect(result).toBe("<p>Only one paragraph.</p>");
  });

  it("ignores listStyle for paragraphs mode", () => {
    const result = toLoremHtml("Single para.", "paragraphs", "ordered");
    expect(result).toBe("<p>Single para.</p>");
    expect(result).not.toContain("<ol>");
  });
});

// ── withClassicStart — additional edge cases ──────────────────────────────────

describe("withClassicStart — additional edge cases", () => {
  it("returns empty output unchanged for paragraphs mode", () => {
    expect(withClassicStart("", "paragraphs")).toBe("");
  });

  it("returns empty output unchanged for sentences mode", () => {
    expect(withClassicStart("", "sentences")).toBe("");
  });

  it("single-sentence paragraphs mode replaces that sentence with classic start", () => {
    const result = withClassicStart("One sentence.", "paragraphs");
    // The classic start should replace it entirely
    expect(result.startsWith("Lorem ipsum")).toBe(true);
  });
});

// ── generateWords — additional cases ─────────────────────────────────────────

describe("generateWords — additional cases", () => {
  it("returns empty string for count=0", () => {
    const result = generateWords(0, 42);
    expect(result).toBe("");
  });
});

// ── generateList — additional cases ──────────────────────────────────────────

describe("generateList — additional cases", () => {
  it("returns empty array for count=0", () => {
    const result = generateList(0, 42, false);
    expect(result).toEqual([]);
  });

  it("unordered items do not start with a digit", () => {
    const items = generateList(5, 42, false);
    for (const item of items) {
      expect(item[0]).not.toMatch(/\d/);
    }
  });
});
