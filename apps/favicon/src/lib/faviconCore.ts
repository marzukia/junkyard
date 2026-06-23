/**
 * Pure favicon generation utilities — all client-side, no uploads.
 * These functions are tested independently of the React layer.
 */

export interface FaviconSize {
  size: number;
  label: string;
  filename: string;
  purpose?: string;
}

/** Source mode for favicon generation */
export type SourceMode = "image" | "text" | "emoji";

/** Background + shape options that apply to all source modes */
export interface CanvasOptions {
  /** Solid background colour as CSS hex string, e.g. "#2f9d8d". "" = transparent */
  bgColor: string;
  /** Corner radius as fraction of canvas size, 0–0.5 */
  cornerRadius: number;
  /** Inner padding as fraction of canvas size, 0–0.4 */
  padding: number;
}

/** Image quality warning codes */
export type ImageWarning = "non-square" | "too-small" | "low-contrast";

/** Analyse a loaded image and return any quality warnings */
export function analyseImage(img: HTMLImageElement): ImageWarning[] {
  const warnings: ImageWarning[] = [];
  const { naturalWidth: w, naturalHeight: h } = img;

  if (w !== h) warnings.push("non-square");
  if (w < 512 || h < 512) warnings.push("too-small");
  // Low contrast: sample the image into a 32px canvas and measure contrast
  if (w > 0 && h > 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, 32, 32);
      const { data } = ctx.getImageData(0, 0, 32, 32);
      let minL = 1;
      let maxL = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = (data[i] ?? 0) / 255;
        const g = (data[i + 1] ?? 0) / 255;
        const b = (data[i + 2] ?? 0) / 255;
        // Relative luminance approximation
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
      if (maxL - minL < 0.12) warnings.push("low-contrast");
    }
  }
  return warnings;
}

/** Draw a text or emoji glyph into a canvas at the given square size. */
export function drawTextToCanvas(
  text: string,
  size: number,
  opts: CanvasOptions
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  applyBackground(ctx, size, opts);

  const pad = Math.round(size * opts.padding);
  const innerSize = size - pad * 2;

  // Scale font to fill the inner area
  const fontSize = Math.round(innerSize * 0.72);
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw shadow for contrast on transparent bg
  if (!opts.bgColor) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = Math.round(size * 0.06);
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text.slice(0, 2), size / 2, size / 2 + 1);
  ctx.shadowBlur = 0;

  return canvas;
}

/** Apply background fill and rounded-rect clipping to a canvas context. */
function applyBackground(ctx: CanvasRenderingContext2D, size: number, opts: CanvasOptions): void {
  ctx.clearRect(0, 0, size, size);

  if (opts.cornerRadius > 0 || opts.bgColor) {
    const r = Math.round(size * Math.min(opts.cornerRadius, 0.5));
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, r);
    ctx.clip();
  }

  if (opts.bgColor) {
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, size, size);
  }
}

export const FAVICON_SIZES: FaviconSize[] = [
  { size: 16, label: "16×16", filename: "favicon-16x16.png" },
  { size: 32, label: "32×32", filename: "favicon-32x32.png" },
  { size: 48, label: "48×48", filename: "favicon-48x48.png" },
  { size: 180, label: "180×180", filename: "apple-touch-icon.png" },
  { size: 192, label: "192×192", filename: "icon-192.png", purpose: "any maskable" },
  { size: 512, label: "512×512", filename: "icon-512.png", purpose: "any maskable" },
];

/**
 * Default canvas options (transparent bg, no padding, no corner radius).
 * Exported so callers can spread-override individual fields.
 */
export const DEFAULT_CANVAS_OPTIONS: CanvasOptions = {
  bgColor: "",
  cornerRadius: 0,
  padding: 0,
};

/** Draw an image source into a canvas at the given square size and return it. */
export function drawToCanvas(
  src: HTMLImageElement,
  size: number,
  opts: CanvasOptions = DEFAULT_CANVAS_OPTIONS
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  applyBackground(ctx, size, opts);

  const pad = Math.round(size * opts.padding);
  // Letterbox: draw image centred/scaled within the padded inner square
  const srcW = src.naturalWidth || src.width;
  const srcH = src.naturalHeight || src.height;
  if (srcW > 0 && srcH > 0) {
    const innerSize = size - pad * 2;
    const scale = Math.min(innerSize / srcW, innerSize / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = pad + (innerSize - dw) / 2;
    const dy = pad + (innerSize - dh) / 2;
    ctx.drawImage(src, dx, dy, dw, dh);
  } else {
    ctx.drawImage(src, pad, pad, size - pad * 2, size - pad * 2);
  }
  return canvas;
}

/** Extract a Blob from a canvas as PNG. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      "image/png",
      1
    );
  });
}

/** Extract raw RGBA bytes from a canvas. Used to build ICO. */
export function canvasToRgba(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

/**
 * Build a minimal multi-size favicon.ico containing 16×16, 32×32 and 48×48
 * PNG frames embedded in an ICO container.
 *
 * ICO format (little-endian):
 *   Header: reserved(2) + type(2=1) + count(2)
 *   Directory entries: count × 16 bytes each
 *   Image data: PNG blobs concatenated
 */
export function buildIco(pngBlobs: { size: number; data: Uint8Array }[]): Uint8Array {
  const count = pngBlobs.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;

  // Calculate total size and offsets
  let dataOffset = headerSize + dirSize;
  const offsets: number[] = [];
  for (const { data } of pngBlobs) {
    offsets.push(dataOffset);
    dataOffset += data.byteLength;
  }

  const total = dataOffset;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // ICO header
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = 1 (ICO)
  view.setUint16(4, count, true); // image count

  // Directory entries
  for (let i = 0; i < count; i++) {
    const { size, data } = pngBlobs[i];
    const base = 6 + i * 16;
    // width/height: 0 means 256; for sizes ≤ 255 write the actual value
    view.setUint8(base + 0, size >= 256 ? 0 : size);
    view.setUint8(base + 1, size >= 256 ? 0 : size);
    view.setUint8(base + 2, 0); // colour count (0 = not palettised)
    view.setUint8(base + 3, 0); // reserved
    view.setUint16(base + 4, 1, true); // colour planes
    view.setUint16(base + 6, 32, true); // bits per pixel
    view.setUint32(base + 8, data.byteLength, true); // image data size
    view.setUint32(base + 12, offsets[i], true); // image data offset
  }

  // Image data
  let writePos = headerSize + dirSize;
  for (const { data } of pngBlobs) {
    bytes.set(data, writePos);
    writePos += data.byteLength;
  }

  return new Uint8Array(buf);
}

/** Build a web app manifest JSON string. */
export function buildManifest(name: string): string {
  const manifest = {
    name,
    short_name: name,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
    theme_color: "#2f9d8d",
    background_color: "#ffffff",
    display: "standalone",
  };
  return JSON.stringify(manifest, null, 2);
}

/** Build the HTML <head> snippet. */
export function buildHtmlSnippet(appName: string): string {
  return [
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
    `<meta name="theme-color" content="#2f9d8d">`,
    `<!-- Generated by favicon.mrzk.io - ${appName} -->`,
  ].join("\n");
}

/** Clamp a string length for safe use as a manifest name. */
export function sanitiseAppName(raw: string): string {
  return raw.trim().slice(0, 45) || "My App";
}
