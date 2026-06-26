import { describe, expect, it } from "vitest";
import { splitIntoChunks } from "./languages";
import { detectLanguage } from "./translator";

describe("detectLanguage", () => {
  it("detects English (default fallback)", () => {
    expect(detectLanguage("Hello, how are you today?")).toBe("eng_Latn");
  });

  it("detects Japanese via Hiragana/Katakana", () => {
    expect(detectLanguage("こんにちは、元気ですか？")).toBe("jpn_Jpan");
  });

  it("detects Korean via Hangul", () => {
    expect(detectLanguage("안녕하세요")).toBe("kor_Hang");
  });

  it("detects Arabic script", () => {
    expect(detectLanguage("مرحبا كيف حالك")).toBe("arb_Arab");
  });

  it("detects Cyrillic as Russian", () => {
    expect(detectLanguage("Привет, как дела?")).toBe("rus_Cyrl");
  });

  it("detects Devanagari as Hindi", () => {
    expect(detectLanguage("नमस्ते, आप कैसे हैं?")).toBe("hin_Deva");
  });

  it("detects Thai script", () => {
    expect(detectLanguage("สวัสดีครับ")).toBe("tha_Thai");
  });

  it("detects Chinese (Simplified) via CJK ideographs", () => {
    expect(detectLanguage("你好，你今天怎么样？")).toBe("zho_Hans");
  });

  it("detects German via umlaut diacritics", () => {
    // Text with umlauts is detected as German
    const result = detectLanguage("Schöne Grüße aus München");
    expect(result).toBe("deu_Latn");
  });

  it("detects French via cedilla/accent diacritics", () => {
    // "ça" contains cedilla (ç), "été" contains accented e
    expect(detectLanguage("Bonjour, comment ça va? C'est été.")).toBe("fra_Latn");
  });

  it("returns a non-empty string for empty input", () => {
    expect(detectLanguage("")).toBe("eng_Latn");
  });
});

describe("splitIntoChunks", () => {
  it("returns the original text as a single chunk when within limit", () => {
    const text = "Hello world.";
    expect(splitIntoChunks(text, 100)).toEqual(["Hello world."]);
  });

  it("splits long text into chunks within the limit", () => {
    const sentence = "This is a test sentence. ";
    const text = sentence.repeat(20); // ~500 chars
    const chunks = splitIntoChunks(text, 100);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("reassembled chunks equal the original text (ignoring chunk-join whitespace)", () => {
    const text =
      "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.";
    const chunks = splitIntoChunks(text, 30);
    // All content from the original should be preserved in chunks
    const combined = chunks.join(" ").replace(/\s+/g, " ").trim();
    const original = text.replace(/\s+/g, " ").trim();
    expect(combined).toBe(original);
  });

  it("returns no empty chunks", () => {
    const text = "A ".repeat(200);
    const chunks = splitIntoChunks(text, 50);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it("handles text without sentence-ending punctuation", () => {
    const text = "word ".repeat(100); // ~500 chars, no periods
    const chunks = splitIntoChunks(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it("hard-splits a single word longer than maxChars", () => {
    const longWord = "a".repeat(200);
    const chunks = splitIntoChunks(longWord, 50);
    expect(chunks.length).toBe(4);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it("handles multi-paragraph text", () => {
    const para = "This is paragraph content with multiple words. ";
    const text = `${para.repeat(5)}\n\n${para.repeat(5)}\n\n${para.repeat(5)}`;
    const chunks = splitIntoChunks(text, 100);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("splitIntoChunks empty/whitespace input", () => {
  it("returns [] for empty string", () => {
    expect(splitIntoChunks("")).toEqual([]);
  });

  it("returns [] for whitespace-only string", () => {
    expect(splitIntoChunks("   ")).toEqual([]);
  });

  it("returns [] for newline-only string", () => {
    expect(splitIntoChunks("\n\n")).toEqual([]);
  });
});
