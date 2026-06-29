import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  clamp,
  computeCoverFit,
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
    expect(outputFilename("photo.jpg", "bg-removed")).toBe("photo-bg-removed.png");
  });

  it("handles PNG input", () => {
    expect(outputFilename("portrait.png", "bg-removed")).toBe("portrait-bg-removed.png");
  });

  it("handles dotted names", () => {
    expect(outputFilename("my.photo.webp", "bg-removed")).toBe("my.photo-bg-removed.png");
  });

  it("handles name with no extension", () => {
    expect(outputFilename("image", "bg-removed")).toBe("image-bg-removed.png");
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

describe("computeCoverFit", () => {
  it("covers a landscape src into a square dst without letterboxing", () => {
    // 200x100 src, 100x100 dst: must scale to 100x50... wait, cover means
    // the short axis fills first. Scale = max(100/200, 100/100) = max(0.5, 1) = 1
    // => w=200, h=100 -- wider than dst, centred: x=-50, y=0
    const r = computeCoverFit(200, 100, 100, 100);
    expect(r.w).toBe(200);
    expect(r.h).toBe(100);
    expect(r.x).toBe(-50);
    expect(r.y).toBe(0);
  });

  it("covers a portrait src into a square dst", () => {
    // 100x200 src, 100x100 dst: scale = max(100/100, 100/200) = max(1, 0.5) = 1
    // => w=100, h=200; x=0, y=-50
    const r = computeCoverFit(100, 200, 100, 100);
    expect(r.w).toBe(100);
    expect(r.h).toBe(200);
    expect(r.x).toBe(0);
    expect(r.y).toBe(-50);
  });

  it("scales up a small src to cover a larger dst", () => {
    // 50x50 src, 200x100 dst: scale = max(200/50, 100/50) = max(4, 2) = 4
    // => w=200, h=200; x=0, y=-50
    const r = computeCoverFit(50, 50, 200, 100);
    expect(r.w).toBe(200);
    expect(r.h).toBe(200);
    expect(r.x).toBe(0);
    expect(r.y).toBe(-50);
  });

  it("returns dst size when src equals dst", () => {
    const r = computeCoverFit(400, 300, 400, 300);
    expect(r.w).toBe(400);
    expect(r.h).toBe(300);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it("handles zero-dimension src gracefully", () => {
    const r = computeCoverFit(0, 100, 200, 200);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.w).toBe(200);
    expect(r.h).toBe(200);
  });

  it("drawn area always covers the full dst width", () => {
    // For any input, x + w >= dstW
    const cases: [number, number, number, number][] = [
      [1920, 1080, 800, 600],
      [100, 400, 300, 200],
      [640, 480, 1920, 1080],
    ];
    for (const [sw, sh, dw, dh] of cases) {
      const { x, y, w, h } = computeCoverFit(sw, sh, dw, dh);
      expect(x + w).toBeGreaterThanOrEqual(dw);
      expect(y + h).toBeGreaterThanOrEqual(dh);
    }
  });
});
