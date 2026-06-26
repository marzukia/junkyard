import { embedUnicodeFonts, sanitizeWinAnsi } from "@junkyardsh/ui/pdf";
import { PDFDocument, type PDFPage, rgb } from "pdf-lib";

export interface SignaturePlacement {
  /** Data URL of the signature PNG */
  dataUrl: string;
  /** Page index (0-based) */
  pageIndex: number;
  /**
   * Position and size as fractions of the rendered canvas dimensions.
   * x/y are top-left corner; w/h are width/height.
   * These are in canvas-space (which matches the upright/rotated display from PDF.js);
   * we convert to PDF-space (unrotated coordinates) below.
   */
  xFrac: number;
  yFrac: number;
  wFrac: number;
  hFrac: number;
  /** Rendered canvas pixel dimensions (used for fraction-to-PDF conversion) */
  canvasWidth: number;
  canvasHeight: number;
}

/** Extra text annotations (date stamp, free-text) to embed alongside a signature. */
export interface TextAnnotation {
  text: string;
  /** Fraction of canvas width for left edge */
  xFrac: number;
  /** Fraction of canvas height for top edge */
  yFrac: number;
  canvasWidth: number;
  canvasHeight: number;
  fontSize?: number;
  /** Hex colour string e.g. "#1a2530" */
  color?: string;
}

/**
 * Parse a hex colour string like "#1a2530" or "#fff" into pdf-lib rgb() values.
 * Supports 6-digit (#rrggbb) and 3-digit (#rgb) forms.
 * Throws on truly invalid input rather than silently returning black.
 */
export function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const clean = hex.replace(/^#/, "");
  let r: number, g: number, b: number;

  if (clean.length === 3) {
    r = Number.parseInt(clean[0]! + clean[0], 16) / 255;
    g = Number.parseInt(clean[1]! + clean[1], 16) / 255;
    b = Number.parseInt(clean[2]! + clean[2], 16) / 255;
  } else if (clean.length === 6) {
    r = Number.parseInt(clean.slice(0, 2), 16) / 255;
    g = Number.parseInt(clean.slice(2, 4), 16) / 255;
    b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  } else {
    throw new Error("Invalid hex colour: " + JSON.stringify(hex));
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    throw new Error("Invalid hex colour: " + JSON.stringify(hex));
  }

  return rgb(r, g, b);
}

/**
 * Convert an image File (PNG, JPG, GIF, WebP) to a data URL.
 * Normalises non-PNG files by drawing through a canvas so we always
 * output image/png (pdf-lib only embeds PNG and JPG natively, but canvas
 * export ensures consistent alpha support).
 */
export function imageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

/**
 * Convert canvas-space fractional coordinates to PDF-space points,
 * accounting for the page's /Rotate value.
 *
 * PDF.js applies /Rotate when rendering to canvas, so the user places
 * signatures on the visually-upright canvas. The underlying PDF coordinate
 * system is unrotated. We undo the rotation here so the drawn image lands
 * in the correct physical location.
 *
 * @param xFrac     fraction of canvas width (left edge of placement)
 * @param yFrac     fraction of canvas height (top edge of placement)
 * @param wFrac     fraction of canvas width (placement width)
 * @param hFrac     fraction of canvas height (placement height)
 * @param rotation  page /Rotate angle in degrees (0, 90, 180, 270)
 * @param pageW     unrotated page width in PDF points
 * @param pageH     unrotated page height in PDF points
 * @returns         { x, y, w, h } in PDF points with origin at bottom-left
 */
export function canvasToPageCoords(
  xFrac: number,
  yFrac: number,
  wFrac: number,
  hFrac: number,
  rotation: number,
  pageW: number,
  pageH: number
): { x: number; y: number; w: number; h: number } {
  const angle = ((rotation % 360) + 360) % 360;

  // Canvas dimensions as seen by PDF.js (post-rotation)
  const canvasW = angle === 90 || angle === 270 ? pageH : pageW;
  const canvasH = angle === 90 || angle === 270 ? pageW : pageH;

  // Convert fractions to absolute canvas pixels (points scale 1:1 here)
  const cxLeft = xFrac * canvasW;
  const cyTop = yFrac * canvasH;
  const cw = wFrac * canvasW;
  const ch = hFrac * canvasH;

  // Transform canvas-space top-left -> PDF-space bottom-left origin
  switch (angle) {
    case 0: {
      // No rotation: canvas x = pdf x, canvas y-from-top -> pdf y-from-bottom
      const x = cxLeft;
      const y = pageH - cyTop - ch;
      return { x, y, w: cw, h: ch };
    }
    case 90: {
      // PDF.js rotates page 90deg CW to display upright.
      // Canvas (0,0) maps to PDF bottom-left corner of unrotated page.
      // canvas x -> pdf y (from bottom), canvas y -> pdf x (from left, mirrored)
      const x = cyTop;
      const y = cxLeft;
      return { x, y, w: ch, h: cw };
    }
    case 180: {
      // Canvas (0,0) maps to PDF top-right of unrotated page.
      const x = pageW - cxLeft - cw;
      const y = cyTop;
      return { x, y, w: cw, h: ch };
    }
    case 270: {
      // PDF.js rotates page 90deg CCW to display upright.
      // canvas x -> pdf y (from top = pageH - ...), canvas y -> pdf x (from right)
      const x = pageH - cyTop - ch;
      const y = pageW - cxLeft - cw;
      return { x, y, w: ch, h: cw };
    }
    default:
      // Unexpected angle; fall through to 0 behaviour
      return { x: cxLeft, y: pageH - cyTop - ch, w: cw, h: ch };
  }
}

function drawPlacementOnPage(
  page: PDFPage,
  pngImage: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  placement: Omit<SignaturePlacement, "dataUrl" | "pageIndex">
): void {
  const rotation = page.getRotation().angle;
  const { width: pageW, height: pageH } = page.getSize();

  const { x, y, w, h } = canvasToPageCoords(
    placement.xFrac,
    placement.yFrac,
    placement.wFrac,
    placement.hFrac,
    rotation,
    pageW,
    pageH
  );

  page.drawImage(pngImage, { x, y, width: w, height: h });
}

/**
 * Embed a signature image into a PDF page using pdf-lib.
 * Returns the modified PDF as a Uint8Array.
 *
 * Respects page /Rotate: the user places the signature on the visually-upright
 * canvas (as rendered by PDF.js), and we transform the coordinates back to the
 * unrotated PDF coordinate system so the signature lands in the right place.
 */
export async function embedSignatureInPdf(
  pdfBytes: ArrayBuffer,
  placement: SignaturePlacement,
  annotations?: TextAnnotation[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page: PDFPage | undefined = pages[placement.pageIndex];
  if (!page) throw new Error(`Page ${placement.pageIndex} not found`);

  // Decode data URL to bytes
  const base64 = placement.dataUrl.replace(/^data:image\/png;base64,/, "");
  const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pngImage = await pdfDoc.embedPng(imgBytes);

  drawPlacementOnPage(page, pngImage, placement);

  if (annotations && annotations.length > 0) {
    const unicodeFonts = await embedUnicodeFonts(pdfDoc);
    for (const ann of annotations) {
      await embedTextAnnotation(pdfDoc, page, ann, unicodeFonts?.regular ?? null);
    }
  }

  return pdfDoc.save();
}

/**
 * Embed a signature onto multiple pages in one pass.
 * pageIndices: which pages (0-based) to receive the signature.
 * The overlay position/size fractions are applied identically to each page
 * (each page's own /Rotate is respected independently).
 */
export async function embedSignatureOnPages(
  pdfBytes: ArrayBuffer,
  placement: SignaturePlacement,
  pageIndices: number[],
  annotations?: TextAnnotation[]
): Promise<Uint8Array> {
  if (pageIndices.length === 0) return embedSignatureInPdf(pdfBytes, placement, annotations);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const base64 = placement.dataUrl.replace(/^data:image\/png;base64,/, "");
  const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pngImage = await pdfDoc.embedPng(imgBytes);

  const unicodeFonts =
    annotations && annotations.length > 0 ? await embedUnicodeFonts(pdfDoc) : null;

  for (const idx of pageIndices) {
    const page = pages[idx];
    if (!page) continue;
    drawPlacementOnPage(page, pngImage, placement);
    if (annotations) {
      for (const ann of annotations) {
        await embedTextAnnotation(pdfDoc, page, ann, unicodeFonts?.regular ?? null);
      }
    }
  }

  return pdfDoc.save();
}

async function embedTextAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  ann: TextAnnotation,
  unicodeFont: Awaited<ReturnType<PDFDocument["embedFont"]>> | null
): Promise<void> {
  const { width: pageW, height: pageH } = page.getSize();
  const rotation = page.getRotation().angle;
  const fontSize = ann.fontSize ?? 11;
  const color = ann.color ? hexToRgb(ann.color) : rgb(0.1, 0.14, 0.19);

  // Use the same coordinate transform as images but treat the annotation as a
  // zero-height element at the anchor point (h=0 -> just flip y).
  const { x, y } = canvasToPageCoords(
    ann.xFrac,
    ann.yFrac,
    0,
    fontSize / (rotation === 90 || rotation === 270 ? pageH : pageH),
    rotation,
    pageW,
    pageH
  );

  const safeText = unicodeFont ? ann.text : sanitizeWinAnsi(ann.text);

  if (unicodeFont) {
    page.drawText(safeText, { x, y, size: fontSize, font: unicodeFont, color });
  } else {
    // StandardFont fallback: embed Helvetica if not already done
    const fallbackFont = await pdfDoc.embedFont("Helvetica");
    page.drawText(safeText, { x, y, size: fontSize, font: fallbackFont, color });
  }
}

/**
 * Convert a canvas element to a trimmed PNG data URL.
 * "Trimmed" means we find the bounding box of non-transparent pixels so the
 * resulting image has no unnecessary whitespace around the signature.
 */
export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha !== undefined && alpha > 8) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return null;

  const pad = 4;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width, maxX + pad + 1) - cropX;
  const cropH = Math.min(height, maxY + pad + 1) - cropY;

  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = cropW;
  tmpCanvas.height = cropH;
  const tmpCtx = tmpCanvas.getContext("2d");
  if (!tmpCtx) return null;

  tmpCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return tmpCanvas.toDataURL("image/png");
}

/**
 * Render typed text as a PNG data URL on a temporary canvas.
 * Returns null if text is empty.
 *
 * @param fontSpec - Full CSS font string, e.g. "italic 72px Georgia, serif".
 *                   When omitted, defaults to italic Georgia at the given fontSize.
 */
export function textToPngDataUrl(
  text: string,
  inkColor: string,
  fontSize = 72,
  fontSpec?: string
): string | null {
  if (!text.trim()) return null;

  const tmpCanvas = document.createElement("canvas");
  const ctx = tmpCanvas.getContext("2d");
  if (!ctx) return null;

  // Replace the size token in the fontSpec so we respect the caller's fontSize
  const font = fontSpec
    ? fontSpec.replace(/\d+px/, `${fontSize}px`)
    : `italic ${fontSize}px Georgia, "Times New Roman", serif`;

  ctx.font = font;
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width) + 16;
  const textHeight = fontSize + 20;

  tmpCanvas.width = textWidth;
  tmpCanvas.height = textHeight;

  ctx.font = font;
  ctx.fillStyle = inkColor;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, textHeight / 2);

  return tmpCanvas.toDataURL("image/png");
}
