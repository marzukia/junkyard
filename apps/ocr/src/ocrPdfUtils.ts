/**
 * Searchable PDF assembly utilities.
 *
 * Separated from ocrUtils.ts because pdf-lib is a heavier dependency that
 * should only load when the user requests a PDF export. Pure functions here
 * are tested independently; the async buildSearchablePdf function is the
 * production entry point wired from App.tsx.
 *
 * Unicode font strategy
 * ---------------------
 * pdf-lib's StandardFonts are Latin-1 only. For non-Latin OCR output (CJK,
 * Arabic, Devanagari, etc.) we embed a subset of an OFL-licensed Noto font
 * fetched lazily from jsDelivr CDN at export time.
 *
 * Font selection by detected script:
 *   - CJK (Chinese/Japanese/Korean) -> Noto Sans SC (covers CJK Unified + kana)
 *   - Arabic/Persian/Urdu           -> Noto Naskh Arabic
 *   - Everything else incl. Latin   -> Noto Sans (broad Unicode coverage)
 *
 * `embedFont(..., { subset: true })` keeps the output PDF small; only the
 * glyphs actually present in the OCR text are embedded.
 *
 * If the CDN fetch fails the export continues without a custom font and logs a
 * console warning. The invisible text layer may garble non-Latin characters in
 * that degraded case but the PDF is still produced (no crash).
 *
 * Future item: DOCX export (a parallel module, same pattern).
 * Deferred split: font loading lives here alongside the PDF assembly so callers
 * import a single module. If a second export format (DOCX, EPUB) reuses font
 * detection, extract ocrFontUtils.ts at that point.
 */

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// ── Public types ──────────────────────────────────────────────────────────────

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

// ── Script detection & font URL selection ─────────────────────────────────────

/**
 * Unicode script ranges relevant to font selection.
 * Ordered from most specific to broadest; first match wins.
 */
const SCRIPT_RANGES: Array<{ test: (ch: number) => boolean; variant: FontVariant }> = [
  // CJK Unified Ideographs (main block + extensions A-B, CJK Compatibility)
  { test: (cp) => (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df) || (cp >= 0xf900 && cp <= 0xfaff), variant: "cjk" },
  // Hiragana + Katakana
  { test: (cp) => (cp >= 0x3040 && cp <= 0x30ff), variant: "cjk" },
  // Arabic + Arabic Supplement + Presentation Forms
  { test: (cp) => (cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f) || (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff), variant: "arabic" },
];

export type FontVariant = "noto" | "cjk" | "arabic";

/**
 * Detect which font variant is needed for a collection of text strings.
 * Scans codepoints until a non-Latin script is found; short-circuits early.
 * Returns "noto" (base Noto Sans) when all text is Latin/common.
 */
export function detectFontVariant(texts: string[]): FontVariant {
  for (const text of texts) {
    for (const char of text) {
      const cp = char.codePointAt(0) ?? 0;
      for (const { test, variant } of SCRIPT_RANGES) {
        if (test(cp)) return variant;
      }
    }
  }
  return "noto";
}

// jsDelivr URLs for OFL-licensed Noto fonts (TTF, ~1-3 MB each).
// We use @fontsource packages which mirror Google Fonts and are stable on jsDelivr.
// Full CJK fonts are ~10-16 MB; fontsource ships subsets by unicode-range -- we
// use the "all" variant to get full coverage since we need to subset at embed time.
// NOTE: The "noto" URL below is the same Noto Sans latin-ext URL used by
// kit/lib/unicodeFont.ts (vendored to invoice/pdf/resume/sign).  If this URL
// ever changes, update kit/lib/unicodeFont.ts and re-run vendor-unicodefont.mjs.
const FONT_CDN_URLS: Record<FontVariant, string> = {
  noto: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5/files/noto-sans-latin-ext-400-normal.woff2",
  cjk: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5/files/noto-sans-sc-chinese-simplified-400-normal.woff2",
  arabic: "https://cdn.jsdelivr.net/npm/@fontsource/noto-naskh-arabic@5/files/noto-naskh-arabic-arabic-400-normal.woff2",
};

/**
 * Lazily fetch font bytes from CDN.
 * Returns null on any network failure (caller degrades gracefully).
 */
const FETCH_TIMEOUT_MS = 30_000;

async function fetchFontBytes(variant: FontVariant): Promise<Uint8Array | null> {
  const url = FONT_CDN_URLS[variant];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      console.warn(`[ocr-pdf] Font fetch failed (${resp.status}): ${url}`);
      return null;
    }
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err) {
    console.warn("[ocr-pdf] Font fetch error:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(imageUrl, { signal: controller.signal });
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    clearTimeout(timer);
  }
}

// ── Text-draw helper (font-aware) ─────────────────────────────────────────────

interface DrawTextOptions {
  text: string;
  x: number;
  y: number;
  size: number;
  embeddedFont?: Awaited<ReturnType<PDFDocument["embedFont"]>> | null;
}

/**
 * Draw invisible text onto a PDF page using the embedded Unicode font when
 * available, falling back to pdf-lib's default (Helvetica / Latin-1).
 */
function drawInvisibleText(
  page: ReturnType<PDFDocument["addPage"]>,
  opts: DrawTextOptions
): void {
  const shared = { x: opts.x, y: opts.y, size: opts.size, color: rgb(0, 0, 0), opacity: 0 };
  if (opts.embeddedFont) {
    page.drawText(opts.text, { ...shared, font: opts.embeddedFont });
  } else {
    page.drawText(opts.text, shared);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a single-page searchable PDF from an image and its OCR data.
 *
 * The image is drawn as the full-page background. OCR words are drawn as
 * invisible text (opacity 0) positioned at their bbox coordinates so the
 * text is selectable/searchable without obscuring the image.
 *
 * A Unicode font (Noto, subset) is loaded lazily from CDN to support non-Latin
 * scripts (CJK, Arabic, etc.). If the CDN fetch fails the PDF is still produced
 * using the built-in Latin-1 font with a console warning.
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
  pdfDoc.registerFontkit(fontkit);

  // Detect script and load font (lazy, one fetch per export call).
  const allTexts = words.length > 0 ? words.map((w) => w.text) : [fallbackText];
  const variant = detectFontVariant(allTexts);
  const fontBytes = await fetchFontBytes(variant);
  const embeddedFont = fontBytes
    ? await pdfDoc.embedFont(fontBytes, { subset: true }).catch((err) => {
        console.warn("[ocr-pdf] Font embed failed, falling back:", err);
        return null;
      })
    : null;

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
      drawInvisibleText(page, { text: word.text, x: coords.x, y: coords.y, size: fontSize, embeddedFont });
    }
  } else {
    // Fallback: single invisible block at the top of the page.
    drawInvisibleText(page, { text: fallbackText || " ", x: 0, y: dims.height - 12, size: 12, embeddedFont });
  }

  const raw = await pdfDoc.save();
  // Copy into a plain ArrayBuffer so callers can safely pass to Blob constructor
  // (pdf-lib's Uint8Array may have an ArrayBufferLike buffer, not ArrayBuffer).
  return new Uint8Array(raw) as Uint8Array<ArrayBuffer>;
}

/**
 * Build a multi-page searchable PDF from an array of images + their OCR data.
 * One page per image.
 *
 * Font loading happens once per call: the script is detected across all pages
 * so a single Noto variant covers the whole document.
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
  pdfDoc.registerFontkit(fontkit);

  // Detect script across all pages, load font once.
  const allTexts = pages.flatMap((pg) =>
    pg.words.length > 0 ? pg.words.map((w) => w.text) : [pg.fallbackText]
  );
  const variant = detectFontVariant(allTexts);
  const fontBytes = await fetchFontBytes(variant);
  const embeddedFont = fontBytes
    ? await pdfDoc.embedFont(fontBytes, { subset: true }).catch((err) => {
        console.warn("[ocr-pdf] Font embed failed, falling back:", err);
        return null;
      })
    : null;

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
        drawInvisibleText(page, { text: word.text, x: coords.x, y: coords.y, size: fontSize, embeddedFont });
      }
    } else {
      drawInvisibleText(page, { text: pg.fallbackText || " ", x: 0, y: dims.height - 12, size: 12, embeddedFont });
    }
  }

  const raw = await pdfDoc.save();
  return new Uint8Array(raw) as Uint8Array<ArrayBuffer>;
}
