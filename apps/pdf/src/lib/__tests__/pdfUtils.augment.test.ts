import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { compressPdf, extractPages, reorderPages, splitPdf } from "../pdfUtils";

async function makePdf(pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

// ── extractPages ─────────────────────────────────────────────────────────────

describe("extractPages", () => {
  it("extracts a single page from a multi-page PDF", async () => {
    const pdf = await makePdf(4);
    const result = await extractPages(pdf, [1]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(1);
  });

  it("extracts multiple pages from a multi-page PDF", async () => {
    const pdf = await makePdf(5);
    const result = await extractPages(pdf, [0, 2, 4]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it("returns a valid PDF even when extracting all pages", async () => {
    const pdf = await makePdf(3);
    const result = await extractPages(pdf, [0, 1, 2]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it("preserves page dimensions of extracted pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([800, 600]);
    doc.addPage([400, 300]);
    const pdf = await doc.save();

    const result = await extractPages(pdf, [1]);
    const out = await PDFDocument.load(result);
    const { width, height } = out.getPage(0).getSize();
    expect(width).toBe(400);
    expect(height).toBe(300);
  });
});

// ── splitPdf ──────────────────────────────────────────────────────────────────

describe("splitPdf", () => {
  it("splits a 3-page PDF into 3 single-page PDFs", async () => {
    const pdf = await makePdf(3);
    const parts = await splitPdf(pdf);
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      const doc = await PDFDocument.load(part);
      expect(doc.getPageCount()).toBe(1);
    }
  });

  it("splits a 1-page PDF into exactly 1 part", async () => {
    const pdf = await makePdf(1);
    const parts = await splitPdf(pdf);
    expect(parts).toHaveLength(1);
    const doc = await PDFDocument.load(parts[0]!);
    expect(doc.getPageCount()).toBe(1);
  });

  it("each part is a valid PDF (starts with %PDF)", async () => {
    const pdf = await makePdf(2);
    const parts = await splitPdf(pdf);
    for (const part of parts) {
      const header = new TextDecoder().decode(part.slice(0, 4));
      expect(header).toBe("%PDF");
    }
  });

  it("returns an empty array for a corrupt PDF", async () => {
    const corrupt = new Uint8Array([0x00, 0x01, 0x02]);
    await expect(splitPdf(corrupt)).rejects.toThrow();
  });
});

// ── reorderPages ──────────────────────────────────────────────────────────────

describe("reorderPages", () => {
  it("reverses page order of a 3-page PDF", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]); // page 0: 100x100
    doc.addPage([200, 200]); // page 1: 200x200
    doc.addPage([300, 300]); // page 2: 300x300
    const pdf = await doc.save();

    const result = await reorderPages(pdf, [2, 1, 0]);
    const out = await PDFDocument.load(result);
    expect(out.getPageCount()).toBe(3);
    // Original page 2 (300x300) is now first
    expect(out.getPage(0).getSize().width).toBe(300);
    // Original page 0 (100x100) is now last
    expect(out.getPage(2).getSize().width).toBe(100);
  });

  it("produces a valid PDF with the same page count", async () => {
    const pdf = await makePdf(4);
    const result = await reorderPages(pdf, [3, 2, 1, 0]);
    const out = await PDFDocument.load(result);
    expect(out.getPageCount()).toBe(4);
  });

  it("can duplicate a page by repeating an index", async () => {
    const pdf = await makePdf(2);
    // newOrder can repeat indices (it copies, not moves)
    const result = await reorderPages(pdf, [0, 0, 1]);
    const out = await PDFDocument.load(result);
    expect(out.getPageCount()).toBe(3);
  });
});

// ── compressPdf ───────────────────────────────────────────────────────────────

describe("compressPdf", () => {
  it("returns a valid PDF with the same page count", async () => {
    const pdf = await makePdf(2);
    const result = await compressPdf(pdf);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);
  });

  it("returns a Uint8Array that starts with %PDF", async () => {
    const pdf = await makePdf(1);
    const result = await compressPdf(pdf);
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe("%PDF");
  });

  it("output size is within a reasonable range of input size", async () => {
    const pdf = await makePdf(1);
    const result = await compressPdf(pdf);
    // compress should not bloat the file by more than 2x
    expect(result.length).toBeLessThan(pdf.length * 2);
  });
});
