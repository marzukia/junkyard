import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  type BatchCaptionRow,
  batchToCsv,
  batchToJson,
  formatBytes,
  formatCaption,
  formatProgress,
  isSupportedImage,
} from "./imageHelpers";

describe("isSupportedImage", () => {
  it("accepts PNG files", () => {
    const file = new File([""], "test.png", { type: "image/png" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("accepts JPEG files", () => {
    const file = new File([""], "photo.jpg", { type: "image/jpeg" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("accepts WebP files", () => {
    const file = new File([""], "img.webp", { type: "image/webp" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("accepts GIF files", () => {
    const file = new File([""], "anim.gif", { type: "image/gif" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("rejects PDF files", () => {
    const file = new File([""], "doc.pdf", { type: "application/pdf" });
    expect(isSupportedImage(file)).toBe(false);
  });

  it("rejects SVG files", () => {
    const file = new File([""], "logo.svg", { type: "image/svg+xml" });
    expect(isSupportedImage(file)).toBe(false);
  });

  it("rejects empty type", () => {
    const file = new File([""], "unknown");
    expect(isSupportedImage(file)).toBe(false);
  });

  it("covers all ACCEPTED_TYPES", () => {
    for (const mime of ACCEPTED_TYPES) {
      const file = new File([""], `test.${mime.split("/")[1]}`, { type: mime });
      expect(isSupportedImage(file)).toBe(true);
    }
  });
});

describe("formatBytes", () => {
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

describe("formatCaption", () => {
  it("capitalises the first letter", () => {
    expect(formatCaption("a dog sitting on a chair")).toBe("A dog sitting on a chair.");
  });

  it("adds a trailing period if missing", () => {
    expect(formatCaption("a cat")).toBe("A cat.");
  });

  it("does not double-add a period", () => {
    expect(formatCaption("a cat.")).toBe("A cat.");
  });

  it("trims leading/trailing whitespace", () => {
    expect(formatCaption("  a bird  ")).toBe("A bird.");
  });

  it("returns empty string for empty input", () => {
    expect(formatCaption("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(formatCaption("   ")).toBe("");
  });

  it("preserves existing correct capitalisation", () => {
    expect(formatCaption("Two people walking.")).toBe("Two people walking.");
  });
});

describe("batchToCsv", () => {
  const rows: BatchCaptionRow[] = [
    { filename: "photo.jpg", caption: "A cat on a mat." },
    { filename: "scene.png", caption: 'A "quoted" value.' },
  ];

  it("includes a header row", () => {
    const csv = batchToCsv(rows);
    expect(csv.startsWith("filename,caption")).toBe(true);
  });

  it("produces one data row per input", () => {
    const lines = batchToCsv(rows).split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("RFC 4180 double-quotes values containing double quotes", () => {
    const csv = batchToCsv(rows);
    expect(csv).toContain('"A ""quoted"" value."');
  });

  it("wraps all values in double quotes", () => {
    const csv = batchToCsv([{ filename: "a.jpg", caption: "simple" }]);
    expect(csv).toContain('"a.jpg","simple"');
  });

  it("returns only a header for an empty array", () => {
    expect(batchToCsv([])).toBe("filename,caption");
  });
});

describe("batchToJson", () => {
  it("returns valid JSON array", () => {
    const rows: BatchCaptionRow[] = [{ filename: "a.jpg", caption: "test" }];
    const json = batchToJson(rows);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual(rows);
  });

  it("returns empty JSON array for no rows", () => {
    expect(batchToJson([])).toBe("[]");
  });
});
