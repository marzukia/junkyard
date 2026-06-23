/**
 * Augment tests for translate/languages.ts -- covers gaps in the existing suite:
 * splitIntoChunks edge cases (empty string, paragraph handling), validateLanguagePair
 * with DETECT_CODE, constants coverage, findLanguage with iso field.
 */
import { describe, expect, it } from "vitest";
import {
  DETECT_CODE,
  DEFAULT_SOURCE,
  DEFAULT_TARGET,
  HARD_MAX_CHARS,
  LANGUAGES,
  MAX_CHUNK_CHARS,
  MAX_INPUT_CHARS,
  findLanguage,
  splitIntoChunks,
  validateLanguagePair,
} from "./languages";

// ── DETECT_CODE / constants ───────────────────────────────────────────────────

describe("constants", () => {
  it("DETECT_CODE is 'auto'", () => {
    expect(DETECT_CODE).toBe("auto");
  });

  it("MAX_INPUT_CHARS equals MAX_CHUNK_CHARS", () => {
    expect(MAX_INPUT_CHARS).toBe(MAX_CHUNK_CHARS);
  });

  it("HARD_MAX_CHARS is greater than MAX_CHUNK_CHARS", () => {
    expect(HARD_MAX_CHARS).toBeGreaterThan(MAX_CHUNK_CHARS);
  });

  it("DEFAULT_SOURCE is a valid NLLB code in the list", () => {
    expect(findLanguage(DEFAULT_SOURCE)).toBeDefined();
  });

  it("DEFAULT_TARGET is a valid NLLB code in the list", () => {
    expect(findLanguage(DEFAULT_TARGET)).toBeDefined();
  });
});

// ── validateLanguagePair with DETECT_CODE ─────────────────────────────────────

describe("validateLanguagePair -- DETECT_CODE paths", () => {
  it("accepts DETECT_CODE as source with a valid target", () => {
    expect(validateLanguagePair(DETECT_CODE, "fra_Latn")).toBeNull();
  });

  it("errors when DETECT_CODE is the target", () => {
    // DETECT_CODE is not a real language entry -- should fail target lookup
    const err = validateLanguagePair("eng_Latn", DETECT_CODE);
    expect(err).not.toBeNull();
    expect(err).toContain("target");
  });

  it("accepts DETECT_CODE source even when source === target would normally fail", () => {
    // DETECT_CODE != "fra_Latn" so same-language check doesn't apply
    expect(validateLanguagePair(DETECT_CODE, "fra_Latn")).toBeNull();
  });
});

// ── findLanguage -- additional paths ─────────────────────────────────────────

describe("findLanguage -- additional paths", () => {
  it("returns undefined for empty string", () => {
    expect(findLanguage("")).toBeUndefined();
  });

  it("returns undefined for DETECT_CODE ('auto')", () => {
    expect(findLanguage(DETECT_CODE)).toBeUndefined();
  });

  it("is case-sensitive (uppercase code fails)", () => {
    expect(findLanguage("ENG_LATN")).toBeUndefined();
  });

  it("returns language with iso field for English", () => {
    const lang = findLanguage("eng_Latn");
    expect(lang?.iso).toBe("en");
  });

  it("returns language without iso field for lesser-known languages", () => {
    // Acehnese (ace_Arab) has no iso field
    const lang = findLanguage("ace_Arab");
    expect(lang).toBeDefined();
    expect(lang?.iso).toBeUndefined();
  });
});

// ── LANGUAGES -- structural invariants ────────────────────────────────────────

describe("LANGUAGES -- structural invariants", () => {
  it("all codes match NLLB format (xxx_Xxxx)", () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2,3}_[A-Z][a-z]{3,4}$/);
    }
  });

  it("no duplicate codes", () => {
    const codes = LANGUAGES.map((l) => l.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("iso fields that exist are 2-character lowercase strings", () => {
    for (const lang of LANGUAGES) {
      if (lang.iso !== undefined) {
        expect(lang.iso).toMatch(/^[a-z]{2}$/);
      }
    }
  });
});

// ── splitIntoChunks -- additional edge cases ──────────────────────────────────

describe("splitIntoChunks -- additional edge cases", () => {
  it("returns [] for empty string (fixed: was returning [\"\"])", () => {
    const chunks = splitIntoChunks("", 100);
    expect(chunks).toEqual([]);
  });

  it("returns [] for whitespace-only string (fixed: was returning [\"   \"])", () => {
    const chunks = splitIntoChunks("   ", 100);
    expect(chunks).toEqual([]);
  });

  it("text exactly at maxChars is a single chunk", () => {
    const text = "a".repeat(100);
    const chunks = splitIntoChunks(text, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("text well over limit splits into multiple chunks", () => {
    // 300 chars of sentence-like text, maxChars=80, forces multiple chunks
    const sentence = "The quick brown fox jumps over the lazy dog. ";
    const text = sentence.repeat(7); // ~315 chars
    const chunks = splitIntoChunks(text, 80);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(80);
    }
  });

  it("uses default MAX_CHUNK_CHARS when no limit provided", () => {
    // A short string should be a single chunk under the default
    expect(splitIntoChunks("Short text.")).toHaveLength(1);
  });

  it("single very long word splits at maxChars boundary", () => {
    const longWord = "x".repeat(250);
    const chunks = splitIntoChunks(longWord, 100);
    expect(chunks.length).toBe(3); // ceil(250/100) = 3
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  it("paragraph separators are respected", () => {
    const para1 = "First paragraph. Second sentence.";
    const para2 = "Third paragraph. Fourth sentence.";
    const text = `${para1}\n\n${para2}`;
    // Both paragraphs fit in 200 chars, so result is a single chunk
    const chunks = splitIntoChunks(text, 200);
    expect(chunks).toHaveLength(1);
  });

  it("each chunk has non-zero trimmed length", () => {
    const text = "This is a sentence. ".repeat(20);
    const chunks = splitIntoChunks(text, 50);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });
});
