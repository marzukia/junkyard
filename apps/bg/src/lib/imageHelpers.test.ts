import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  clamp,
  formatBytes,
  formatProgress,
  isSupportedImage,
  outputFilename,
  parseHexColor,
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

describe("outputFilename", () => {
  it("strips extension and appends -bg-removed.png", () => {
    expect(outputFilename("photo.jpg")).toBe("photo-bg-removed.png");
  });

  it("handles PNG input", () => {
    expect(outputFilename("portrait.png")).toBe("portrait-bg-removed.png");
  });

  it("handles dotted names", () => {
    expect(outputFilename("my.photo.webp")).toBe("my.photo-bg-removed.png");
  });

  it("handles name with no extension", () => {
    expect(outputFilename("image")).toBe("image-bg-removed.png");
  });
});

describe("parseHexColor", () => {
  it("accepts a 6-digit hex with hash", () => {
    expect(parseHexColor("#ff0000")).toBe("#ff0000");
  });

  it("accepts a 6-digit hex without hash", () => {
    expect(parseHexColor("1a2b3c")).toBe("#1a2b3c");
  });

  it("expands 3-digit shorthand", () => {
    expect(parseHexColor("#f0f")).toBe("#ff00ff");
  });

  it("normalises to lowercase", () => {
    expect(parseHexColor("#AABBCC")).toBe("#aabbcc");
  });

  it("returns null for invalid input", () => {
    expect(parseHexColor("not-a-color")).toBeNull();
  });

  it("returns null for 5-digit input", () => {
    expect(parseHexColor("#12345")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHexColor("")).toBeNull();
  });
});

describe("clamp", () => {
  it("returns value within range unchanged", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("clamps below min to min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("clamps above max to max", () => {
    expect(clamp(120, 0, 100)).toBe(100);
  });

  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });

  it("returns max when value equals max", () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });
});
