import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaleBboxToPdfCoords } from "./ocrPdfUtils";
import { useOcrStore } from "./store";
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

describe("scaleBboxToPdfCoords", () => {
  // Image and PDF are the same size -- scaling factor is 1:1.
  // PDF y-origin is bottom-left; image y-origin is top-left.
  // A bbox that ends at y1=20 on a 100px-tall image maps to y=80 from the PDF bottom.

  it("identity when img and page are the same size", () => {
    const bbox = { x0: 10, y0: 5, x1: 50, y1: 20 };
    const img = { width: 200, height: 100 };
    const page = { width: 200, height: 100 };
    const result = scaleBboxToPdfCoords(bbox, img, page);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(80); // 100 - 20
    expect(result.w).toBeCloseTo(40); // 50 - 10
    expect(result.h).toBeCloseTo(15); // 20 - 5
  });

  it("scales x and w proportionally when page is wider than image", () => {
    const bbox = { x0: 0, y0: 0, x1: 100, y1: 50 };
    const img = { width: 100, height: 100 };
    const page = { width: 200, height: 100 }; // 2x wider
    const result = scaleBboxToPdfCoords(bbox, img, page);
    expect(result.x).toBeCloseTo(0);
    expect(result.w).toBeCloseTo(200); // 100 * 2
  });

  it("flips y-axis correctly for a word at the bottom of the image", () => {
    // Word occupies the bottom 10px of a 100px image.
    const bbox = { x0: 0, y0: 90, x1: 50, y1: 100 };
    const img = { width: 100, height: 100 };
    const page = { width: 100, height: 100 };
    const result = scaleBboxToPdfCoords(bbox, img, page);
    // pdf y = pageHeight - bbox.y1*scaleY = 100 - 100 = 0
    expect(result.y).toBeCloseTo(0);
    expect(result.h).toBeCloseTo(10);
  });

  it("flips y-axis correctly for a word at the top of the image", () => {
    // Word occupies the top 10px of a 100px image.
    const bbox = { x0: 0, y0: 0, x1: 50, y1: 10 };
    const img = { width: 100, height: 100 };
    const page = { width: 100, height: 100 };
    const result = scaleBboxToPdfCoords(bbox, img, page);
    // pdf y = 100 - 10 = 90 (near top of PDF page)
    expect(result.y).toBeCloseTo(90);
    expect(result.h).toBeCloseTo(10);
  });

  it("applies uniform scale when page and image differ by 2x", () => {
    const bbox = { x0: 10, y0: 20, x1: 30, y1: 40 };
    const img = { width: 100, height: 100 };
    const page = { width: 200, height: 200 };
    const result = scaleBboxToPdfCoords(bbox, img, page);
    expect(result.x).toBeCloseTo(20); // 10 * 2
    expect(result.w).toBeCloseTo(40); // (30-10) * 2
    expect(result.h).toBeCloseTo(40); // (40-20) * 2
    // y = 200 - (40 * 2) = 200 - 80 = 120
    expect(result.y).toBeCloseTo(120);
  });
});

describe("OcrStore - per-item words caching", () => {
  it("setQueueItemResult stores words on the queue item", () => {
    const store = useOcrStore.getState();
    const file = new File([""], "page1.png", { type: "image/png" });
    store.setImage(file);
    const id = useOcrStore.getState().queue[0].id;

    const words = [
      { text: "Hello", confidence: 95, bbox: { x0: 0, y0: 0, x1: 50, y1: 10 } },
      { text: "World", confidence: 90, bbox: { x0: 60, y0: 0, x1: 110, y1: 10 } },
    ];
    store.setQueueItemResult(id, "Hello World", 92, "", words);

    const item = useOcrStore.getState().queue[0];
    expect(item.words).toHaveLength(2);
    expect(item.words[0].text).toBe("Hello");
    expect(item.words[1].text).toBe("World");
  });

  it("two queue items carry independent word sets", () => {
    const store = useOcrStore.getState();
    store.reset();
    const file1 = new File([""], "page1.png", { type: "image/png" });
    const file2 = new File([""], "page2.png", { type: "image/png" });
    store.setImage(file1);
    store.addFiles([file2]);

    const [id1, id2] = useOcrStore.getState().queue.map((q) => q.id);
    const words1 = [{ text: "Page1Word", confidence: 90, bbox: { x0: 0, y0: 0, x1: 40, y1: 10 } }];
    const words2 = [{ text: "Page2Word", confidence: 88, bbox: { x0: 0, y0: 0, x1: 40, y1: 10 } }];

    store.setQueueItemResult(id1, "Page1Word", 90, "", words1);
    store.setQueueItemResult(id2, "Page2Word", 88, "", words2);

    const queue = useOcrStore.getState().queue;
    expect(queue[0].words[0].text).toBe("Page1Word");
    expect(queue[1].words[0].text).toBe("Page2Word");
    // Confirm they are distinct references -- no cross-contamination
    expect(queue[0].words).not.toBe(queue[1].words);
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
