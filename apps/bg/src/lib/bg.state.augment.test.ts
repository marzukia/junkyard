/**
 * Augmented tests for bg app:
 * - bgRemoval.ts pure state functions (isModelLoaded)
 * - imageHelpers.ts additional negative and boundary cases not in main test
 */
import { describe, expect, it } from "vitest";
import { isModelLoaded } from "./bgRemoval";
import { clamp, formatBytes, formatProgress, outputFilename, parseHexColor } from "./imageHelpers";

// ── bgRemoval.ts pure state ───────────────────────────────────────────────────

describe("isModelLoaded", () => {
  it("returns false before any model is loaded", () => {
    // In jsdom, no model gets loaded, so the module-level segmenter is null.
    expect(isModelLoaded()).toBe(false);
  });
});

// ── imageHelpers - additional negative and boundary cases ─────────────────────

describe("formatBytes - additional cases", () => {
  it("formats exactly 1 KB boundary (1024 B shows as KB)", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1 MB boundary (1048576 B shows as MB)", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats 0 bytes as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats 1 byte as '1 B'", () => {
    expect(formatBytes(1)).toBe("1 B");
  });
});

describe("formatProgress - additional cases", () => {
  it("returns '0%' for negative total", () => {
    expect(formatProgress(0, -1)).toBe("0%");
  });

  it("handles loaded > total (over-download) by capping at 100%", () => {
    expect(formatProgress(1500, 1000)).toBe("100%");
  });

  it("returns '100%' when loaded equals total", () => {
    expect(formatProgress(42, 42)).toBe("100%");
  });
});

describe("clamp - additional cases", () => {
  it("handles floating point values", () => {
    expect(clamp(0.5, 0, 1)).toBeCloseTo(0.5);
  });

  it("handles negative range", () => {
    expect(clamp(-3, -10, -1)).toBe(-3);
    expect(clamp(0, -10, -1)).toBe(-1);
    expect(clamp(-20, -10, -1)).toBe(-10);
  });

  it("clamps correctly when min equals max", () => {
    expect(clamp(99, 5, 5)).toBe(5);
  });
});

describe("outputFilename - additional cases", () => {
  it("handles uppercase extension", () => {
    // replace(/\.[^.]+$/) is case-sensitive but works on the extension portion
    expect(outputFilename("IMAGE.PNG")).toBe("IMAGE-bg-removed.png");
  });

  it("handles JPEG extension", () => {
    expect(outputFilename("photo.jpeg")).toBe("photo-bg-removed.png");
  });
});

describe("parseHexColor - additional cases", () => {
  it("handles mixed-case 6-digit hex", () => {
    expect(parseHexColor("A1B2C3")).toBe("#a1b2c3");
  });

  it("returns null for 7-digit hex without hash", () => {
    expect(parseHexColor("1234567")).toBeNull();
  });

  it("returns null for non-hex characters in 6-char string", () => {
    expect(parseHexColor("GGHHII")).toBeNull();
  });

  it("accepts 6-digit hex with leading # and trailing space", () => {
    // trim() in the function handles trailing space
    expect(parseHexColor("#aabbcc ")).toBe("#aabbcc");
  });
});
