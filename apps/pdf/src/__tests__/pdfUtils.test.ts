/**
 * Tests for pdfUtils: watermark sanitization (WinAnsi crash guard)
 * and parsePageRange.
 *
 * addWatermark uses StandardFont (Helvetica/WinAnsi-only). Before the fix it
 * would throw "WinAnsi cannot encode '₿'" on any non-Latin watermark text.
 * Post-fix it sanitizes via sanitizeWinAnsi() and produces PDF bytes.
 *
 * These tests run in jsdom with vitest. pdf-lib works in jsdom without
 * additional setup.
 */

import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addWatermark, addPageNumbers, parsePageRange } from "../lib/pdfUtils";

async function blankPdf(pageCount = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([595, 842]);
  }
  return doc.save();
}

describe("addWatermark – WinAnsi crash guard", () => {
  it("does not throw for ASCII watermark", async () => {
    const pdf = await blankPdf();
    await expect(addWatermark(pdf, "DRAFT")).resolves.toBeInstanceOf(Uint8Array);
  });

  it("does not throw for non-Latin watermark (₿ Bitcoin sign)", async () => {
    const pdf = await blankPdf();
    await expect(addWatermark(pdf, "PAID ₿")).resolves.toBeInstanceOf(Uint8Array);
  });

  it("does not throw for Arabic watermark", async () => {
    const pdf = await blankPdf();
    await expect(addWatermark(pdf, "مسودة")).resolves.toBeInstanceOf(Uint8Array);
  });

  it("does not throw for Rupee-sign watermark ₹", async () => {
    const pdf = await blankPdf();
    await expect(addWatermark(pdf, "₹ PAID")).resolves.toBeInstanceOf(Uint8Array);
  });

  it("still throws on empty watermark text", async () => {
    const pdf = await blankPdf();
    await expect(addWatermark(pdf, "   ")).rejects.toThrow(/empty/i);
  });
});

describe("addPageNumbers", () => {
  it("adds page numbers without throwing", async () => {
    const pdf = await blankPdf(3);
    const result = await addPageNumbers(pdf);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("parsePageRange", () => {
  it("parses single page", () => {
    expect(parsePageRange("1", 5)).toEqual([0]);
  });

  it("parses range", () => {
    expect(parsePageRange("2-4", 5)).toEqual([1, 2, 3]);
  });

  it("parses mixed tokens", () => {
    expect(parsePageRange("1,3-4", 5)).toEqual([0, 2, 3]);
  });

  it("throws on non-numeric token", () => {
    expect(() => parsePageRange("abc", 5)).toThrow();
  });
});
