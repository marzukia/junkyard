/** Aspect ratio presets. "free" means no constraint. */
export type AspectPreset = "free" | "1:1" | "4:5" | "16:9" | "9:16" | "4:3" | "3:2" | "4:1";

export interface AspectRatio {
  label: AspectPreset;
  w: number;
  h: number;
}

export const ASPECT_PRESETS: AspectRatio[] = [
  { label: "free", w: 0, h: 0 },
  { label: "1:1", w: 1, h: 1 },
  { label: "4:5", w: 4, h: 5 },
  { label: "9:16", w: 9, h: 16 },
  { label: "16:9", w: 16, h: 9 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:2", w: 3, h: 2 },
  { label: "4:1", w: 4, h: 1 },
];

/** Named social-size presets: a label plus a target aspect ratio. */
export interface SocialPreset {
  name: string;
  /** Output pixel dimensions hint (shown to user). Crop enforces the ratio. */
  px: string;
  aspect: AspectPreset;
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  { name: "Instagram Square", px: "1080x1080", aspect: "1:1" },
  { name: "Instagram Portrait", px: "1080x1350", aspect: "4:5" },
  { name: "Instagram Story", px: "1080x1920", aspect: "9:16" },
  { name: "Twitter / X Post", px: "1200x675", aspect: "16:9" },
  { name: "Twitter / X Header", px: "1500x500", aspect: "3:2" },
  { name: "Facebook Cover", px: "820x312", aspect: "16:9" },
  { name: "YouTube Thumbnail", px: "1280x720", aspect: "16:9" },
  { name: "LinkedIn Banner", px: "1584x396", aspect: "4:1" },
];

/** Crop shape modes. */
export type CropShape = "rect" | "circle";

export type ExportFormat = "png" | "jpg" | "webp";

/** A crop rectangle in image-pixel coordinates. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export { clamp } from "@junkyardsh/kit";

/**
 * Constrain a crop rect to fit within image bounds (imgW x imgH).
 * Preserves position intent, if the rect would overflow it's pushed back in.
 */
export function clampRect(rect: CropRect, imgW: number, imgH: number): CropRect {
  const w = clamp(rect.w, 1, imgW);
  const h = clamp(rect.h, 1, imgH);
  const x = clamp(rect.x, 0, imgW - w);
  const y = clamp(rect.y, 0, imgH - h);
  return { x, y, w, h };
}

/**
 * Given a desired aspect ratio and a bounding box, compute the largest
 * crop rect centred in the bounding box that satisfies the ratio.
 * If ratio is "free" (w=0/h=0), returns the full bounding box.
 */
export function fitRectToAspect(aspect: AspectRatio, boundW: number, boundH: number): CropRect {
  if (aspect.w === 0 || aspect.h === 0) {
    return { x: 0, y: 0, w: boundW, h: boundH };
  }
  const ratio = aspect.w / aspect.h;
  let w = boundW;
  let h = Math.round(w / ratio);
  if (h > boundH) {
    h = boundH;
    w = Math.round(h * ratio);
  }
  const x = Math.round((boundW - w) / 2);
  const y = Math.round((boundH - h) / 2);
  return { x, y, w, h };
}

/**
 * Snap a crop rect to maintain a given aspect ratio after a resize drag.
 * Anchor is which corner is being dragged ("br" = bottom-right, etc.).
 * For simplicity we scale from the top-left when aspect changes.
 */
export function snapToAspect(rect: CropRect, aspect: AspectRatio): CropRect {
  if (aspect.w === 0 || aspect.h === 0) return rect;
  const ratio = aspect.w / aspect.h;
  const h = Math.round(rect.w / ratio);
  return { ...rect, h };
}

/**
 * Rotate an image on a canvas and return a new ImageData-like object.
 * Rotation is in degrees: 90 = 90 deg clockwise, -90 = 90 deg CCW.
 */
export function rotateCanvas(
  source: HTMLCanvasElement,
  degrees: 90 | -90 | 180
): HTMLCanvasElement {
  const radians = (degrees * Math.PI) / 180;
  const abs = Math.abs(degrees);
  const outW = abs === 90 ? source.height : source.width;
  const outH = abs === 90 ? source.width : source.height;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

/**
 * Flip a canvas horizontally (flipH=true) or vertically.
 */
export function flipCanvas(
  source: HTMLCanvasElement,
  flipH: boolean,
  flipV: boolean
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.translate(flipH ? source.width : 0, flipV ? source.height : 0);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(source, 0, 0);
  return out;
}

/**
 * Apply a CropRect to a canvas, optionally resizing the output.
 * Returns a data URL in the specified format.
 */
export function applyCropAndResize(
  source: HTMLCanvasElement,
  crop: CropRect,
  resizeW: number,
  resizeH: number,
  format: ExportFormat,
  quality: number
): string {
  const out = document.createElement("canvas");
  out.width = resizeW > 0 ? resizeW : crop.w;
  out.height = resizeH > 0 ? resizeH : crop.h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);

  const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`;
  return out.toDataURL(mimeType, quality / 100);
}

/**
 * Extended crop export with optional circle clip.
 * Circle clip always outputs PNG regardless of format choice (transparency needed).
 */
export function applyCropAndResizeWithShape(
  source: HTMLCanvasElement,
  crop: CropRect,
  resizeW: number,
  resizeH: number,
  format: ExportFormat,
  quality: number,
  shape: CropShape
): string {
  const outW = resizeW > 0 ? resizeW : crop.w;
  const outH = resizeH > 0 ? resizeH : crop.h;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  if (shape === "circle") {
    // Clip to ellipse centred in output canvas
    ctx.beginPath();
    ctx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  }

  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);

  // Circle crop must be PNG to preserve transparency
  const effectiveFmt: ExportFormat = shape === "circle" ? "png" : format;
  const mimeType = effectiveFmt === "jpg" ? "image/jpeg" : `image/${effectiveFmt}`;
  return out.toDataURL(mimeType, quality / 100);
}

/**
 * Rotate a canvas by an arbitrary angle (degrees). Output is sized to contain
 * the full rotated image without cropping the corners.
 */
export function rotateCanvasArbitrary(
  source: HTMLCanvasElement,
  degrees: number
): HTMLCanvasElement {
  if (degrees === 0) return source;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const outW = Math.ceil(source.width * cos + source.height * sin);
  const outH = Math.ceil(source.width * sin + source.height * cos);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

/** Parse a natural "WxH" string like "1920x1080" into [w, h] or null. */
export function parseDimensions(input: string): [number, number] | null {
  const m = input.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!m) return null;
  const w = Number.parseInt(m[1], 10);
  const h = Number.parseInt(m[2], 10);
  if (w <= 0 || h <= 0 || w > 16000 || h > 16000) return null;
  return [w, h];
}

/** Given crop dims and a new width, compute proportional height. */
export function proportionalHeight(cropW: number, cropH: number, newW: number): number {
  if (cropW === 0) return 0;
  return Math.round((cropH / cropW) * newW);
}
