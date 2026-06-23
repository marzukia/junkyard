/**
 * Augment tests for upscale/imageHelpers.ts -- covers gaps in the existing suite:
 * isConstrainedDevice, outputFilename with unusual names, formatBytes 0/edge,
 * safeInputMegapixels invariants, MAX_DIMENSION constant, ACCEPTED_EXTENSIONS.
 */
import { describe, expect, it } from "vitest";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_TYPES,
  MAX_DIMENSION,
  MAX_MEGAPIXELS,
  deviceMemoryBudgetMB,
  formatBytes,
  formatDimensions,
  formatProgress,
  isConstrainedDevice,
  isSupportedImage,
  outputFilename,
  outputMime,
  safeInputMegapixels,
} from "./imageHelpers";

// ── isConstrainedDevice ───────────────────────────────────────────────────────

describe("isConstrainedDevice", () => {
  it("returns a boolean", () => {
    expect(typeof isConstrainedDevice()).toBe("boolean");
  });

  it("is false in the jsdom test environment (deviceMemoryBudgetMB returns 512)", () => {
    // jsdom => no deviceMemory => budget = 512 >= 512 => not constrained
    expect(isConstrainedDevice()).toBe(false);
  });

  it("is consistent with deviceMemoryBudgetMB", () => {
    const budget = deviceMemoryBudgetMB();
    expect(isConstrainedDevice()).toBe(budget < 512);
  });
});

// ── MAX_DIMENSION invariants ──────────────────────────────────────────────────

describe("MAX_DIMENSION", () => {
  it("4x limit is smaller than 2x limit", () => {
    expect(MAX_DIMENSION[4]).toBeLessThan(MAX_DIMENSION[2]);
  });

  it("2x dimension^2 / 1e6 is close to MAX_MEGAPIXELS[2]", () => {
    // The dimension is the longest edge; for a square image:
    // mp = (MAX_DIMENSION[2])^2 / 1e6 should approximately match MAX_MEGAPIXELS[2]
    const approxMp = (MAX_DIMENSION[2] * MAX_DIMENSION[2]) / 1_000_000;
    // Should be within 1 MP of the cap
    expect(Math.abs(approxMp - MAX_MEGAPIXELS[2])).toBeLessThan(1);
  });

  it("4x dimension^2 / 1e6 is close to MAX_MEGAPIXELS[4]", () => {
    const approxMp = (MAX_DIMENSION[4] * MAX_DIMENSION[4]) / 1_000_000;
    expect(Math.abs(approxMp - MAX_MEGAPIXELS[4])).toBeLessThan(0.1);
  });
});

// ── ACCEPTED_EXTENSIONS ───────────────────────────────────────────────────────

describe("ACCEPTED_EXTENSIONS", () => {
  it("is a non-empty string", () => {
    expect(typeof ACCEPTED_EXTENSIONS).toBe("string");
    expect(ACCEPTED_EXTENSIONS.length).toBeGreaterThan(0);
  });

  it("includes .png", () => {
    expect(ACCEPTED_EXTENSIONS).toContain(".png");
  });

  it("includes .jpg or .jpeg", () => {
    expect(ACCEPTED_EXTENSIONS.toLowerCase()).toMatch(/\.jpe?g/);
  });

  it("includes .webp", () => {
    expect(ACCEPTED_EXTENSIONS).toContain(".webp");
  });
});

// ── isSupportedImage -- additional paths ────────────────────────────────────

describe("isSupportedImage -- additional paths", () => {
  it("rejects TIFF files", () => {
    const file = new File([""], "img.tiff", { type: "image/tiff" });
    expect(isSupportedImage(file)).toBe(false);
  });

  it("rejects BMP files", () => {
    const file = new File([""], "img.bmp", { type: "image/bmp" });
    expect(isSupportedImage(file)).toBe(false);
  });

  it("rejects empty MIME type", () => {
    const file = new File([""], "img.jpg");
    // No type set = ''
    expect(isSupportedImage(file)).toBe(false);
  });

  it("all ACCEPTED_TYPES are individually accepted", () => {
    for (const mime of ACCEPTED_TYPES) {
      const file = new File([""], "test", { type: mime });
      expect(isSupportedImage(file)).toBe(true);
    }
  });
});

// ── formatBytes -- edge cases ─────────────────────────────────────────────────

describe("formatBytes -- edge cases", () => {
  it("formats 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats exactly 1024 as 1.0 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1 MB (1024*1024)", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats fractional KB below 1 MB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
});

// ── formatProgress -- negative paths ────────────────────────────────────────

describe("formatProgress -- negative paths", () => {
  it("returns 0% for zero total", () => {
    expect(formatProgress(0, 0)).toBe("0%");
  });

  it("returns 100% when loaded exceeds total", () => {
    expect(formatProgress(200, 100)).toBe("100%");
  });

  it("rounds fractional percentage", () => {
    // 1/3 -> 33%
    expect(formatProgress(1, 3)).toBe("33%");
  });
});

// ── outputFilename -- edge cases ─────────────────────────────────────────────

describe("outputFilename -- edge cases", () => {
  it("handles filenames with spaces (spaces are kept)", () => {
    const name = outputFilename("my photo.jpg", 2);
    expect(name).toBe("my photo-upscaled-2x.png");
  });

  it("handles filename with multiple dots", () => {
    // Last dot is the extension separator
    const name = outputFilename("archive.2024.png", 4);
    expect(name).toBe("archive.2024-upscaled-4x.png");
  });

  it("base64 format would be the same as png (jpeg maps to .jpg)", () => {
    expect(outputFilename("x.png", 2, "jpeg")).toContain(".jpg");
  });
});

// ── formatDimensions -- edge cases ───────────────────────────────────────────

describe("formatDimensions -- edge cases", () => {
  it("handles 1x1 dimension", () => {
    expect(formatDimensions(1, 1)).toBe("1 x 1");
  });

  it("handles very large dimensions", () => {
    expect(formatDimensions(10000, 8000)).toBe("10000 x 8000");
  });
});

// ── outputMime -- negative path ───────────────────────────────────────────────

describe("outputMime -- additional paths", () => {
  it("defaults to png for png", () => {
    expect(outputMime("png")).toBe("image/png");
  });

  it("webp returns image/webp", () => {
    expect(outputMime("webp")).toBe("image/webp");
  });
});

// ── safeInputMegapixels -- additional invariants ──────────────────────────────

describe("safeInputMegapixels -- additional invariants", () => {
  it("larger budget allows more megapixels for same scale", () => {
    const small = safeInputMegapixels(2, 100);
    const large = safeInputMegapixels(2, 400);
    expect(large).toBeGreaterThan(small);
  });

  it("scale 2 always allows more MP than scale 4 at same budget", () => {
    for (const budget of [80, 180, 512]) {
      expect(safeInputMegapixels(2, budget)).toBeGreaterThan(safeInputMegapixels(4, budget));
    }
  });

  it("is proportional to budget (doubling budget doubles allowed MP)", () => {
    const a = safeInputMegapixels(2, 100);
    const b = safeInputMegapixels(2, 200);
    expect(b).toBeCloseTo(a * 2, 6);
  });
});
