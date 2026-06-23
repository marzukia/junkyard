import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/** Parse a compact page range string like "1,3-5,7" into 0-based indices. */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  const indices: number[] = [];
  const parts = rangeStr.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const rangeParts = trimmed.split("-");
    if (rangeParts.length === 2) {
      const start = Number.parseInt(rangeParts[0]!, 10);
      const end = Number.parseInt(rangeParts[1]!, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= totalPages) indices.push(i - 1);
      }
    } else {
      const page = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(page) && page >= 1 && page <= totalPages) {
        indices.push(page - 1);
      }
    }
  }
  return [...new Set(indices)];
}

/** Merge multiple PDF Uint8Arrays into one, reporting progress per document. */
export async function mergePdfs(
  pdfBytes: Uint8Array[],
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (let i = 0; i < pdfBytes.length; i++) {
    const bytes = pdfBytes[i]!;
    const doc = await PDFDocument.load(bytes);
    const pageIndices = doc.getPageIndices();
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
  const src = await PDFDocument.load(pdfBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  for (const page of copied) {
    out.addPage(page);
  }
  return out.save();
}

/** Split a PDF into individual single-page PDFs. Returns one Uint8Array per page. */
export async function splitPdf(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(pdfBytes);
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
  const src = await PDFDocument.load(pdfBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, newOrder);
  for (const page of copied) {
    out.addPage(page);
  }
  return out.save();
}

/**
 * Lightweight compress: re-save removing unused objects.
 * pdf-lib doesn't have zlib recompression, but objectsPerTick
 * and a fresh save does strip unused cross-references.
 */
export async function compressPdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
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

/** Trigger a file download in the browser. */
export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Format bytes as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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
  const doc = await PDFDocument.load(pdfBytes);
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

/** Add page numbers to every page of a PDF. */
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
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width } = page.getSize();
    const num = startAt + i;
    const label = format === "n/N" ? `${num} / ${startAt + total - 1}` : String(num);
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

/** Add a text watermark diagonally to every page. */
export async function addWatermark(
  pdfBytes: Uint8Array,
  text: string,
  opts: { opacity?: number; fontSize?: number; color?: [number, number, number] } = {}
): Promise<Uint8Array> {
  const { opacity = 0.15, fontSize = 48, color = [0.5, 0.5, 0.5] } = opts;
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
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
