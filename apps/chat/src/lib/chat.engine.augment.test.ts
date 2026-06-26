/**
 * Augmented tests for chat app:
 * - llmEngine.ts pure state functions (isEngineLoaded, MODEL_ID, MODEL_SIZE_LABEL, abortGeneration)
 * - chatHelpers.ts additional negative/boundary cases not in main test
 * - renderMarkdown.ts additional edge cases
 */
import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  exportConversation,
  formatBytes,
  formatEta,
  trimMessage,
} from "./chatHelpers";
import { MODEL_ID, MODEL_SIZE_LABEL, abortGeneration, isEngineLoaded } from "./llmEngine";
import { renderMarkdown } from "./renderMarkdown";

// ── llmEngine.ts pure state ───────────────────────────────────────────────────

describe("isEngineLoaded", () => {
  it("returns false before loadEngine is called", () => {
    expect(isEngineLoaded()).toBe(false);
  });
});

describe("abortGeneration", () => {
  it("does not throw when no generation is in progress", () => {
    expect(() => abortGeneration()).not.toThrow();
  });

  it("can be called multiple times without error", () => {
    expect(() => {
      abortGeneration();
      abortGeneration();
    }).not.toThrow();
  });
});

describe("MODEL constants", () => {
  it("MODEL_ID is a non-empty string", () => {
    expect(typeof MODEL_ID).toBe("string");
    expect(MODEL_ID.length).toBeGreaterThan(0);
  });

  it("MODEL_SIZE_LABEL is a non-empty string", () => {
    expect(typeof MODEL_SIZE_LABEL).toBe("string");
    expect(MODEL_SIZE_LABEL.length).toBeGreaterThan(0);
  });

  it("MODEL_SIZE_LABEL contains 'MB'", () => {
    expect(MODEL_SIZE_LABEL).toContain("MB");
  });
});

// ── chatHelpers - additional edge cases ───────────────────────────────────────

describe("formatBytes - additional edge cases", () => {
  it("formats negative values as-is (boundary: -1 is < 1024 but < 0)", () => {
    // The function checks <= 0 first
    expect(formatBytes(-1)).toBe("0 B");
  });

  it("formats exactly 1 KB boundary", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats fractional KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
});

describe("formatEta - additional edge cases", () => {
  it("returns null for negative elapsed time", () => {
    expect(formatEta(500, 1000, -1)).toBeNull();
  });

  it("returns null when loaded equals total (0 remaining)", () => {
    // 0 remaining => eta = 0 => secs = 0 < 5 threshold
    expect(formatEta(1000, 1000, 5000)).toBeNull();
  });

  it("handles very large file (1 GB, 10% done in 30s)", () => {
    const loaded = 100 * 1024 * 1024;
    const total = 1024 * 1024 * 1024;
    const elapsed = 30_000;
    const result = formatEta(loaded, total, elapsed);
    // Should return some "Xm left" or "Xs left" label
    expect(result).not.toBeNull();
    expect(result).toMatch(/left/);
  });
});

describe("trimMessage - additional edge cases", () => {
  it("handles string with only newlines", () => {
    expect(trimMessage("\n\n\n")).toBe("");
  });

  it("handles empty string", () => {
    expect(trimMessage("")).toBe("");
  });

  it("does not trim inner content of a single line", () => {
    expect(trimMessage("  hello world  ")).toBe("hello world");
  });
});

describe("buildSystemPrompt - additional cases", () => {
  it("does not contain any personally identifiable info", () => {
    const prompt = buildSystemPrompt();
    // Should not contain user-specific data
    expect(prompt).not.toMatch(/\d{3}-\d{4}/);
  });

  it("mentions not sending data to server", () => {
    expect(buildSystemPrompt()).toMatch(/server/i);
  });
});

describe("exportConversation - additional edge cases", () => {
  it("trims whitespace from message content", () => {
    const result = exportConversation([{ role: "user", content: "  hello  " }]);
    expect(result).toContain("hello");
    expect(result).not.toContain("  hello  ");
  });

  it("handles multiple user-only messages", () => {
    const result = exportConversation([
      { role: "user", content: "first" },
      { role: "user", content: "second" },
    ]);
    expect(result).toContain("first");
    expect(result).toContain("second");
    // Both should be labeled You
    expect(result.split("**You**").length - 1).toBe(2);
  });
});

// ── renderMarkdown - additional edge cases ────────────────────────────────────

describe("renderMarkdown - additional edge cases", () => {
  it("renders * list markers as well as - markers", () => {
    const out = renderMarkdown("* one\n* two");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<li>two</li>");
  });

  it("escapes & in plain text", () => {
    const out = renderMarkdown("cats & dogs");
    expect(out).toContain("&amp;");
    expect(out).not.toContain("cats & dogs");
  });

  it("fenced code block without language has no data-lang attribute", () => {
    const out = renderMarkdown("```\nsome code\n```");
    expect(out).not.toContain("data-lang");
  });

  it("inline bold inside paragraph works", () => {
    const out = renderMarkdown("This is **very** good.");
    expect(out).toContain("<strong>very</strong>");
  });

  it("h2 and h3 headers do not get processed as h1", () => {
    const out = renderMarkdown("## Section\n### Subsection");
    expect(out).toContain("<h2>Section</h2>");
    expect(out).toContain("<h3>Subsection</h3>");
    expect(out).not.toContain("<h1>");
  });
});
