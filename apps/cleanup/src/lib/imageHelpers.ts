/**
 * Image helpers for cleanup/inpaint — app-specific extensions on the shared core.
 * Shared core (ACCEPTED_TYPES, isSupportedImage, formatBytes)
 * is imported from kit/lib/imageHelpers (source of truth).
 */
export {
  ACCEPTED_TYPES,
  type AcceptedType,
  isSupportedImage,
  formatBytes,
} from "../../../../kit/lib/imageHelpers";

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Produce a safe download filename for the erased image. */
export function outputFilename(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/, "");
  return `${base}-cleanup.png`;
}

/**
 * Convert canvas coordinates to image coordinates given display vs natural dimensions.
 * Used when the canvas element is CSS-scaled differently from the image's natural size.
 */
export function canvasToImageCoords(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  return {
    x: Math.round((canvasX / canvasWidth) * imageWidth),
    y: Math.round((canvasY / canvasHeight) * imageHeight),
  };
}

/**
 * Build a circle brush stamp: returns an array of [dx, dy] offsets
 * for all pixels within the given radius of (0,0).
 */
export function circleBrushOffsets(radius: number): Array<[number, number]> {
  const offsets: Array<[number, number]> = [];
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= r2) {
        offsets.push([dx, dy]);
      }
    }
  }
  return offsets;
}

/**
 * Paint a circle of 255 into a mask buffer at (cx, cy) with the given radius.
 * Clips to image bounds. Mutates mask in-place.
 */
export function paintMaskCircle(
  mask: Uint8Array,
  cx: number,
  cy: number,
  radius: number,
  imageWidth: number,
  imageHeight: number
): void {
  const offsets = circleBrushOffsets(radius);
  for (const [dx, dy] of offsets) {
    const x = cx + dx;
    const y = cy + dy;
    if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) continue;
    mask[y * imageWidth + x] = 255;
  }
}

/** Count how many pixels in a mask are marked (> 127). */
export function maskPixelCount(mask: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) count++;
  }
  return count;
}
