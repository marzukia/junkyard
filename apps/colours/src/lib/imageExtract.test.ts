/**
 * Tests for the pure logic in imageExtract.ts.
 *
 * Canvas-dependent functions (samplePixels, extractPaletteFromFile,
 * extractPaletteFromImage) require a DOM with canvas support; we test only the
 * pure parts that can run in jsdom without a real canvas implementation.
 */

import { describe, expect, it } from "vitest";
import { isImageFile } from "./imageExtract";

// ── isImageFile ───────────────────────────────────────────────────────────────

describe("isImageFile", () => {
  function makeFile(name: string, type: string): File {
    return new File([""], name, { type });
  }

  it("accepts image/jpeg", () => {
    expect(isImageFile(makeFile("photo.jpg", "image/jpeg"))).toBe(true);
  });

  it("accepts image/png", () => {
    expect(isImageFile(makeFile("icon.png", "image/png"))).toBe(true);
  });

  it("accepts image/webp", () => {
    expect(isImageFile(makeFile("art.webp", "image/webp"))).toBe(true);
  });

  it("accepts image/gif", () => {
    expect(isImageFile(makeFile("anim.gif", "image/gif"))).toBe(true);
  });

  it("rejects text/plain", () => {
    expect(isImageFile(makeFile("readme.txt", "text/plain"))).toBe(false);
  });

  it("rejects application/pdf", () => {
    expect(isImageFile(makeFile("doc.pdf", "application/pdf"))).toBe(false);
  });

  it("rejects empty type string", () => {
    expect(isImageFile(makeFile("unknown", ""))).toBe(false);
  });
});
