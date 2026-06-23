/**
 * Augmented tests for convert app:
 * - canEncodeAvif() UA-based detection (not tested in main file)
 * - formatBytes boundary cases (main file tests pass but 2-decimal MB not covered)
 * - computeOutputDimensions additional edge cases
 * - isHeic additional cases
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canEncodeAvif,
  computeOutputDimensions,
  formatBytes,
  formatToMime,
  isHeic,
  outputFilename,
} from "./convert";

// ── canEncodeAvif ─────────────────────────────────────────────────────────────

describe("canEncodeAvif", () => {
  let originalUserAgent: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalUserAgent = Object.getOwnPropertyDescriptor(navigator, "userAgent");
  });

  afterEach(() => {
    if (originalUserAgent) {
      Object.defineProperty(navigator, "userAgent", originalUserAgent);
    }
  });

  function mockUA(ua: string) {
    Object.defineProperty(navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  }

  it("returns true for Chrome >= 94", () => {
    mockUA(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
    );
    expect(canEncodeAvif()).toBe(true);
  });

  it("returns false for Chrome < 94", () => {
    mockUA(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
    );
    expect(canEncodeAvif()).toBe(false);
  });

  it("returns true for Firefox >= 113", () => {
    mockUA("Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0");
    expect(canEncodeAvif()).toBe(true);
  });

  it("returns false for Firefox < 113", () => {
    mockUA("Mozilla/5.0 (X11; Linux x86_64; rv:110.0) Gecko/20100101 Firefox/110.0");
    expect(canEncodeAvif()).toBe(false);
  });

  it("returns false for Safari (no Chrome or Firefox indicator)", () => {
    mockUA(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
    );
    expect(canEncodeAvif()).toBe(false);
  });
});

// ── formatBytes - additional cases ────────────────────────────────────────────

describe("formatBytes - additional boundary cases", () => {
  it("formats 1023 bytes as '1023 B'", () => {
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats exactly 1 KB as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1 MB with 2 decimal places", () => {
    // The convert formatBytes uses .toFixed(2) for MB, not .toFixed(1)
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });

  it("formats large files in MB", () => {
    expect(formatBytes(10 * 1024 * 1024)).toBe("10.00 MB");
  });
});

// ── computeOutputDimensions - additional edge cases ───────────────────────────

describe("computeOutputDimensions - additional edge cases", () => {
  const base = { maxDimension: 0, exactWidth: 0, exactHeight: 0, scalePct: 0 };

  it("does not change dimensions when all options are 0", () => {
    expect(computeOutputDimensions(800, 600, base)).toEqual({ w: 800, h: 600 });
  });

  it("maxDimension respects portrait orientation (longer side is height)", () => {
    const d = computeOutputDimensions(600, 1200, { ...base, maxDimension: 800 });
    expect(d.h).toBe(800);
    expect(d.w).toBe(400);
  });

  it("exactWidth=0 with exactHeight is treated as 'width only' branch not taken", () => {
    // exactWidth=0 should not trigger exact mode; falls through to exactHeight
    const d = computeOutputDimensions(800, 400, { ...base, exactHeight: 200 });
    expect(d.h).toBe(200);
    expect(d.w).toBe(400);
  });

  it("scalePct=100 returns original dimensions", () => {
    const d = computeOutputDimensions(640, 480, { ...base, scalePct: 100 });
    expect(d).toEqual({ w: 640, h: 480 });
  });

  it("exactWidth takes precedence over scalePct", () => {
    // exactWidth is checked first in the implementation
    const d = computeOutputDimensions(1000, 500, { ...base, scalePct: 25, exactWidth: 800 });
    expect(d.w).toBe(800);
  });
});

// ── formatToMime - all formats ─────────────────────────────────────────────────

describe("formatToMime - exhaustive", () => {
  it("all four output formats map to the correct MIME type", () => {
    expect(formatToMime("jpg")).toBe("image/jpeg");
    expect(formatToMime("png")).toBe("image/png");
    expect(formatToMime("webp")).toBe("image/webp");
    expect(formatToMime("avif")).toBe("image/avif");
  });
});

// ── isHeic - additional cases ──────────────────────────────────────────────────

describe("isHeic - additional cases", () => {
  it("returns false for a PNG file with .heic-like name but image/png type", () => {
    // Extension check is on filename; if type is png and name doesn't have .heic it's false
    const f = new File([""], "photo.png", { type: "image/png" });
    expect(isHeic(f)).toBe(false);
  });

  it("returns true for lowercase .heic extension", () => {
    const f = new File([""], "photo.heic", { type: "" });
    expect(isHeic(f)).toBe(true);
  });

  it("returns true for .heif extension (case-insensitive)", () => {
    const f = new File([""], "photo.HEIF", { type: "" });
    expect(isHeic(f)).toBe(true);
  });
});

// ── outputFilename - additional cases ─────────────────────────────────────────

describe("outputFilename - additional cases", () => {
  it("handles no extension with avif format", () => {
    expect(outputFilename("noext", "avif")).toBe("noext.avif");
  });

  it("handles already-lowercase extension", () => {
    expect(outputFilename("photo.jpg", "png")).toBe("photo.png");
  });
});
