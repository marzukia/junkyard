/**
 * Searchable PDF assembly utilities.
 *
 * Separated from ocrUtils.ts because pdf-lib is a heavier dependency that
 * should only load when the user requests a PDF export. Pure functions here
 * are tested independently; the async buildSearchablePdf function is the
 * production entry point wired from App.tsx.
 *
 * Future item: DOCX export (a parallel module, same pattern).
 */

import { PDFDocument, rgb } from "pdf-lib";

/** Tesseract word bounding box in image pixels (top-left origin). */
export interface OcrBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Tesseract word with bbox and text. */
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: OcrBbox;
}

/** Natural pixel dimensions of the source image. */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Scale an OCR bbox from image pixel coordinates to PDF point coordinates.
 *
 * PDF points have origin at the BOTTOM-LEFT of the page, so we flip the
 * y-axis: pdf_y = pageHeight - image_y_bottom.
 *
 * @param bbox    Tesseract bbox in image pixels
 * @param img     Natural width/height of the source image
 * @param page    Width/height of the PDF page in points (usually same as img)
 * @returns       {x, y, w, h} in PDF points, y measured from bottom of page
 */
export function scaleBboxToPdfCoords(
  bbox: OcrBbox,
  img: ImageDimensions,
  page: { width: number; height: number }
): { x: number; y: number; w: number; h: number } {
  const scaleX = page.width / img.width;
  const scaleY = page.height / img.height;

  const x = bbox.x0 * scaleX;
  const wordH = (bbox.y1 - bbox.y0) * scaleY;
  // PDF y-origin is bottom-left; image y-origin is top-left.
  const y = page.height - bbox.y1 * scaleY;
  const w = (bbox.x1 - bbox.x0) * scaleX;

  return { x, y, w, h: wordH };
}

/**
 * Read an HTMLImageElement's natural dimensions.
 * Loads the src if the image is not already decoded.
 */
async function getImageDimensions(imageUrl: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = imageUrl;
  });
}

/**
 * Fetch image bytes for embedding into PDF.
 * Accepts an object URL or a data URL.
 */
async function fetchImageBytes(imageUrl: string): Promise<Uint8Array> {
  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const resp = await fetch(imageUrl);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Build a single-page searchable PDF from an image and its OCR data.
 *
 * The image is drawn as the full-page background. OCR words are drawn as
 * invisible text (opacity 0) positioned at their bbox coordinates so the
 * text is selectable/searchable without obscuring the image.
 *
 * If no word-level data is available (words is empty or undefined), falls back
 * to a single full-page invisible text block from the plain-text result.
 *
 * @param imageUrl  Object URL or data URL of the source image
 * @param words     Tesseract word-level data (may be empty for fallback)
 * @param fallbackText  Full OCR text used when words is empty
 * @param mimeType  Image MIME type (image/png or image/jpeg)
 * @returns         PDF bytes as Uint8Array
 */
export async function buildSearchablePdf(
  imageUrl: string,
  words: OcrWord[],
  fallbackText: string,
  mimeType: "image/png" | "image/jpeg" = "image/png"
): Promise<Uint8Array<ArrayBuffer>> {
  const dims = await getImageDimensions(imageUrl);
  const imageBytes = await fetchImageBytes(imageUrl);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([dims.width, dims.height]);
  const pageSize = { width: dims.width, height: dims.height };

  // Embed and draw the image as the full-page background.
  const embeddedImage =
    mimeType === "image/jpeg"
      ? await pdfDoc.embedJpg(imageBytes)
      : await pdfDoc.embedPng(imageBytes);

  page.drawImage(embeddedImage, { x: 0, y: 0, width: dims.width, height: dims.height });

  // Draw invisible text layer.
  if (words.length > 0) {
    // Per-word positioned text: best selectability and search accuracy.
    for (const word of words) {
      if (!word.text.trim()) continue;
      const coords = scaleBboxToPdfCoords(word.bbox, dims, pageSize);
      const fontSize = Math.max(coords.h, 1);
      page.drawText(word.text, {
        x: coords.x,
        y: coords.y,
        size: fontSize,
        color: rgb(0, 0, 0),
        opacity: 0,
      });
    }
  } else {
    // Fallback: single invisible block at the top of the page.
    page.drawText(fallbackText || " ", {
      x: 0,
      y: dims.height - 12,
      size: 12,
      color: rgb(0, 0, 0),
      opacity: 0,
    });
  }

  const raw = await pdfDoc.save();
  // Copy into a plain ArrayBuffer so callers can safely pass to Blob constructor
  // (pdf-lib's Uint8Array may have an ArrayBufferLike buffer, not ArrayBuffer).
  return new Uint8Array(raw) as Uint8Array<ArrayBuffer>;
}

/**
 * Build a multi-page searchable PDF from an array of images + their OCR data.
 * One page per image.
 */
export async function buildMultiPageSearchablePdf(
  pages: Array<{
    imageUrl: string;
    words: OcrWord[];
    fallbackText: string;
    mimeType?: "image/png" | "image/jpeg";
  }>
): Promise<Uint8Array<ArrayBuffer>> {
  const pdfDoc = await PDFDocument.create();

  for (const pg of pages) {
    const dims = await getImageDimensions(pg.imageUrl);
    const imageBytes = await fetchImageBytes(pg.imageUrl);
    const mimeType = pg.mimeType ?? "image/png";

    const page = pdfDoc.addPage([dims.width, dims.height]);
    const pageSize = { width: dims.width, height: dims.height };

    const embeddedImage =
      mimeType === "image/jpeg"
        ? await pdfDoc.embedJpg(imageBytes)
        : await pdfDoc.embedPng(imageBytes);

    page.drawImage(embeddedImage, { x: 0, y: 0, width: dims.width, height: dims.height });

    if (pg.words.length > 0) {
      for (const word of pg.words) {
        if (!word.text.trim()) continue;
        const coords = scaleBboxToPdfCoords(word.bbox, dims, pageSize);
        const fontSize = Math.max(coords.h, 1);
        page.drawText(word.text, {
          x: coords.x,
          y: coords.y,
          size: fontSize,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      }
    } else {
      page.drawText(pg.fallbackText || " ", {
        x: 0,
        y: dims.height - 12,
        size: 12,
        color: rgb(0, 0, 0),
        opacity: 0,
      });
    }
  }

  const raw = await pdfDoc.save();
  return new Uint8Array(raw) as Uint8Array<ArrayBuffer>;
}
