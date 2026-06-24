import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  exportConversation,
  formatBytes,
  formatEta,
  formatProgress,
  hasWebGpu,
  trimMessage,
} from "./chatHelpers";

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes below 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats fractional MB", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
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

describe("hasWebGpu", () => {
  it("returns false in jsdom (no gpu on navigator)", async () => {
    // jsdom does not expose navigator.gpu
    expect(await hasWebGpu()).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  it("returns a non-empty string", () => {
    const p = buildSystemPrompt();
    expect(typeof p).toBe("string");
    expect(p.length).toBeGreaterThan(10);
  });

  it("mentions the browser", () => {
    expect(buildSystemPrompt()).toMatch(/browser/i);
  });
});

describe("trimMessage", () => {
  it("trims surrounding whitespace", () => {
    expect(trimMessage("  hello  ")).toBe("hello");
  });

  it("preserves single newlines within a block", () => {
    expect(trimMessage("line1\nline2")).toBe("line1\nline2");
  });

  it("collapses multiple blank lines to double newline", () => {
    expect(trimMessage("para1\n\n\n\npara2")).toBe("para1\n\npara2");
  });

  it("trims each paragraph block", () => {
    expect(trimMessage("  hello  \n\n  world  ")).toBe("hello\n\nworld");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(trimMessage("   \n  \n  ")).toBe("");
  });
});

describe("formatEta", () => {
  it("returns null for zero total", () => {
    expect(formatEta(0, 0, 1000)).toBeNull();
  });

  it("returns null for zero elapsed", () => {
    expect(formatEta(500, 1000, 0)).toBeNull();
  });

  it("returns null for zero loaded", () => {
    expect(formatEta(0, 1000, 5000)).toBeNull();
  });

  it("returns seconds label when under a minute", () => {
    // 50% done in 10s => 10s left
    const result = formatEta(500, 1000, 10_000);
    expect(result).toBe("~10s left");
  });

  it("returns minutes label when over a minute", () => {
    // 10% done in 10s => 90s left
    const result = formatEta(100, 1000, 10_000);
    expect(result).toBe("~2m left");
  });

  it("returns null when very close to done", () => {
    // 98% done in 10s => ~0.2s left (< 5s threshold)
    const result = formatEta(980, 1000, 10_000);
    expect(result).toBeNull();
  });
});

describe("exportConversation", () => {
  it("returns empty string for empty messages", () => {
    expect(exportConversation([])).toBe("");
  });

  it("includes user and assistant labels", () => {
    const result = exportConversation([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
    expect(result).toContain("**You**");
    expect(result).toContain("**AI**");
    expect(result).toContain("Hello");
    expect(result).toContain("Hi there");
  });

  it("starts with a heading", () => {
    const result = exportConversation([{ role: "user", content: "test" }]);
    expect(result.startsWith("# Chat export")).toBe(true);
  });

  it("separates messages with ---", () => {
    const result = exportConversation([
      { role: "user", content: "msg1" },
      { role: "assistant", content: "msg2" },
    ]);
    expect(result).toContain("---");
  });
});
