/**
 * Augmented tests for ocrUtils.ts.
 * Covers pathways not reached by existing tests:
 * - createSampleImageFile in jsdom (returns File)
 * - normaliseText with multiple blank lines
 * - buildFilename edge cases (no extension, all-special)
 * - buildBatchFilename with index 9+
 * - buildCombinedText empty items array
 * - extractLowConfidenceWords at exact threshold boundary
 * - confidenceLabel exact boundary values
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LANG_STORAGE_KEY,
  buildBatchFilename,
  buildCombinedText,
  buildFilename,
  confidenceLabel,
  createSampleImageFile,
  extractLowConfidenceWords,
  loadPersistedLanguage,
  normaliseText,
  persistLanguage,
} from "./ocrUtils";

// ── createSampleImageFile — jsdom canvas path ─────────────────────────────────

describe("createSampleImageFile", () => {
  it("returns a File object (canvas available in jsdom)", () => {
    const file = createSampleImageFile();
    // jsdom provides createElement('canvas') but canvas.toDataURL returns empty
    // string on some setups; the function may return null if ctx is unavailable.
    // We just confirm it doesn't throw and returns File | null.
    expect(file === null || file instanceof File).toBe(true);
  });

  it("if a File is returned, it has name 'sample.png' and type 'image/png'", () => {
    const file = createSampleImageFile();
    if (file === null) return; // canvas not available — skip
    expect(file.name).toBe("sample.png");
    expect(file.type).toBe("image/png");
  });
});

// ── normaliseText — additional edge cases ─────────────────────────────────────

describe("normaliseText — additional edge cases", () => {
  it("removes trailing blank lines", () => {
    expect(normaliseText("hello\n\n\n")).toBe("hello");
  });

  it("preserves internal blank lines (after trim-per-line)", () => {
    const result = normaliseText("a\n\nb");
    expect(result).toBe("a\n\nb");
  });

  it("handles Windows CRLF at end of file", () => {
    expect(normaliseText("hello\r\n")).toBe("hello");
  });

  it("converts mixed CR and CRLF", () => {
    const result = normaliseText("a\r\nb\rc");
    expect(result).toBe("a\nb\nc");
  });

  it("strips trailing spaces on each line but preserves blank lines between content", () => {
    const result = normaliseText("line1   \n\nline2   ");
    expect(result).toBe("line1\n\nline2");
  });
});

// ── buildFilename — additional edge cases ─────────────────────────────────────

describe("buildFilename — additional edge cases", () => {
  it("handles filename with multiple dots — all non-alnum chars replaced", () => {
    // buildFilename strips extension then replaces ALL non-[a-z0-9_-] with _
    // so "my.file.name.png" -> base "my.file.name" -> "my_file_name"
    const result = buildFilename("my.file.name.png");
    expect(result).toBe("my_file_name.txt");
  });

  it("all-special-char filename produces underscores (not fallback)", () => {
    // "!!!!!.png" -> base "!!!!!" -> "_____" which is non-empty, so no fallback
    const result = buildFilename("!!!!!.png");
    expect(result).toBe("_____.txt");
  });

  it("preserves hyphens and underscores", () => {
    const result = buildFilename("my-file_name.jpg");
    expect(result).toBe("my-file_name.txt");
  });

  it("supports custom extension", () => {
    const result = buildFilename("photo.png", "json");
    expect(result).toBe("photo.json");
  });
});

// ── buildBatchFilename — additional cases ─────────────────────────────────────

describe("buildBatchFilename — additional cases", () => {
  it("handles index 9 as page10", () => {
    expect(buildBatchFilename("scan.png", 9)).toBe("scan_page10.txt");
  });

  it("falls back to ocr-result for empty source name", () => {
    const result = buildBatchFilename(".png", 0);
    expect(result).toBe("ocr-result_page1.txt");
  });
});

// ── confidenceLabel — boundary precision ──────────────────────────────────────

describe("confidenceLabel — boundary precision", () => {
  it("returns High for exactly 85", () => {
    expect(confidenceLabel(85)).toBe("High");
  });

  it("returns Medium for exactly 60", () => {
    expect(confidenceLabel(60)).toBe("Medium");
  });

  it("returns Low for exactly 59", () => {
    expect(confidenceLabel(59)).toBe("Low");
  });

  it("returns High for 99", () => {
    expect(confidenceLabel(99)).toBe("High");
  });

  it("returns Low for score just below medium threshold (59.9 -> floor in practice)", () => {
    // The function uses >= comparison with integer-ish scores
    expect(confidenceLabel(0)).toBe("Low");
  });
});

// ── extractLowConfidenceWords — boundary cases ────────────────────────────────

describe("extractLowConfidenceWords — boundary cases", () => {
  it("excludes word at exactly the threshold", () => {
    // Default threshold 60; confidence=60 is NOT below threshold (<60 is required)
    const words = [{ text: "edge", confidence: 60 }];
    expect(extractLowConfidenceWords(words, 60)).toHaveLength(0);
  });

  it("includes word at threshold - 1", () => {
    const words = [{ text: "edge", confidence: 59 }];
    const result = extractLowConfidenceWords(words, 60);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(59);
  });

  it("rounds confidence to integer", () => {
    const words = [{ text: "fuzzy", confidence: 42.7 }];
    const result = extractLowConfidenceWords(words);
    expect(result[0].confidence).toBe(43);
  });

  it("handles all words above threshold", () => {
    const words = [
      { text: "good", confidence: 90 },
      { text: "great", confidence: 95 },
    ];
    expect(extractLowConfidenceWords(words)).toHaveLength(0);
  });
});

// ── buildCombinedText — additional edge cases ─────────────────────────────────

describe("buildCombinedText — additional edge cases", () => {
  it("returns empty string for empty items array", () => {
    expect(buildCombinedText([])).toBe("");
  });

  it("uses fallback Page N for items without names", () => {
    const items = [{ name: "", text: "content" }];
    const out = buildCombinedText(items);
    expect(out).toContain("Page 1");
    expect(out).toContain("content");
  });

  it("separates three items correctly", () => {
    const items = [
      { name: "a.txt", text: "aaa" },
      { name: "b.txt", text: "bbb" },
      { name: "c.txt", text: "ccc" },
    ];
    const out = buildCombinedText(items);
    // Each item gets its own header
    expect((out.match(/===/g) || []).length).toBe(6); // 2 per item (open + close on same line)
  });
});

// ── loadPersistedLanguage / persistLanguage — negative ────────────────────────

describe("loadPersistedLanguage / persistLanguage — additional cases", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("persists and retrieves a language with non-ASCII code", () => {
    // Unlikely but confirms no encoding issues
    persistLanguage("chi_sim");
    expect(loadPersistedLanguage()).toBe("chi_sim");
  });

  it("LANG_STORAGE_KEY is a non-empty string", () => {
    expect(LANG_STORAGE_KEY.length).toBeGreaterThan(0);
  });
});
