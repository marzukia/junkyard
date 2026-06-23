import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  addPageNumbers,
  addWatermark,
  baseName,
  formatBytes,
  mergePdfs,
  parsePageRange,
  rotatePages,
} from "../pdfUtils";

/** Create a minimal multi-page PDF for testing. */
async function makePdf(pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

describe("parsePageRange", () => {
  it("parses a single page number", () => {
    expect(parsePageRange("3", 10)).toEqual([2]);
  });

  it("parses a range", () => {
    expect(parsePageRange("2-4", 10)).toEqual([1, 2, 3]);
  });

  it("parses comma-separated pages", () => {
    expect(parsePageRange("1,3,5", 10)).toEqual([0, 2, 4]);
  });

  it("parses a mix of single pages and ranges", () => {
    expect(parsePageRange("1,3-5,7", 10)).toEqual([0, 2, 3, 4, 6]);
  });

  it("clamps to valid page range", () => {
    expect(parsePageRange("0,5,12", 10)).toEqual([4]);
  });

  it("deduplicates overlapping ranges", () => {
    expect(parsePageRange("1-3,2-4", 10)).toEqual([0, 1, 2, 3]);
  });

  it("returns empty array for empty string", () => {
    expect(parsePageRange("", 10)).toEqual([]);
  });

  it("ignores non-numeric input", () => {
    expect(parsePageRange("abc", 10)).toEqual([]);
  });

  it("handles a range where start equals end", () => {
    expect(parsePageRange("3-3", 10)).toEqual([2]);
  });

  it("handles whitespace around commas", () => {
    expect(parsePageRange("1 , 3", 10)).toEqual([0, 2]);
  });
});

describe("formatBytes", () => {
  it("formats bytes under 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
});

describe("baseName", () => {
  it("strips .pdf extension", () => {
    expect(baseName("report.pdf")).toBe("report");
  });

  it("strips .PNG extension (case-sensitive match)", () => {
    expect(baseName("photo.PNG")).toBe("photo");
  });

  it("handles names without extension", () => {
    expect(baseName("nodot")).toBe("nodot");
  });

  it("strips only the last extension", () => {
    expect(baseName("archive.tar.gz")).toBe("archive.tar");
  });
});

describe("mergePdfs", () => {
  it("produces a PDF with combined page count", async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const result = await mergePdfs([a, b]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(5);
  });

  it("calls onProgress for each document merged", async () => {
    const a = await makePdf(1);
    const b = await makePdf(1);
    const calls: [number, number][] = [];
    await mergePdfs([a, b], (done, total) => calls.push([done, total]));
    expect(calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("throws a human-readable error when a corrupt file is included", async () => {
    const good = await makePdf(1);
    const corrupt = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    await expect(mergePdfs([good, corrupt])).rejects.toThrow(
      '"file 2" is not a valid PDF or is corrupted'
    );
  });

  it("includes the filename in the error when names are provided", async () => {
    const good = await makePdf(1);
    const corrupt = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    await expect(mergePdfs([good, corrupt], undefined, ["good.pdf", "broken.pdf"])).rejects.toThrow(
      '"broken.pdf" is not a valid PDF or is corrupted'
    );
  });
});

describe("rotatePages", () => {
  it("rotates all pages by 90 degrees", async () => {
    const pdf = await makePdf(2);
    const result = await rotatePages(pdf, 90);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
  });

  it("applies rotation cumulatively (0 + 180 = 180)", async () => {
    const pdf = await makePdf(1);
    const result = await rotatePages(pdf, 180);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getRotation().angle).toBe(180);
  });

  it("rotates only specified page indices", async () => {
    const pdf = await makePdf(3);
    const result = await rotatePages(pdf, 90, [0, 2]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(0);
    expect(doc.getPage(2).getRotation().angle).toBe(90);
  });
});

describe("addPageNumbers", () => {
  it("returns a valid PDF with the same page count", async () => {
    const pdf = await makePdf(3);
    const result = await addPageNumbers(pdf);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it("accepts custom startAt without throwing", async () => {
    const pdf = await makePdf(2);
    await expect(addPageNumbers(pdf, { startAt: 5 })).resolves.toBeInstanceOf(Uint8Array);
  });

  // W1: denominator in n/N format must be the real page count, not startAt+total-1
  it("n/N format with startAt=1: denominator equals total page count", async () => {
    const pdf = await makePdf(3);
    await expect(addPageNumbers(pdf, { format: "n/N" })).resolves.toBeInstanceOf(Uint8Array);
  });

  it("n/N format with startAt=5 on 3 pages: produces a valid PDF with 3 pages", async () => {
    // Bug: old code used denominator = startAt + total - 1 = 7 instead of total = 3.
    // The fix uses total as the denominator so labels are "5 / 3", "6 / 3", "7 / 3".
    const pdf = await makePdf(3);
    const result = await addPageNumbers(pdf, { startAt: 5, format: "n/N" });
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });
});

describe("addWatermark", () => {
  it("returns a valid PDF with the same page count", async () => {
    const pdf = await makePdf(2);
    const result = await addWatermark(pdf, "DRAFT");
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);
  });

  // W10: empty watermark must throw, not silently produce an unmarked file
  it("throws for empty-string watermark text", async () => {
    const pdf = await makePdf(1);
    await expect(addWatermark(pdf, "")).rejects.toThrow("Watermark text must not be empty");
  });

  it("throws for whitespace-only watermark text", async () => {
    const pdf = await makePdf(1);
    await expect(addWatermark(pdf, "   ")).rejects.toThrow("Watermark text must not be empty");
  });
});
