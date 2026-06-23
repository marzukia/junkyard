import { describe, expect, it } from "vitest";
import { BATCH_MAX_ROWS, parseBatchInput, sanitiseFilename } from "./batch";

describe("sanitiseFilename", () => {
  it("passes through plain alphanumeric strings", () => {
    expect(sanitiseFilename("product-42")).toBe("product-42");
  });

  it("replaces filesystem-unsafe characters with underscores", () => {
    expect(sanitiseFilename("file/name:test")).toBe("file_name_test");
  });

  it("collapses consecutive underscores", () => {
    expect(sanitiseFilename("a//b")).toBe("a_b");
  });

  it("trims leading and trailing underscores produced by replacement", () => {
    expect(sanitiseFilename("/path/")).toBe("path");
  });

  it("falls back to 'qr' for a string that is all unsafe chars", () => {
    expect(sanitiseFilename("///")).toBe("qr");
  });

  it("trims whitespace before sanitising", () => {
    expect(sanitiseFilename("  hello world  ")).toBe("hello world");
  });

  it("caps at 100 characters", () => {
    const long = "a".repeat(120);
    expect(sanitiseFilename(long).length).toBe(100);
  });
});

describe("parseBatchInput - single column (content only)", () => {
  it("parses newline-separated lines into items with index-based labels", () => {
    const result = parseBatchInput("https://example.com\nhttps://other.com");
    expect(result.items).toEqual([
      { label: "1", content: "https://example.com" },
      { label: "2", content: "https://other.com" },
    ]);
    expect(result.cappedAt).toBeNull();
    expect(result.skippedRows).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const result = parseBatchInput("foo\r\nbar\r\n");
    expect(result.items).toHaveLength(2);
    expect(result.items[0].content).toBe("foo");
    expect(result.items[1].content).toBe("bar");
  });

  it("silently skips blank lines", () => {
    const result = parseBatchInput("foo\n\nbar");
    expect(result.items).toHaveLength(2);
    expect(result.skippedRows).toEqual([]);
  });

  it("returns an empty items list for all-whitespace input", () => {
    const result = parseBatchInput("   \n  \n");
    expect(result.items).toHaveLength(0);
  });
});

describe("parseBatchInput - two-column label,content", () => {
  it("uses first column as label and second as content", () => {
    const result = parseBatchInput("Homepage,https://example.com");
    expect(result.items).toEqual([{ label: "Homepage", content: "https://example.com" }]);
  });

  it("sanitises the label for filename safety", () => {
    const result = parseBatchInput("My/Product,https://example.com");
    expect(result.items[0].label).toBe("My_Product");
  });

  it("falls back to index label when label column is empty", () => {
    const result = parseBatchInput(",https://example.com");
    expect(result.items[0].label).toBe("1");
    expect(result.items[0].content).toBe("https://example.com");
  });

  it("records skipped rows when content column is empty", () => {
    const result = parseBatchInput("label,\nvalid,https://example.com");
    expect(result.items).toHaveLength(1);
    expect(result.skippedRows).toContain(0);
  });

  it("handles quoted fields containing commas", () => {
    const result = parseBatchInput('"Smith, Jane",https://example.com');
    // The comma inside quotes is preserved in the label; commas are not filesystem-unsafe
    expect(result.items[0].label).toBe("Smith, Jane");
    expect(result.items[0].content).toBe("https://example.com");
  });

  it("handles content with multiple commas - joins remainder as content", () => {
    const result = parseBatchInput("label,part1,part2");
    expect(result.items[0].label).toBe("label");
    expect(result.items[0].content).toBe("part1,part2");
  });
});

describe("parseBatchInput - row cap", () => {
  it(`caps output at ${BATCH_MAX_ROWS} items`, () => {
    const input = Array.from({ length: BATCH_MAX_ROWS + 10 }, (_, i) => `row${i}`).join("\n");
    const result = parseBatchInput(input);
    expect(result.items).toHaveLength(BATCH_MAX_ROWS);
    expect(result.cappedAt).toBe(BATCH_MAX_ROWS);
  });

  it("returns null cappedAt when within limit", () => {
    const input = Array.from({ length: 5 }, (_, i) => `row${i}`).join("\n");
    const result = parseBatchInput(input);
    expect(result.cappedAt).toBeNull();
  });
});
