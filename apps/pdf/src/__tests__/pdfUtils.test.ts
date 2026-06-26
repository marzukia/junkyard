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

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addPageNumbers, addWatermark, parsePageRange } from "../lib/pdfUtils";
import { sanitizeWinAnsi } from "../lib/unicodeFont";

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

describe("sanitizeWinAnsi – C1 control gap fix (gauntlet w3)", () => {
  // C1 controls U+0080-009F include 5 undefined WinAnsi positions (0x81,0x8D,0x8F,0x90,0x9D).
  // The old regex /[^\x20-\xff]/ passed them through; pdf-lib crashes on widthOfTextAtSize.
  // The new regex /[^\x20-\x7e\xa0-\xff]/ strips them to "?".
  it("maps C1 control characters to '?'", () => {
    // U+0081, U+008D, U+008F, U+0090, U+009D -- all undefined in WinAnsi
    expect(sanitizeWinAnsi("")).toBe("?");
    expect(sanitizeWinAnsi("")).toBe("?");
    expect(sanitizeWinAnsi("")).toBe("?");
    expect(sanitizeWinAnsi("")).toBe("?");
    expect(sanitizeWinAnsi("")).toBe("?");
  });

  it("also strips other C0/non-ASCII control characters", () => {
    // DEL (0x7f) and NUL (0x00) are outside the safe range
    expect(sanitizeWinAnsi("\x00")).toBe("?");
    expect(sanitizeWinAnsi("\x7f")).toBe("?");
  });

  it("preserves printable ASCII (0x20..0x7e)", () => {
    const ascii =
      " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
    expect(sanitizeWinAnsi(ascii)).toBe(ascii);
  });

  it("preserves Latin-1 supplement (0xA0..0xFF)", () => {
    // These are valid WinAnsi positions
    expect(sanitizeWinAnsi("\xa0")).toBe("\xa0"); // NBSP
    expect(sanitizeWinAnsi("\xe9")).toBe("\xe9"); // e-acute
    expect(sanitizeWinAnsi("\xff")).toBe("\xff"); // y-diaeresis
  });

  it("pdf-lib StandardFont widthOfTextAtSize does not throw on sanitized C1 input", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    // The 5 undefined WinAnsi chars that crashed pdf-lib before this fix
    const dangerous = "";
    const safe = sanitizeWinAnsi(dangerous);
    expect(() => font.widthOfTextAtSize(safe, 12)).not.toThrow();
    expect(safe).toBe("?????");
  });
});
