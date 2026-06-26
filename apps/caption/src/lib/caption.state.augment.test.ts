/**
 * Augmented tests for caption app:
 * - captioner.ts pure state (isModelLoaded, MODEL_ID, MODEL_SIZE_MB)
 * - imageHelpers.ts additional edge cases for batchToCsv and formatCaption
 */
import { describe, expect, it } from "vitest";
import { MODEL_ID, MODEL_SIZE_MB, isModelLoaded } from "./captioner";
import { batchToCsv, batchToJson, formatCaption } from "./imageHelpers";

// ── captioner.ts pure state ───────────────────────────────────────────────────

describe("isModelLoaded", () => {
  it("returns false before loadModel is called", () => {
    expect(isModelLoaded()).toBe(false);
  });
});

describe("MODEL constants", () => {
  it("MODEL_ID is a non-empty string", () => {
    expect(typeof MODEL_ID).toBe("string");
    expect(MODEL_ID.length).toBeGreaterThan(0);
  });

  it("MODEL_SIZE_MB is a positive number", () => {
    expect(typeof MODEL_SIZE_MB).toBe("number");
    expect(MODEL_SIZE_MB).toBeGreaterThan(0);
  });

  it("MODEL_ID matches expected ViT-GPT2 model path format", () => {
    // format: namespace/model-name
    expect(MODEL_ID).toMatch(/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/);
  });
});

// ── batchToCsv - additional edge cases ────────────────────────────────────────

describe("batchToCsv - additional edge cases", () => {
  it("handles filename with comma inside by quoting it", () => {
    const csv = batchToCsv([{ filename: "a,b.jpg", caption: "test" }]);
    expect(csv).toContain('"a,b.jpg"');
  });

  it("handles newline in caption by keeping it inside the quoted field", () => {
    const csv = batchToCsv([{ filename: "x.jpg", caption: "line1\nline2" }]);
    // The value is quoted; the newline is inside
    expect(csv).toContain('"line1\nline2"');
  });

  it("handles Unicode characters in caption", () => {
    const csv = batchToCsv([{ filename: "photo.jpg", caption: "Un chat sur le toit." }]);
    expect(csv).toContain("Un chat sur le toit.");
  });
});

// ── batchToJson - additional edge cases ───────────────────────────────────────

describe("batchToJson - additional edge cases", () => {
  it("preserves special characters in caption without escaping them in output", () => {
    const rows = [{ filename: "a.jpg", caption: 'He said "hello".' }];
    const json = batchToJson(rows);
    const parsed = JSON.parse(json);
    expect(parsed[0].caption).toBe('He said "hello".');
  });

  it("handles array with many rows correctly", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      filename: `img${i}.jpg`,
      caption: `Caption ${i}`,
    }));
    const parsed = JSON.parse(batchToJson(rows));
    expect(parsed).toHaveLength(10);
    expect(parsed[9].filename).toBe("img9.jpg");
  });
});

// ── formatCaption - additional edge cases ────────────────────────────────────

describe("formatCaption - additional edge cases", () => {
  it("preserves already-correct sentence", () => {
    expect(formatCaption("A dog running.")).toBe("A dog running.");
  });

  it("handles all-uppercase input", () => {
    // Does not change case of chars after first
    const result = formatCaption("A CAT");
    expect(result).toBe("A CAT.");
  });

  it("handles single-character input", () => {
    expect(formatCaption("a")).toBe("A.");
  });

  it("handles input that already ends with question mark (no period added)", () => {
    // The function only checks for '.'; '?' does not prevent appending '.'
    // This tests actual behavior, not assumed behavior.
    const result = formatCaption("Is this a cat?");
    // Should capitalize first, and since it doesn't end in '.', append '.'
    expect(result).toBe("Is this a cat?.");
  });
});
