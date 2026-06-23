/**
 * Augmented tests for convert app:
 * - canEncodeAvif() UA-based detection (not tested in main file)
 * - formatBytes boundary cases (main file tests pass but 2-decimal MB not covered)
 * - computeOutputDimensions additional edge cases
 * - isHeic additional cases
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetAvifProbeCache,
  canEncodeAvif,
  computeOutputDimensions,
  formatBytes,
  formatToMime,
  isHeic,
  outputFilename,
} from "./convert";

// ── canEncodeAvif ─────────────────────────────────────────────────────────────
// canEncodeAvif now uses a real canvas round-trip probe rather than UA sniffing.
// In jsdom (test env) canvas.toBlob always returns a PNG blob (jsdom has no AVIF encoder),
// so the probe correctly returns false — which is the right answer for a headless env.

describe("canEncodeAvif", () => {
  beforeEach(() => {
    _resetAvifProbeCache();
  });

  it("returns a Promise", async () => {
    const result = canEncodeAvif();
    expect(result).toBeInstanceOf(Promise);
    await result; // ensure it settles (probe may take up to 500ms in jsdom)
  }, 10_000);

  it("returns false in jsdom (no AVIF encoder available)", async () => {
    // jsdom's canvas.toBlob never calls back -- the probe times out after 500ms
    // and correctly returns false (no AVIF support in jsdom).
    const result = await canEncodeAvif();
    expect(result).toBe(false);
  }, 10_000);

  it("caches the result so subsequent calls are synchronously resolved", async () => {
    const first = await canEncodeAvif();
    // Second call hits the cache (no re-probe)
    const second = await canEncodeAvif();
    expect(second).toBe(first);
  }, 10_000);

  it("returns false when document is undefined (SSR)", async () => {
    _resetAvifProbeCache();
    const origDoc = globalThis.document;
    // @ts-expect-error - simulating SSR
    delete globalThis.document;
    try {
      const result = await canEncodeAvif();
      expect(result).toBe(false);
    } finally {
      globalThis.document = origDoc;
      _resetAvifProbeCache();
    }
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
