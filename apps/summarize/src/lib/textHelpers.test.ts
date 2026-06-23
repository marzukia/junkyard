import { describe, expect, it } from "vitest";
import {
  MODEL_MAX_WORDS,
  SAMPLE_TEXT,
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

describe("countWords", () => {
  it("counts words in a normal sentence", () => {
    expect(countWords("The quick brown fox")).toBe(4);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only string", () => {
    expect(countWords("   ")).toBe(0);
  });

  it("handles multiple spaces between words", () => {
    expect(countWords("hello   world")).toBe(2);
  });

  it("handles leading and trailing spaces", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  it("counts single word", () => {
    expect(countWords("word")).toBe(1);
  });
});

describe("formatWordCount", () => {
  it("formats one word as singular", () => {
    expect(formatWordCount(1)).toBe("1 word");
  });

  it("formats zero words", () => {
    expect(formatWordCount(0)).toBe("0 words");
  });

  it("formats large numbers with locale separators", () => {
    expect(formatWordCount(1234)).toBe("1,234 words");
  });

  it("formats 100 words", () => {
    expect(formatWordCount(100)).toBe("100 words");
  });
});

describe("formatReduction", () => {
  it("returns 75% for 400 -> 100 words", () => {
    expect(formatReduction(400, 100)).toBe("75% shorter");
  });

  it("returns empty string when no reduction", () => {
    expect(formatReduction(100, 100)).toBe("");
  });

  it("returns empty string when output is longer", () => {
    expect(formatReduction(50, 100)).toBe("");
  });

  it("returns empty string for zero input", () => {
    expect(formatReduction(0, 0)).toBe("");
  });

  it("rounds percentage", () => {
    // 1/3 reduction = 33%
    expect(formatReduction(3, 2)).toBe("33% shorter");
  });
});

describe("formatProgress", () => {
  it("returns 0% for zero total", () => {
    expect(formatProgress(0, 0)).toBe("0%");
  });

  it("returns correct percentage", () => {
    expect(formatProgress(50, 100)).toBe("50%");
  });

  it("caps at 100%", () => {
    expect(formatProgress(200, 100)).toBe("100%");
  });

  it("rounds to integer", () => {
    expect(formatProgress(1, 3)).toBe("33%");
  });
});

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("passes through value within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe("sliderToMaxWords", () => {
  it("returns short value at 0", () => {
    expect(sliderToMaxWords(0)).toBe(30);
  });

  it("returns medium value at 50", () => {
    expect(sliderToMaxWords(50)).toBe(100);
  });

  it("returns max value at 100", () => {
    expect(sliderToMaxWords(100)).toBe(300);
  });

  it("returns values in increasing order", () => {
    const v0 = sliderToMaxWords(0);
    const v25 = sliderToMaxWords(25);
    const v50 = sliderToMaxWords(50);
    const v75 = sliderToMaxWords(75);
    const v100 = sliderToMaxWords(100);
    expect(v0).toBeLessThan(v25);
    expect(v25).toBeLessThan(v50);
    expect(v50).toBeLessThan(v75);
    expect(v75).toBeLessThan(v100);
  });
});

describe("maxWordsToMin", () => {
  it("is at least 10", () => {
    expect(maxWordsToMin(10)).toBeGreaterThanOrEqual(10);
  });

  it("is 40% of max for reasonable values", () => {
    expect(maxWordsToMin(100)).toBe(40);
  });

  it("floors at 10 for small max", () => {
    expect(maxWordsToMin(20)).toBe(10);
  });
});

describe("SAMPLE_TEXT", () => {
  it("has at least 30 words (meets summarize minimum)", () => {
    expect(countWords(SAMPLE_TEXT)).toBeGreaterThanOrEqual(30);
  });

  it("is a non-empty string", () => {
    expect(typeof SAMPLE_TEXT).toBe("string");
    expect(SAMPLE_TEXT.length).toBeGreaterThan(0);
  });
});

describe("lengthLabel", () => {
  it("returns Brief for <= 50 words", () => {
    expect(lengthLabel(50)).toBe("Brief");
  });

  it("returns Medium for <= 100 words", () => {
    expect(lengthLabel(100)).toBe("Medium");
  });

  it("returns Detailed for <= 200 words", () => {
    expect(lengthLabel(200)).toBe("Detailed");
  });

  it("returns Full for > 200 words", () => {
    expect(lengthLabel(201)).toBe("Full");
  });
});

describe("MODEL_MAX_WORDS", () => {
  it("is a positive integer", () => {
    expect(MODEL_MAX_WORDS).toBeGreaterThan(0);
    expect(Number.isInteger(MODEL_MAX_WORDS)).toBe(true);
  });

  it("is roughly 768 (1024 * 0.75)", () => {
    expect(MODEL_MAX_WORDS).toBe(768);
  });
});

describe("needsChunking", () => {
  it("returns false for short text", () => {
    expect(needsChunking("hello world")).toBe(false);
  });

  it("returns false for text at the limit", () => {
    const text = Array(MODEL_MAX_WORDS).fill("word").join(" ");
    expect(needsChunking(text)).toBe(false);
  });

  it("returns true for text exceeding the limit", () => {
    const text = Array(MODEL_MAX_WORDS + 1)
      .fill("word")
      .join(" ");
    expect(needsChunking(text)).toBe(true);
  });
});

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const chunks = chunkText("Hello world this is a short text.", 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Hello");
  });

  it("splits long text into multiple chunks", () => {
    // 200 words split with limit 50
    const text = Array(200).fill("word").join(" ");
    const chunks = chunkText(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk does not exceed maxWordsPerChunk", () => {
    const text = Array(300).fill("word").join(" ");
    const chunks = chunkText(text, 100);
    for (const chunk of chunks) {
      expect(countWords(chunk)).toBeLessThanOrEqual(100);
    }
  });

  it("all words are preserved across chunks", () => {
    const words = Array(200)
      .fill(null)
      .map((_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text, 50);
    const rejoined = chunks.join(" ");
    for (const w of words) {
      expect(rejoined).toContain(w);
    }
  });

  it("returns no empty chunks", () => {
    const text = Array(150).fill("foo").join(" ");
    const chunks = chunkText(text, 40);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it("prefers sentence boundaries", () => {
    // Build 120-word text with a sentence ending at word 80
    const first = `${Array(80).fill("word").join(" ")}. `;
    const second = Array(40).fill("tail").join(" ");
    const text = `${first}${second}`;
    const chunks = chunkText(text, 100);
    // The first chunk should end at the sentence boundary (at or before word 100)
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toMatch(/\./);
  });
});

describe("extractTextFromHtml", () => {
  it("strips HTML tags", () => {
    const result = extractTextFromHtml("<p>Hello <b>world</b></p>");
    expect(result).toContain("Hello");
    expect(result).toContain("world");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<b>");
  });

  it("removes script content", () => {
    const result = extractTextFromHtml("<script>var x = 1;</script><p>visible</p>");
    expect(result).not.toContain("var x");
    expect(result).toContain("visible");
  });

  it("removes style content", () => {
    const result = extractTextFromHtml("<style>body { color: red }</style><p>text</p>");
    expect(result).not.toContain("color: red");
    expect(result).toContain("text");
  });

  it("decodes common HTML entities", () => {
    const result = extractTextFromHtml("&amp; &lt; &gt; &quot; &#39; &nbsp;");
    expect(result).toContain("&");
    expect(result).toContain("<");
    expect(result).toContain(">");
  });

  it("collapses multiple spaces", () => {
    const result = extractTextFromHtml("<p>a</p>   <p>b</p>");
    expect(result).not.toMatch(/\s{2,}/);
  });
});


describe("chunkText empty/whitespace input", () => {
  it("returns [] for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns [] for whitespace-only string", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns [] for tab-and-newline whitespace", () => {
    expect(chunkText("\t\n  \n")).toEqual([]);
  });
});
