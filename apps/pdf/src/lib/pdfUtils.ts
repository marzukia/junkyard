import { sanitizeWinAnsi } from "@junkyardsh/ui/pdf";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Guard: load a PDF and verify its page tree is traversable.
 *
 * PDFDocument.load() can succeed on a truncated-but-header-valid PDF because
 * the xref table is parseable; a later page traversal then throws an internal
 * error like "i.catalog.Pages(...).traverse is not a function".  This helper
 * does the full round-trip (load + getPageIndices) inside a single try/catch
 * and maps any failure to a human-readable message so no pdf-lib internals
 * leak to the UI.
 *
 * Use this instead of a bare PDFDocument.load() call in any op that will
 * subsequently access pages.
 */
async function assertReadable(bytes: Uint8Array, label?: string): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    const who = label ? `"${label}"` : "The PDF";
    throw new Error(`${who} appears to be corrupted or incomplete and could not be loaded.`);
  }
  try {
    doc.getPageIndices();
  } catch {
    const who = label ? `"${label}"` : "The PDF";
    throw new Error(
      `${who} appears to be corrupted or incomplete. It loaded but its page tree is unreadable.`
    );
  }
  return doc;
}

/** Parse a compact page range string like "1,3-5,7" into 0-based indices.
 * Throws if any token is not a valid page number or range (e.g. "abc", "x-y").
 * Use this when the caller should surface parse errors to the user.
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  const indices: number[] = [];
  const invalid: string[] = [];
  const parts = rangeStr.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const rangeParts = trimmed.split("-");
    if (rangeParts.length === 2) {
      const start = Number.parseInt(rangeParts[0]!, 10);
      const end = Number.parseInt(rangeParts[1]!, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) {
        invalid.push(trimmed);
        continue;
      }
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= totalPages) indices.push(i - 1);
      }
    } else {
      const page = Number.parseInt(trimmed, 10);
      if (Number.isNaN(page)) {
        invalid.push(trimmed);
      } else if (page >= 1 && page <= totalPages) {
        indices.push(page - 1);
      }
    }
  }
  if (invalid.length > 0) {
    const plural = invalid.length > 1 ? "s" : "";
    const tokens = invalid.map((t) => JSON.stringify(t)).join(", ");
    throw new Error(`Invalid page range token${plural}: ${tokens}`);
  }
  return [...new Set(indices)];
}

/** Merge multiple PDF Uint8Arrays into one, reporting progress per document. */
export async function mergePdfs(
  pdfBytes: Uint8Array[],
  onProgress?: (done: number, total: number) => void,
  names?: string[]
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (let i = 0; i < pdfBytes.length; i++) {
    const bytes = pdfBytes[i]!;
    const label = names?.[i] ?? `file ${i + 1}`;
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(bytes);
    } catch {
      throw new Error(`"${label}" is not a valid PDF or is corrupted and cannot be read.`);
    }
    let pageIndices: number[];
    try {
      pageIndices = doc.getPageIndices();
    } catch {
      throw new Error(
        `"${label}" appears to be corrupted or incomplete. It loaded but its page tree is unreadable.`
      );
    }
    const copied = await merged.copyPages(doc, pageIndices);
    for (const page of copied) {
      merged.addPage(page);
    }
    onProgress?.(i + 1, pdfBytes.length);
  }
  return merged.save();
}

/** Extract a subset of pages (0-based indices) from a PDF. */
export async function extractPages(pdfBytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await assertReadable(pdfBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  for (const page of copied) {
    out.addPage(page);
  }
  return out.save();
}

/** Split a PDF into individual single-page PDFs. Returns one Uint8Array per page. */
export async function splitPdf(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await assertReadable(pdfBytes);
  const total = src.getPageCount();
  const results: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(src, [i]);
    if (copied) single.addPage(copied);
    results.push(await single.save());
  }
  return results;
}

/** Reorder pages of a PDF. newOrder is an array of 0-based old indices. */
export async function reorderPages(pdfBytes: Uint8Array, newOrder: number[]): Promise<Uint8Array> {
  const src = await assertReadable(pdfBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, newOrder);
  for (const page of copied) {
    out.addPage(page);
  }
  return out.save();
}

/**
 * Structural optimise: re-saves the PDF using object streams to reduce cross-reference
 * table overhead and strip unused objects. Does NOT recompress image streams (pdf-lib
 * does not expose zlib-level control). The size reduction is most noticeable on PDFs
 * with many incremental updates or redundant objects; image-heavy files may see little
 * or no change.
 *
 * H1: Encrypted PDFs are explicitly rejected -- callers must surface a warning before
 * proceeding, because re-saving strips the encryption silently.
 */
export async function compressPdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
  // Try to load without bypassing encryption. pdf-lib throws when the PDF is
  // owner/user-password protected. We surface that as a clear caller-visible error
  // rather than silently decrypting with ignoreEncryption:true.
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // pdf-lib surfaces encryption failures with "encrypted" in the message.
    if (msg.toLowerCase().includes("encrypt")) {
      throw new Error(
        "This PDF is encrypted. Optimising it would remove its password protection. " +
          "Decrypt the PDF first, then optimise."
      );
    }
    throw new Error("This PDF appears to be corrupted or incomplete.");
  }
  // Guard: verify page tree is traversable before proceeding.
  try {
    doc.getPageIndices();
  } catch {
    throw new Error(
      "This PDF appears to be corrupted or incomplete. It loaded but its page tree is unreadable."
    );
  }
  return doc.save({ useObjectStreams: true });
}

/** Convert image files (PNG/JPEG) to a multi-page PDF. */
export async function imagesToPdf(imageFiles: File[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const file of imageFiles) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isJpeg =
      file.type === "image/jpeg" ||
      file.name.toLowerCase().endsWith(".jpg") ||
      file.name.toLowerCase().endsWith(".jpeg");
    const img = isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return doc.save();
}

/**
 * Split a PDF into individual single-page PDFs and bundle them into a ZIP.
 *
 * Returns the ZIP as a Uint8Array.  One entry per page, named
 * `<baseName>-page1.pdf`, `<baseName>-page2.pdf`, etc.
 *
 * Uses fflate's zipSync so the bundling is synchronous after the async pdf-lib
 * work.  This avoids Chromium's download throttle (which drops individual
 * a.click() calls beyond ~10) and keeps the whole operation as a single
 * user-visible download.
 */
export async function splitPdfToZip(pdfBytes: Uint8Array, name: string): Promise<Uint8Array> {
  const { zipSync } = await import("fflate");
  const pages = await splitPdf(pdfBytes);
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < pages.length; i++) {
    files[`${name}-page${i + 1}.pdf`] = pages[i]!;
  }
  return zipSync(files);
}

/** Trigger a file download in the browser.
 *
 * The MIME type is inferred from the filename extension:
 *   .zip  → application/zip
 *   other → application/pdf  (legacy default, matches the original behaviour)
 */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const mime = filename.toLowerCase().endsWith(".zip") ? "application/zip" : "application/pdf";
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Format bytes as a human-readable string. */
export { formatBytes } from "@junkyardsh/ui";

/** Strip extension and clean a filename. */
export function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export type RotationAngle = 90 | 180 | 270;

/** Rotate all pages (or a subset) of a PDF by the given angle. */
export async function rotatePages(
  pdfBytes: Uint8Array,
  angle: RotationAngle,
  pageIndices?: number[]
): Promise<Uint8Array> {
  const doc = await assertReadable(pdfBytes);
  const total = doc.getPageCount();
  const targets = pageIndices ?? Array.from({ length: total }, (_, i) => i);
  for (const idx of targets) {
    if (idx < 0 || idx >= total) continue;
    const page = doc.getPage(idx);
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  }
  return doc.save();
}

export type PageNumberPosition = "bottom-center" | "bottom-right" | "bottom-left";

/**
 * Add page numbers to every page of a PDF.
 *
 * startAt: the number printed on the first page (default 1). The denominator in
 * "n/N" format is always the total page COUNT of this document (not startAt+total-1),
 * so a 3-page document starting at 5 renders "5 / 3", "6 / 3", "7 / 3".
 */
export async function addPageNumbers(
  pdfBytes: Uint8Array,
  opts: {
    position?: PageNumberPosition;
    startAt?: number;
    fontSize?: number;
    format?: "n" | "n/N";
  } = {}
): Promise<Uint8Array> {
  const { position = "bottom-center", startAt = 1, fontSize = 10, format = "n" } = opts;
  const doc = await assertReadable(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width } = page.getSize();
    const num = startAt + i;
    // Denominator is always the real page count, not the last displayed number.
    const label = format === "n/N" ? `${num} / ${total}` : String(num);
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const margin = 18;
    let x: number;
    if (position === "bottom-center") x = (width - textWidth) / 2;
    else if (position === "bottom-right") x = width - textWidth - margin;
    else x = margin;
    page.drawText(label, {
      x,
      y: margin,
      size: fontSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  return doc.save();
}

/**
 * Add a text watermark diagonally to every page.
 * Throws if text is empty or whitespace -- a blank watermark produces no visible
 * mark but still modifies the file, which would silently mislead callers.
 */
export async function addWatermark(
  pdfBytes: Uint8Array,
  text: string,
  opts: { opacity?: number; fontSize?: number; color?: [number, number, number] } = {}
): Promise<Uint8Array> {
  if (text.trim() === "") {
    throw new Error("Watermark text must not be empty.");
  }
  const { opacity = 0.15, fontSize = 48, color = [0.5, 0.5, 0.5] } = opts;
  const doc = await assertReadable(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  // Sanitize: StandardFont (Helvetica) is WinAnsi-only; replace non-encodable chars.
  const safeText = sanitizeWinAnsi(text);
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(safeText, fontSize);
    page.drawText(safeText, {
      x: (width - textWidth) / 2,
      y: height / 2 - fontSize / 2,
      size: fontSize,
      font,
      color: rgb(color[0]!, color[1]!, color[2]!),
      opacity,
      rotate: degrees(45),
    });
  }
  return doc.save();
}
