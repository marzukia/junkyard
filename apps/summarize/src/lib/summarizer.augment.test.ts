/**
 * Augment tests for summarize/textHelpers -- covers the small gaps left by the
 * existing 51-test suite: boundary values, negative inputs, and the pure-logic
 * exports that had no negative-path coverage.
 */
import { describe, expect, it } from "vitest";
import {
  MODEL_MAX_WORDS,
  chunkText,
  clamp,
  countWords,
  extractTextFromHtml,
  formatProgress,
  formatReduction,
  formatWordCount,
  lengthLabel,
  maxWordsToMin,
  needsChunking,
  sliderToMaxWords,
} from "./textHelpers";

// ── countWords edge cases ─────────────────────────────────────────────────────

describe("countWords -- additional negative paths", () => {
  it("counts a newline-separated word list correctly", () => {
    expect(countWords("one\ntwo\nthree")).toBe(3);
  });

  it("counts a tab-separated word list correctly", () => {
    expect(countWords("one\ttwo")).toBe(2);
  });

  it("treats punctuation-attached words as single words", () => {
    // "hello," is still one word token
    expect(countWords("hello, world!")).toBe(2);
  });
});

// ── formatWordCount edge cases ────────────────────────────────────────────────

describe("formatWordCount -- additional paths", () => {
  it("formats 2 as plural", () => {
    expect(formatWordCount(2)).toBe("2 words");
  });

  it("formats very large count", () => {
    expect(formatWordCount(1_000_000)).toContain("1,000,000");
  });
});

// ── formatReduction negative paths ────────────────────────────────────────────

describe("formatReduction -- negative paths", () => {
  it("returns empty string when output equals input", () => {
    expect(formatReduction(50, 50)).toBe("");
  });

  it("returns empty string for negative inputWords", () => {
    expect(formatReduction(-10, 5)).toBe("");
  });

  it("100% reduction (output 0)", () => {
    expect(formatReduction(100, 0)).toBe("100% shorter");
  });
});

// ── formatProgress negative paths ────────────────────────────────────────────

describe("formatProgress -- negative paths", () => {
  it("negative total yields 0%", () => {
    expect(formatProgress(0, -1)).toBe("0%");
  });

  it("zero loaded with positive total yields 0%", () => {
    expect(formatProgress(0, 100)).toBe("0%");
  });
});

// ── clamp ─────────────────────────────────────────────────────────────────────

describe("clamp -- boundary cases", () => {
  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });

  it("returns max when value equals max", () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });

  it("works when min equals max", () => {
    expect(clamp(50, 10, 10)).toBe(10);
  });
});

// ── sliderToMaxWords boundaries ───────────────────────────────────────────────

describe("sliderToMaxWords -- boundary values", () => {
  it("position 25 maps to 50 words", () => {
    expect(sliderToMaxWords(25)).toBe(50);
  });

  it("position 75 maps to 200 words", () => {
    expect(sliderToMaxWords(75)).toBe(200);
  });

  it("position between 26 and 49 stays in 50-100 range", () => {
    const v = sliderToMaxWords(38);
    expect(v).toBeGreaterThanOrEqual(50);
    expect(v).toBeLessThanOrEqual(100);
  });
});

// ── maxWordsToMin negative paths ──────────────────────────────────────────────

describe("maxWordsToMin -- negative paths", () => {
  it("returns 10 for 0", () => {
    expect(maxWordsToMin(0)).toBe(10);
  });

  it("returns 10 for very small values (< 25)", () => {
    expect(maxWordsToMin(1)).toBe(10);
  });

  it("scales linearly above floor", () => {
    // 250 * 0.4 = 100
    expect(maxWordsToMin(250)).toBe(100);
  });
});

// ── lengthLabel boundaries ────────────────────────────────────────────────────

describe("lengthLabel -- boundary values", () => {
  it("returns Brief for exactly 1 word", () => {
    expect(lengthLabel(1)).toBe("Brief");
  });

  it("returns Medium for exactly 51 words", () => {
    expect(lengthLabel(51)).toBe("Medium");
  });

  it("returns Detailed for exactly 101 words", () => {
    expect(lengthLabel(101)).toBe("Detailed");
  });

  it("returns Full for 300 words", () => {
    expect(lengthLabel(300)).toBe("Full");
  });
});

// ── needsChunking ─────────────────────────────────────────────────────────────

describe("needsChunking -- additional cases", () => {
  it("returns false for exactly MODEL_MAX_WORDS words", () => {
    const text = Array(MODEL_MAX_WORDS).fill("x").join(" ");
    expect(needsChunking(text)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(needsChunking("")).toBe(false);
  });
});

// ── chunkText negative / edge cases ──────────────────────────────────────────

describe("chunkText -- edge cases", () => {
  it('returns [] for empty string (fixed: was returning [""])', () => {
    const chunks = chunkText("", 100);
    expect(chunks).toEqual([]);
  });

  it("handles text exactly at the limit without splitting", () => {
    const text = Array(50).fill("word").join(" ");
    const chunks = chunkText(text, 50);
    expect(chunks).toHaveLength(1);
  });

  it("uses default MODEL_MAX_WORDS when no maxWordsPerChunk given", () => {
    // Single-word text always single chunk
    const chunks = chunkText("hello");
    expect(chunks).toHaveLength(1);
  });

  it("splits text with no sentence boundaries by word boundary", () => {
    const text = Array(60).fill("word").join(" ");
    const chunks = chunkText(text, 50);
    // No sentence boundary; should still split correctly
    for (const chunk of chunks) {
      expect(countWords(chunk)).toBeLessThanOrEqual(50);
    }
  });
});

// ── extractTextFromHtml edge cases ────────────────────────────────────────────

describe("extractTextFromHtml -- edge cases", () => {
  it("returns empty string for empty input", () => {
    expect(extractTextFromHtml("")).toBe("");
  });

  it("returns plain text unchanged (no tags)", () => {
    const result = extractTextFromHtml("just plain text");
    expect(result).toBe("just plain text");
  });

  it("strips nested script content", () => {
    const html = "<div><script>alert('x')</script>visible</div>";
    const result = extractTextFromHtml(html);
    expect(result).not.toContain("alert");
    expect(result).toContain("visible");
  });

  it("decodes &#39; to single quote", () => {
    expect(extractTextFromHtml("it&#39;s")).toContain("'");
  });

  it("decodes &quot; to double-quote", () => {
    expect(extractTextFromHtml("say &quot;hello&quot;")).toContain('"');
  });
});
