/**
 * Augmented tests for sign/signPdf.ts.
 * Covers: embedSignatureInPdf with text annotations, hexToRgb edge cases,
 * and embedSignatureOnPages with annotations -- pathways not touched by the
 * existing signPdf.test.ts.
 */
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { embedSignatureInPdf, embedSignatureOnPages, hexToRgb } from "./signPdf";
import type { SignaturePlacement, TextAnnotation } from "./signPdf";

const PNG_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function make1PagePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]);
  return (await doc.save()).buffer.slice(0) as ArrayBuffer;
}

const BASE_PLACEMENT: SignaturePlacement = {
  dataUrl: PNG_URL,
  pageIndex: 0,
  xFrac: 0.1,
  yFrac: 0.1,
  wFrac: 0.2,
  hFrac: 0.1,
  canvasWidth: 400,
  canvasHeight: 600,
};

const BASE_ANNOTATION: TextAnnotation = {
  text: "Signed 23 Jun 2026",
  xFrac: 0.1,
  yFrac: 0.25,
  canvasWidth: 400,
  canvasHeight: 600,
  fontSize: 11,
  color: "#1a2530",
};

// ── hexToRgb edge cases ───────────────────────────────────────────────────────

describe("hexToRgb - edge cases", () => {
  it("falls back to black for a 4-char hex (too short)", () => {
    const result = hexToRgb("#abc");
    // 3-char clean portion length !== 6 -> fallback
    expect(result.red).toBe(0);
    expect(result.green).toBe(0);
    expect(result.blue).toBe(0);
  });

  it("handles uppercase hex correctly", () => {
    const result = hexToRgb("#FF0000");
    expect(result.red).toBeCloseTo(1);
    expect(result.green).toBe(0);
    expect(result.blue).toBe(0);
  });

  it("handles mid-range values", () => {
    // #808080 = 128/255 ~ 0.502 each channel
    const result = hexToRgb("#808080");
    expect(result.red).toBeCloseTo(128 / 255, 3);
    expect(result.green).toBeCloseTo(128 / 255, 3);
    expect(result.blue).toBeCloseTo(128 / 255, 3);
  });

  it("returns 0 for empty string", () => {
    const result = hexToRgb("");
    expect(result.red).toBe(0);
    expect(result.green).toBe(0);
    expect(result.blue).toBe(0);
  });
});

// ── embedSignatureInPdf with text annotations ─────────────────────────────────

describe("embedSignatureInPdf - with text annotations", () => {
  it("returns a valid PDF (larger than original) when annotations are provided", async () => {
    const bytes = await make1PagePdf();
    const originalSize = bytes.byteLength;

    const result = await embedSignatureInPdf(bytes, BASE_PLACEMENT, [BASE_ANNOTATION]);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(originalSize);
  });

  it("accepts multiple text annotations without throwing", async () => {
    const bytes = await make1PagePdf();

    const annotations: TextAnnotation[] = [
      { ...BASE_ANNOTATION, text: "Line 1" },
      { ...BASE_ANNOTATION, text: "Line 2", yFrac: 0.35 },
      { ...BASE_ANNOTATION, text: "Line 3", yFrac: 0.45, color: "#d9594c" },
    ];

    await expect(embedSignatureInPdf(bytes, BASE_PLACEMENT, annotations)).resolves.toBeInstanceOf(
      Uint8Array
    );
  });

  it("annotation with no color option uses default ink (does not throw)", async () => {
    const bytes = await make1PagePdf();
    const ann: TextAnnotation = {
      text: "No colour annotation",
      xFrac: 0.1,
      yFrac: 0.3,
      canvasWidth: 400,
      canvasHeight: 600,
    };

    await expect(embedSignatureInPdf(bytes, BASE_PLACEMENT, [ann])).resolves.toBeInstanceOf(
      Uint8Array
    );
  });

  it("passing empty annotations array behaves identically to passing undefined", async () => {
    const bytes = await make1PagePdf();
    const withEmpty = await embedSignatureInPdf(bytes, BASE_PLACEMENT, []);
    const withUndefined = await embedSignatureInPdf(bytes, BASE_PLACEMENT, undefined);
    // Both should be valid PDFs with same page count
    const docA = await PDFDocument.load(withEmpty);
    const docB = await PDFDocument.load(withUndefined);
    expect(docA.getPageCount()).toBe(docB.getPageCount());
  });
});

// ── embedSignatureOnPages with annotations ────────────────────────────────────

describe("embedSignatureOnPages - with text annotations", () => {
  it("applies annotations to each requested page", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    doc.addPage([400, 600]);
    const bytes = (await doc.save()).buffer.slice(0) as ArrayBuffer;

    const result = await embedSignatureOnPages(bytes, BASE_PLACEMENT, [0, 1], [BASE_ANNOTATION]);

    expect(result).toBeInstanceOf(Uint8Array);
    const out = await PDFDocument.load(result);
    expect(out.getPageCount()).toBe(2);
  });

  it("falls back to single-page embed when pageIndices is empty with annotation", async () => {
    const bytes = await make1PagePdf();
    const result = await embedSignatureOnPages(bytes, BASE_PLACEMENT, [], [BASE_ANNOTATION]);
    expect(result).toBeInstanceOf(Uint8Array);
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe("%PDF");
  });
});
