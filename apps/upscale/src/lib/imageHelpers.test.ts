import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  MAX_MEGAPIXELS,
  formatBytes,
  formatDimensions,
  formatProgress,
  isSupportedImage,
  outputFilename,
  outputMime,
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

  it("rejects GIF files", () => {
    const file = new File([""], "anim.gif", { type: "image/gif" });
    expect(isSupportedImage(file)).toBe(false);
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
  it("strips extension and appends scale + upscaled.png (default format)", () => {
    expect(outputFilename("photo.jpg", 2)).toBe("photo-upscaled-2x.png");
  });

  it("uses .png for png format", () => {
    expect(outputFilename("photo.jpg", 2, "png")).toBe("photo-upscaled-2x.png");
  });

  it("uses .jpg for jpeg format", () => {
    expect(outputFilename("photo.png", 2, "jpeg")).toBe("photo-upscaled-2x.jpg");
  });

  it("uses .webp for webp format", () => {
    expect(outputFilename("photo.png", 2, "webp")).toBe("photo-upscaled-2x.webp");
  });

  it("handles 4x scale", () => {
    expect(outputFilename("portrait.png", 4)).toBe("portrait-upscaled-4x.png");
  });

  it("handles dotted names", () => {
    expect(outputFilename("my.photo.webp", 2)).toBe("my.photo-upscaled-2x.png");
  });

  it("handles name with no extension", () => {
    expect(outputFilename("image", 2)).toBe("image-upscaled-2x.png");
  });
});

describe("formatDimensions", () => {
  it("formats width x height", () => {
    expect(formatDimensions(1920, 1080)).toBe("1920 x 1080");
  });

  it("formats square dimensions", () => {
    expect(formatDimensions(512, 512)).toBe("512 x 512");
  });
});

describe("outputMime", () => {
  it("returns image/png for png", () => {
    expect(outputMime("png")).toBe("image/png");
  });

  it("returns image/jpeg for jpeg", () => {
    expect(outputMime("jpeg")).toBe("image/jpeg");
  });

  it("returns image/webp for webp", () => {
    expect(outputMime("webp")).toBe("image/webp");
  });
});

describe("MAX_MEGAPIXELS", () => {
  it("caps 4x at 2 MP", () => {
    expect(MAX_MEGAPIXELS[4]).toBe(2);
  });

  it("caps 2x at 8 MP", () => {
    expect(MAX_MEGAPIXELS[2]).toBe(8);
  });
});
