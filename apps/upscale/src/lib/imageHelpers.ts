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

export { formatBytes } from "@junkyardsh/ui";
export { formatProgress } from "@junkyardsh/ui/ai";

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
 * Desktop baseline megapixel caps (input pixels, not output).
 * Swin2SR tiles 64x64 patches; large images are tiled in memory so very large
 * sources still run but take proportionally longer. We cap 4x at 2 MP and 2x
 * at 8 MP so the tab does not freeze on typical consumer photos.
 *
 * NOTE: these are the DESKTOP caps. Mobile caps are computed dynamically via
 * safeInputMegapixels() which accounts for the output tensor size and the
 * device memory budget returned by deviceMemoryBudgetMB().
 */
export const MAX_MEGAPIXELS: Record<2 | 4, number> = { 2: 8, 4: 2 };

/** Max dimension (longest edge) we recommend for a given scale factor. */
export const MAX_DIMENSION: Record<2 | 4, number> = { 2: 2828, 4: 1414 };

/**
 * Estimate the available memory budget in MB for the upscaler based on
 * navigator.deviceMemory, hardwareConcurrency, and pointer coarseness.
 *
 * Mobile / low-memory detection heuristic:
 *   - navigator.deviceMemory <= 4 GB  -> mobile/constrained
 *   - hardwareConcurrency <= 4        -> low-end device
 *   - matchMedia("(pointer: coarse)") -> touchscreen (mobile/tablet)
 *
 * Returns a budget in MB that the *upscaler's peak usage* should stay under.
 * Desktop: 512 MB (generous for a 2-8 MP input -> 8-128 MP output).
 * Mobile (any flag): 180 MB. Ultra-low (<= 2 GB device memory): 80 MB.
 *
 * Why these numbers:
 *   iOS Safari kills WebContent processes above ~1.2 GB. The model occupies
 *   ~50 MB, WASM runtime ~30 MB, JS heap ~20 MB. We budget the REMAINDER for
 *   the output tensor (RGBA float32 = 4 bytes/pixel).
 *   180 MB - 100 MB overhead = 80 MB free = ~20 MP output max (4x: ~1.25 MP in).
 *   80 MB  - 100 MB overhead = too tight, so we use 80 MB as the tensor budget
 *   directly (total process stays under 230 MB).
 */
// Navigator extended with non-standard memory hint (Memory Information API)
interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

export function deviceMemoryBudgetMB(): number {
  const nav: NavigatorWithMemory | null =
    typeof navigator !== "undefined" ? (navigator as NavigatorWithMemory) : null;

  if (!nav) return 512; // SSR/test environment

  const deviceMem: number = nav.deviceMemory ?? 8;
  const cores: number = nav.hardwareConcurrency ?? 8;

  let isCoarsePointer = false;
  try {
    isCoarsePointer =
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    // matchMedia unavailable in some environments
  }

  const isMobileLike = deviceMem <= 4 || cores <= 4 || isCoarsePointer;

  if (!isMobileLike) return 512;
  if (deviceMem <= 2) return 80;
  return 180;
}

/**
 * Given a scale factor and a memory budget in MB, compute the maximum number
 * of input megapixels that keeps the OUTPUT tensor within budget.
 *
 * The Swin2SR output is an RGB float32 tensor: output_px * 3 * 4 bytes.
 * For a 4x job (two 2x passes), output_px = input_px * 4^2 = input_px * 16.
 * We also hold the intermediate pass-1 output while running pass 2, so the
 * effective peak is 2x the final output tensor size for 4x jobs.
 *
 * Formula: input_mp <= budgetBytes / (scale^2 * peak_multiplier * bytes_per_pixel)
 * where bytes_per_pixel = 3 * 4 = 12 (RGB float32) and
 * peak_multiplier = 2 for scale=4 (two live tensors), 1 for scale=2.
 */
export function safeInputMegapixels(scale: 2 | 4, budgetMB: number): number {
  const budgetBytes = budgetMB * 1024 * 1024;
  const bytesPerPixel = 12; // RGB float32
  const scaleSq = scale * scale;
  // For 4x: two passes means pass-1 output + pass-2 output coexist briefly
  const peakMultiplier = scale === 4 ? 2 : 1;
  const maxInputPixels = budgetBytes / (scaleSq * peakMultiplier * bytesPerPixel);
  return maxInputPixels / 1_000_000;
}

/**
 * Returns true if the current device appears to be memory-constrained
 * (mobile phone, tablet, or low-spec laptop). Uses the same heuristics as
 * deviceMemoryBudgetMB() but as a simple boolean for UI branching.
 */
export function isConstrainedDevice(): boolean {
  return deviceMemoryBudgetMB() < 512;
}

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
  /**
   * True when the limit was computed from device memory (constrained device).
   * Used to suppress "proceed full size anyway" on mobile.
   */
  constrainedByMemory: boolean;
}

/**
 * Check source image pixel dimensions against the per-scale limit.
 * Reads a File via createObjectURL; resolves with a SizeCheck.
 *
 * When budgetMB is provided (should come from deviceMemoryBudgetMB()), the
 * limit is computed from the device memory budget rather than the desktop cap,
 * and constrainedByMemory is set to true.
 */
export function checkImageSize(file: File, scale: 2 | 4, budgetMB?: number): Promise<SizeCheck> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const mp = (w * h) / 1_000_000;

      // Choose the tighter of: device memory budget limit vs desktop cap
      const desktopLimit = MAX_MEGAPIXELS[scale];
      let limit: number;
      let constrainedByMemory = false;

      if (budgetMB !== undefined) {
        const memLimit = safeInputMegapixels(scale, budgetMB);
        if (memLimit < desktopLimit) {
          limit = memLimit;
          constrainedByMemory = true;
        } else {
          limit = desktopLimit;
        }
      } else {
        limit = desktopLimit;
      }

      if (mp <= limit) {
        resolve({
          width: w,
          height: h,
          megapixels: mp,
          tooLarge: false,
          clampedWidth: null,
          clampedHeight: null,
          constrainedByMemory,
        });
      } else {
        // Scale down to stay within limit
        const ratio = Math.sqrt(limit / mp);
        resolve({
          width: w,
          height: h,
          megapixels: mp,
          tooLarge: true,
          clampedWidth: Math.round(w * ratio),
          clampedHeight: Math.round(h * ratio),
          constrainedByMemory,
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
