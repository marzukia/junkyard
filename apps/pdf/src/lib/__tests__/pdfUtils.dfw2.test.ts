/**
 * Regression tests for dogfood wave 2 bugs.
 *
 * Bug 1: truncated-but-header-valid PDFs must produce a friendly error, not raw
 *   pdf-lib internal messages like "i.catalog.Pages(...).traverse is not a function".
 *
 * Bug 2: splitPdfToZip must produce a single ZIP blob containing N entries
 *   rather than N individual a.click() downloads (which Chromium throttles).
 */
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addPageNumbers, addWatermark, rotatePages, splitPdf, splitPdfToZip } from "../pdfUtils";

async function makePdf(pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

/** Build a byte sequence that starts with a valid PDF header (%PDF-1.4) but is
 *  truncated before the xref/page-tree, so PDFDocument.load() may partially
 *  succeed while getPageIndices() / page traversal then throws an internal error. */
function makeTruncatedPdf(): Uint8Array {
  // A valid PDF header followed by garbage — mimics the "header+xref parse OK
  // but page tree unreadable" class of corruption the bug report describes.
  const header = "%PDF-1.4\n%truncated";
  return new TextEncoder().encode(header);
}

// ─── Bug 1: friendly error on corrupted PDFs ─────────────────────────────────

describe("Bug 1 — corrupted PDF produces friendly errors (dfw2)", () => {
  it("splitPdf rejects with a friendly message for truncated input", async () => {
    const truncated = makeTruncatedPdf();
    await expect(splitPdf(truncated)).rejects.toThrow(
      /corrupted|incomplete|cannot be loaded|not a valid/i
    );
  });

  it("splitPdf friendly message does not contain raw pdf-lib internals", async () => {
    const truncated = makeTruncatedPdf();
    await expect(splitPdf(truncated)).rejects.not.toThrow(/traverse|catalog|getPageIndices/i);
  });

  it("rotatePages rejects with a friendly message for truncated input", async () => {
    const truncated = makeTruncatedPdf();
    await expect(rotatePages(truncated, 90)).rejects.toThrow(
      /corrupted|incomplete|cannot be loaded|not a valid/i
    );
  });

  it("addPageNumbers rejects with a friendly message for truncated input", async () => {
    const truncated = makeTruncatedPdf();
    await expect(addPageNumbers(truncated)).rejects.toThrow(
      /corrupted|incomplete|cannot be loaded|not a valid/i
    );
  });

  it("addWatermark rejects with a friendly message for truncated input", async () => {
    const truncated = makeTruncatedPdf();
    await expect(addWatermark(truncated, "DRAFT")).rejects.toThrow(
      /corrupted|incomplete|cannot be loaded|not a valid/i
    );
  });
});

// ─── Bug 2: multi-output tools produce a single ZIP ──────────────────────────

describe("Bug 2 — splitPdfToZip produces a single ZIP with N entries (dfw2)", () => {
  it("3-page PDF produces a ZIP containing 3 entries", async () => {
    const pdf = await makePdf(3);
    const zipBytes = await splitPdfToZip(pdf, "test");

    // Verify it is a ZIP: PK magic header
    expect(zipBytes[0]).toBe(0x50); // P
    expect(zipBytes[1]).toBe(0x4b); // K

    // Count local-file-header signatures (0x50 0x4b 0x03 0x04) to count entries.
    let count = 0;
    for (let i = 0; i < zipBytes.length - 3; i++) {
      if (
        zipBytes[i] === 0x50 &&
        zipBytes[i + 1] === 0x4b &&
        zipBytes[i + 2] === 0x03 &&
        zipBytes[i + 3] === 0x04
      ) {
        count++;
      }
    }
    expect(count).toBe(3);
  });

  it("each entry in the ZIP is a valid single-page PDF", async () => {
    const pdf = await makePdf(2);
    const zipBytes = await splitPdfToZip(pdf, "doc");

    // Use fflate to unzip and verify each entry
    const { unzipSync } = await import("fflate");
    const entries = unzipSync(zipBytes);
    const keys = Object.keys(entries);
    expect(keys).toHaveLength(2);

    for (const key of keys) {
      const pageDoc = await PDFDocument.load(entries[key]!);
      expect(pageDoc.getPageCount()).toBe(1);
    }
  });

  it("ZIP entry names follow the <name>-page<N>.pdf pattern", async () => {
    const pdf = await makePdf(2);
    const zipBytes = await splitPdfToZip(pdf, "report");
    const { unzipSync } = await import("fflate");
    const entries = unzipSync(zipBytes);
    const keys = Object.keys(entries).sort();
    expect(keys).toContain("report-page1.pdf");
    expect(keys).toContain("report-page2.pdf");
  });
});
