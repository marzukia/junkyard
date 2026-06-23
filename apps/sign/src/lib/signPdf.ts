import { PDFDocument, type PDFPage, rgb } from "pdf-lib";

export interface SignaturePlacement {
  /** Data URL of the signature PNG */
  dataUrl: string;
  /** Page index (0-based) */
  pageIndex: number;
  /**
   * Position and size as fractions of the rendered canvas dimensions.
   * x/y are top-left corner; w/h are width/height.
   * These are in canvas-space; we convert to PDF-space below.
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
    r = Number.parseInt(clean[0] + clean[0], 16) / 255;
    g = Number.parseInt(clean[1] + clean[1], 16) / 255;
    b = Number.parseInt(clean[2] + clean[2], 16) / 255;
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

function drawPlacementOnPage(
  page: PDFPage,
  pngImage: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  placement: Omit<SignaturePlacement, "dataUrl" | "pageIndex">
) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const sigWidthPt = placement.wFrac * pageWidth;
  const sigHeightPt = placement.hFrac * pageHeight;
  const scaleX = pageWidth / placement.canvasWidth;
  const scaleY = pageHeight / placement.canvasHeight;
  const xPt = placement.xFrac * placement.canvasWidth * scaleX;
  const yTopPt = placement.yFrac * placement.canvasHeight * scaleY;
  const yPt = pageHeight - yTopPt - sigHeightPt;
  page.drawImage(pngImage, { x: xPt, y: yPt, width: sigWidthPt, height: sigHeightPt });
}

/**
 * Embed a signature image into a PDF page using pdf-lib.
 * Returns the modified PDF as a Uint8Array.
 *
 * PDF coordinate origin is bottom-left; canvas origin is top-left.
 * We convert: pdfY = pageHeight - (canvasY_px + sigHeight_px) * scale
 * where scale = pageWidth_pt / canvasWidth_px.
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

  const { width: pageWidth, height: pageHeight } = page.getSize();
  const sigWidthPt = placement.wFrac * pageWidth;
  const sigHeightPt = placement.hFrac * pageHeight;
  const scaleX = pageWidth / placement.canvasWidth;
  const scaleY = pageHeight / placement.canvasHeight;
  const xPt = placement.xFrac * placement.canvasWidth * scaleX;
  const yTopPt = placement.yFrac * placement.canvasHeight * scaleY;
  const yPt = pageHeight - yTopPt - sigHeightPt;

  // Decode data URL to bytes
  const base64 = placement.dataUrl.replace(/^data:image\/png;base64,/, "");
  const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pngImage = await pdfDoc.embedPng(imgBytes);

  page.drawImage(pngImage, {
    x: xPt,
    y: yPt,
    width: sigWidthPt,
    height: sigHeightPt,
  });

  if (annotations) {
    for (const ann of annotations) {
      embedTextAnnotation(page, ann);
    }
  }

  return pdfDoc.save();
}

/**
 * Embed a signature onto multiple pages in one pass.
 * pageIndices: which pages (0-based) to receive the signature.
 * The overlay position/size fractions are applied identically to each page.
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

  for (const idx of pageIndices) {
    const page = pages[idx];
    if (!page) continue;
    drawPlacementOnPage(page, pngImage, placement);
    if (annotations) {
      for (const ann of annotations) {
        embedTextAnnotation(page, ann);
      }
    }
  }

  return pdfDoc.save();
}

function embedTextAnnotation(page: PDFPage, ann: TextAnnotation) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const scaleX = pageWidth / ann.canvasWidth;
  const scaleY = pageHeight / ann.canvasHeight;
  const xPt = ann.xFrac * ann.canvasWidth * scaleX;
  const yTopPt = ann.yFrac * ann.canvasHeight * scaleY;
  const fontSize = ann.fontSize ?? 11;
  // Offset down by roughly one line so the text sits below the anchor point
  const yPt = pageHeight - yTopPt - fontSize;
  const color = ann.color ? hexToRgb(ann.color) : rgb(0.1, 0.14, 0.19);
  page.drawText(ann.text, { x: xPt, y: yPt, size: fontSize, color });
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
