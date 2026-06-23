import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LANG_STORAGE_KEY,
  buildBatchFilename,
  buildCombinedText,
  buildFilename,
  confidenceLabel,
  extractLowConfidenceWords,
  loadPersistedLanguage,
  normaliseText,
  persistLanguage,
} from "./ocrUtils";

describe("normaliseText", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normaliseText("  hello  ")).toBe("hello");
  });

  it("strips trailing spaces per line", () => {
    expect(normaliseText("foo   \nbar   ")).toBe("foo\nbar");
  });

  it("normalises CRLF to LF", () => {
    expect(normaliseText("line1\r\nline2")).toBe("line1\nline2");
  });

  it("normalises lone CR to LF", () => {
    expect(normaliseText("line1\rline2")).toBe("line1\nline2");
  });

  it("handles empty string", () => {
    expect(normaliseText("")).toBe("");
  });

  it("handles string with only whitespace", () => {
    expect(normaliseText("   \n   \n   ")).toBe("");
  });
});

describe("buildFilename", () => {
  it("strips extension and appends .txt", () => {
    expect(buildFilename("photo.png")).toBe("photo.txt");
  });

  it("replaces non-alphanumeric chars with underscore", () => {
    expect(buildFilename("my image (1).jpg")).toBe("my_image__1_.txt");
  });

  it("falls back to ocr-result for empty base", () => {
    expect(buildFilename(".png")).toBe("ocr-result.txt");
  });

  it("handles filename without extension", () => {
    expect(buildFilename("screenshot")).toBe("screenshot.txt");
  });
});

describe("loadPersistedLanguage / persistLanguage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns 'eng' when nothing is stored", () => {
    expect(loadPersistedLanguage()).toBe("eng");
  });

  it("returns the value written by persistLanguage", () => {
    persistLanguage("fra");
    expect(loadPersistedLanguage()).toBe("fra");
  });

  it("uses LANG_STORAGE_KEY as the localStorage key", () => {
    persistLanguage("deu");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("deu");
  });

  it("overwrites a previously persisted value", () => {
    persistLanguage("fra");
    persistLanguage("jpn");
    expect(loadPersistedLanguage()).toBe("jpn");
  });
});

describe("confidenceLabel", () => {
  it("returns High for score >= 85", () => {
    expect(confidenceLabel(85)).toBe("High");
    expect(confidenceLabel(100)).toBe("High");
    expect(confidenceLabel(92)).toBe("High");
  });

  it("returns Medium for score 60–84", () => {
    expect(confidenceLabel(60)).toBe("Medium");
    expect(confidenceLabel(75)).toBe("Medium");
    expect(confidenceLabel(84)).toBe("Medium");
  });

  it("returns Low for score < 60", () => {
    expect(confidenceLabel(0)).toBe("Low");
    expect(confidenceLabel(59)).toBe("Low");
    expect(confidenceLabel(30)).toBe("Low");
  });
});

describe("extractLowConfidenceWords", () => {
  it("returns empty array for undefined input", () => {
    expect(extractLowConfidenceWords(undefined)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(extractLowConfidenceWords([])).toEqual([]);
  });

  it("filters words below threshold (default 60)", () => {
    const words = [
      { text: "Hello", confidence: 90 },
      { text: "blurry", confidence: 42 },
      { text: "world", confidence: 60 },
    ];
    const result = extractLowConfidenceWords(words);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("blurry");
    expect(result[0].confidence).toBe(42);
  });

  it("excludes whitespace-only words", () => {
    const words = [{ text: "  ", confidence: 10 }];
    expect(extractLowConfidenceWords(words)).toEqual([]);
  });

  it("respects a custom threshold", () => {
    const words = [
      { text: "ok", confidence: 70 },
      { text: "bad", confidence: 50 },
    ];
    const result = extractLowConfidenceWords(words, 80);
    expect(result).toHaveLength(2);
  });
});

describe("buildBatchFilename", () => {
  it("appends _page1 for index 0", () => {
    expect(buildBatchFilename("photo.png", 0)).toBe("photo_page1.txt");
  });

  it("appends _page3 for index 2", () => {
    expect(buildBatchFilename("scan.jpg", 2)).toBe("scan_page3.txt");
  });

  it("sanitises filename", () => {
    expect(buildBatchFilename("my file (1).png", 0)).toBe("my_file__1__page1.txt");
  });
});

describe("buildCombinedText", () => {
  it("separates items with headers and blank lines", () => {
    const items = [
      { name: "page1.txt", text: "Hello" },
      { name: "page2.txt", text: "World" },
    ];
    const out = buildCombinedText(items);
    expect(out).toContain("=== page1.txt ===");
    expect(out).toContain("Hello");
    expect(out).toContain("=== page2.txt ===");
    expect(out).toContain("World");
  });

  it("returns single section for one item", () => {
    const out = buildCombinedText([{ name: "only.txt", text: "just this" }]);
    expect(out).toBe("=== only.txt ===\n\njust this");
  });

  it("handles empty text gracefully", () => {
    const out = buildCombinedText([{ name: "empty.txt", text: "" }]);
    expect(out).toContain("=== empty.txt ===");
  });
});
