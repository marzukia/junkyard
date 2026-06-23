import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  MAX_MEGAPIXELS,
  deviceMemoryBudgetMB,
  formatBytes,
  formatDimensions,
  formatProgress,
  isSupportedImage,
  outputFilename,
  outputMime,
  safeInputMegapixels,
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

// ── Cap-math tests ────────────────────────────────────────────────────────────
// These guard the output-tensor memory bound: an input image at the computed
// safe limit must produce an output tensor that stays within the budget.
//
// Output tensor bytes = output_px * 3 * 4 (RGB float32)
// 4x peak: two live tensors (pass-1 + pass-2 allocated simultaneously)

describe("safeInputMegapixels", () => {
  it("mobile 4x (180 MB budget): output peak stays within budget", () => {
    const budgetMB = 180;
    const scale = 4;
    const safeMp = safeInputMegapixels(scale, budgetMB);

    // Convert safe input megapixels to output pixels
    const outputPixels = safeMp * 1_000_000 * (scale * scale); // scale^2 factor
    // Peak: two tensors live during 4x (pass-1 output + pass-2 output)
    const peakBytes = outputPixels * 3 * 4 * 2;
    const peakMB = peakBytes / (1024 * 1024);

    // Peak tensor usage must be at or below the budget
    expect(peakMB).toBeLessThanOrEqual(budgetMB);
    // And it should be meaningful -- not trivially 0 or negative
    expect(safeMp).toBeGreaterThan(0);
  });

  it("mobile 4x (180 MB budget): safe input is significantly smaller than desktop cap", () => {
    // The desktop cap for 4x is 2 MP. A 180 MB budget should produce a tighter limit.
    const safeMp = safeInputMegapixels(4, 180);
    expect(safeMp).toBeLessThan(MAX_MEGAPIXELS[4]);
  });

  it("desktop 2x (512 MB budget): output peak stays within budget", () => {
    const budgetMB = 512;
    const scale = 2;
    const safeMp = safeInputMegapixels(scale, budgetMB);

    const outputPixels = safeMp * 1_000_000 * (scale * scale);
    // 2x: only one live tensor (single pass)
    const peakBytes = outputPixels * 3 * 4 * 1;
    const peakMB = peakBytes / (1024 * 1024);

    expect(peakMB).toBeLessThanOrEqual(budgetMB);
    expect(safeMp).toBeGreaterThan(0);
  });

  it("desktop 2x (512 MB budget): allows more MP than desktop cap (cap is the actual gate)", () => {
    // With 512 MB, the memory formula allows far more than the 8 MP desktop cap.
    // The cap logic picks the TIGHTER of the two; just verify the formula isn't
    // artificially constraining desktop use.
    const safeMp = safeInputMegapixels(2, 512);
    expect(safeMp).toBeGreaterThan(MAX_MEGAPIXELS[2]);
  });

  it("ultra-low memory 4x (80 MB budget): output peak stays within budget", () => {
    const budgetMB = 80;
    const scale = 4;
    const safeMp = safeInputMegapixels(scale, budgetMB);

    const outputPixels = safeMp * 1_000_000 * (scale * scale);
    const peakBytes = outputPixels * 3 * 4 * 2;
    const peakMB = peakBytes / (1024 * 1024);

    expect(peakMB).toBeLessThanOrEqual(budgetMB);
    expect(safeMp).toBeGreaterThan(0);
  });

  it("4x is more restrictive than 2x at the same budget", () => {
    const budget = 180;
    expect(safeInputMegapixels(4, budget)).toBeLessThan(safeInputMegapixels(2, budget));
  });

  it("at-limit case: exactly at the budget produces 0 headroom", () => {
    // Construct budget from an exact safe input size and verify round-trip.
    // Input: 0.5 MP, scale 4 -> output 8 MP, peak 2 tensors
    // peak bytes = 0.5e6 * 16 * 2 * 12 = 192_000_000 bytes = ~183.1 MB
    const inputMp = 0.5;
    const scale = 4;
    const peakBytes = inputMp * 1_000_000 * scale * scale * 2 * 12;
    const budgetMB = peakBytes / (1024 * 1024);

    const safeMp = safeInputMegapixels(scale, budgetMB);
    // The safe limit should equal the input we derived the budget from
    expect(safeMp).toBeCloseTo(inputMp, 6);
  });
});

describe("deviceMemoryBudgetMB", () => {
  it("returns a positive number", () => {
    // In the jsdom test environment navigator.deviceMemory is undefined,
    // so the function falls back to desktop defaults.
    const budget = deviceMemoryBudgetMB();
    expect(budget).toBeGreaterThan(0);
  });

  it("returns 512 in the jsdom test environment (no deviceMemory API)", () => {
    // jsdom does not set navigator.deviceMemory; the fallback is 8 GB which
    // is the desktop-capable branch.
    const budget = deviceMemoryBudgetMB();
    expect(budget).toBe(512);
  });
});
