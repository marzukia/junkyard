import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOURCE,
  DEFAULT_TARGET,
  LANGUAGES,
  MAX_INPUT_CHARS,
  findLanguage,
  validateLanguagePair,
} from "./languages";

describe("LANGUAGES list", () => {
  it("contains more than 50 languages", () => {
    expect(LANGUAGES.length).toBeGreaterThan(50);
  });

  it("is sorted alphabetically by label", () => {
    for (let i = 1; i < LANGUAGES.length; i++) {
      const prev = LANGUAGES[i - 1].label;
      const curr = LANGUAGES[i].label;
      expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
    }
  });

  it("all codes are non-empty strings", () => {
    for (const lang of LANGUAGES) {
      expect(typeof lang.code).toBe("string");
      expect(lang.code.length).toBeGreaterThan(0);
    }
  });

  it("all labels are non-empty strings", () => {
    for (const lang of LANGUAGES) {
      expect(typeof lang.label).toBe("string");
      expect(lang.label.length).toBeGreaterThan(0);
    }
  });

  it("contains English", () => {
    const eng = LANGUAGES.find((l) => l.code === "eng_Latn");
    expect(eng).toBeDefined();
    expect(eng?.label).toBe("English");
  });

  it("contains French", () => {
    const fr = LANGUAGES.find((l) => l.code === "fra_Latn");
    expect(fr).toBeDefined();
  });

  it("contains Chinese (Simplified)", () => {
    const zh = LANGUAGES.find((l) => l.code === "zho_Hans");
    expect(zh).toBeDefined();
  });
});

describe("findLanguage", () => {
  it("finds a known language by code", () => {
    const lang = findLanguage("spa_Latn");
    expect(lang).toBeDefined();
    expect(lang?.label).toBe("Spanish");
  });

  it("returns undefined for unknown code", () => {
    expect(findLanguage("xxx_Xxxx")).toBeUndefined();
  });

  it("finds the default source language", () => {
    expect(findLanguage(DEFAULT_SOURCE)).toBeDefined();
  });

  it("finds the default target language", () => {
    expect(findLanguage(DEFAULT_TARGET)).toBeDefined();
  });
});

describe("validateLanguagePair", () => {
  it("returns null for a valid pair", () => {
    expect(validateLanguagePair("eng_Latn", "fra_Latn")).toBeNull();
  });

  it("errors on unknown source", () => {
    const err = validateLanguagePair("xxx_Xxxx", "fra_Latn");
    expect(err).not.toBeNull();
    expect(err).toContain("source");
  });

  it("errors on unknown target", () => {
    const err = validateLanguagePair("eng_Latn", "xxx_Xxxx");
    expect(err).not.toBeNull();
    expect(err).toContain("target");
  });

  it("errors when source equals target", () => {
    const err = validateLanguagePair("eng_Latn", "eng_Latn");
    expect(err).not.toBeNull();
    expect(err).toContain("different");
  });

  it("validates the default pair without error", () => {
    expect(validateLanguagePair(DEFAULT_SOURCE, DEFAULT_TARGET)).toBeNull();
  });
});

describe("MAX_INPUT_CHARS", () => {
  it("is a positive number", () => {
    expect(MAX_INPUT_CHARS).toBeGreaterThan(0);
  });
});
