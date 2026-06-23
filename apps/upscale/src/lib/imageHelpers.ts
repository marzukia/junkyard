/**
 * Pure image helpers -- no DOM side-effects, easily unit-tested.
 */

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

export const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";

export type OutputFormat = "png" | "jpeg" | "webp";

/** True if the file's MIME type is a supported raster image. */
export function isSupportedImage(file: File): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(file.type);
}

/** Format bytes as a human-readable string (KB / MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a download progress (loaded/total bytes) as "x% (y.y MB / z.z MB)". */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  return `${pct}%`;
}

/** Produce a safe download filename for the upscaled image. */
export function outputFilename(
  inputName: string,
  scale: number,
  format: OutputFormat = "png"
): string {
  const base = inputName.replace(/\.[^.]+$/, "");
  const ext = format === "jpeg" ? "jpg" : format;
  return `${base}-upscaled-${scale}x.${ext}`;
}

/** Format pixel dimensions as a compact string e.g. "1920 x 1080". */
export function formatDimensions(w: number, h: number): string {
  return `${w} x ${h}`;
}

/**
 * Maximum megapixel count we allow through without clamping for each scale.
 * Swin2SR tiles 64x64 patches; large images are tiled in memory so very large
 * sources still run but take proportionally longer. We cap 4x at 2 MP and 2x
 * at 8 MP so the tab does not freeze on typical consumer photos.
 */
export const MAX_MEGAPIXELS: Record<2 | 4, number> = { 2: 8, 4: 2 };

/** Max dimension (longest edge) we recommend for a given scale factor. */
export const MAX_DIMENSION: Record<2 | 4, number> = { 2: 2828, 4: 1414 };

export interface SizeCheck {
  /** Width of the source image in pixels */
  width: number;
  /** Height of the source image in pixels */
  height: number;
  megapixels: number;
  /** True if the image exceeds the safe limit for the chosen scale */
  tooLarge: boolean;
  /** Clamped dimensions to pass to resizeImageFile(), or null if within limit */
  clampedWidth: number | null;
  clampedHeight: number | null;
}

/**
 * Check source image pixel dimensions against the per-scale limit.
 * Reads a File via createObjectURL; resolves with a SizeCheck.
 */
export function checkImageSize(file: File, scale: 2 | 4): Promise<SizeCheck> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const mp = (w * h) / 1_000_000;
      const limit = MAX_MEGAPIXELS[scale];
      if (mp <= limit) {
        resolve({
          width: w,
          height: h,
          megapixels: mp,
          tooLarge: false,
          clampedWidth: null,
          clampedHeight: null,
        });
      } else {
        // Scale down longest edge to stay within limit
        const ratio = Math.sqrt(limit / mp);
        resolve({
          width: w,
          height: h,
          megapixels: mp,
          tooLarge: true,
          clampedWidth: Math.round(w * ratio),
          clampedHeight: Math.round(h * ratio),
        });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    img.src = url;
  });
}

/**
 * Resize a File to the given pixel dimensions via canvas, returning a new File.
 * Used to clamp oversized inputs before sending through the upscaler.
 */
export function resizeImageFile(file: File, targetW: number, targetH: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas 2d unavailable"));
      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("toBlob failed"));
        resolve(new File([blob], file.name, { type: "image/png" }));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image for resize."));
    };
    img.src = url;
  });
}

/** MIME type string for an OutputFormat. */
export function outputMime(format: OutputFormat): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}
