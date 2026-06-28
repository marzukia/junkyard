/**
 * Image helpers for cleanup/inpaint — app-specific extensions on the shared core.
 * Shared core (ACCEPTED_TYPES, isSupportedImage, formatBytes, clamp, outputFilename)
 * is imported from kit/lib/imageHelpers (source of truth).
 */
export {
  ACCEPTED_TYPES,
  type AcceptedType,
  isSupportedImage,
  formatBytes,
  clamp,
  outputFilename,
} from "../../../../kit/lib/imageHelpers";

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
      if (dx * dx + dy * dy <= r2) offsets.push([dx, dy]);
    }
  }
  return offsets;
}
