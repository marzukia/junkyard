import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  formatBytes,
  formatProgress,
  isSupportedImage,
  outputFilename,
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

  it("accepts a garbage file with a valid image extension (MIME check passes; binary decode check happens downstream)", () => {
    // A file with non-image bytes but a .jpg extension gets type=image/jpeg from the browser.
    // isSupportedImage returns true — the early createImageBitmap validation in the UI
    // is what gates this from silently failing with no user feedback.
    const garbage = new File([new Uint8Array([0x00, 0x01, 0x02, 0xff])], "not-an-image.jpg", {
      type: "image/jpeg",
    });
    expect(isSupportedImage(garbage)).toBe(true);
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
  it("strips extension and appends -depth.png", () => {
    expect(outputFilename("photo.jpg")).toBe("photo-depth.png");
  });

  it("handles PNG input", () => {
    expect(outputFilename("portrait.png")).toBe("portrait-depth.png");
  });

  it("handles dotted names", () => {
    expect(outputFilename("my.photo.webp")).toBe("my.photo-depth.png");
  });

  it("handles name with no extension", () => {
    expect(outputFilename("image")).toBe("image-depth.png");
  });
});
