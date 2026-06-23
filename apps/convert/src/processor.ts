/**
 * Conversion processor — calls heic2any (for HEIC/HEIF) or
 * browser-image-compression for everything else, then optionally
 * resizes via canvas.
 */
import imageCompression from "browser-image-compression";
import heic2any from "heic2any";
import {
  bitmapToBlob,
  computeOutputDimensions,
  formatToMime,
  isHeic,
  outputFilename,
} from "./convert";
import type { ConvertOptions } from "./convert";

export interface ProcessResult {
  blob: Blob;
  name: string;
  size: number;
  url: string;
}

/** Whether any resize is requested (any mode). */
function needsResize(opts: ConvertOptions): boolean {
  return opts.maxDimension > 0 || opts.exactWidth > 0 || opts.exactHeight > 0 || opts.scalePct > 0;
}

/**
 * Decode a Blob to an ImageBitmap, apply resize+format via canvas.
 * Used for HEIC post-decode resize and AVIF encode (canvas path only).
 */
async function blobToBitmapToBlob(
  blob: Blob,
  opts: ConvertOptions,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Failed to load decoded image for resize"));
    img.src = url;
  });
  const bitmap = await createImageBitmap(img);
  URL.revokeObjectURL(url);
  const result = await bitmapToBlob(bitmap, opts);
  bitmap.close();
  onProgress?.(100);
  return result;
}

export async function processFile(
  file: File,
  opts: ConvertOptions,
  onProgress?: (pct: number) => void
): Promise<ProcessResult> {
  const { format, quality } = opts;
  let blob: Blob;

  if (isHeic(file)) {
    // heic2any decodes HEIC → PNG/JPEG/WEBP Blob directly (no AVIF support)
    // For AVIF output from HEIC, decode to PNG first then re-encode via canvas
    const toType = format === "avif" ? "PNG" : format === "jpg" ? "JPEG" : format.toUpperCase();
    const result = await heic2any({
      blob: file,
      toType,
      quality: quality / 100,
    });
    blob = Array.isArray(result) ? result[0] : result;
    onProgress?.(needsResize(opts) || format === "avif" ? 60 : 100);

    if (needsResize(opts) || format === "avif") {
      blob = await blobToBitmapToBlob(blob, opts, onProgress);
    }
  } else if (format === "avif") {
    // AVIF encode must go through canvas (browser-image-compression doesn't support AVIF)
    // First check that the browser actually supports AVIF canvas encoding. canvas.toBlob
    // silently falls back to PNG on browsers that lack AVIF encode support, which would
    // produce a PNG file saved under a .avif filename. We detect the fallback by verifying
    // the returned blob's MIME type matches what was requested.
    onProgress?.(10);

    // Quick 1x1 capability probe (async, reliable -- no UA sniffing)
    const canAvif = await new Promise<boolean>((resolve) => {
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      probe.toBlob((b) => resolve(b !== null && b.type === "image/avif"), "image/avif", 0.5);
    });
    if (!canAvif) {
      throw new Error(
        "AVIF encode failed: browser does not support AVIF canvas output -- try Chrome 94+ or Firefox 113+"
      );
    }

    let sourceBitmap: ImageBitmap;
    try {
      sourceBitmap = await createImageBitmap(file);
    } catch {
      throw new Error("Could not decode image for AVIF conversion");
    }

    // Compute output dimensions upfront to pass to bitmapToBlob
    const { w, h } = computeOutputDimensions(sourceBitmap.width, sourceBitmap.height, opts);
    onProgress?.(50);

    // Use a temporary canvas to get the correctly-sized bitmap
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(sourceBitmap, 0, 0, w, h);
    sourceBitmap.close();

    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error("AVIF encode failed: canvas.toBlob returned null"));
            return;
          }
          // Double-check the browser didn't silently fall back to another format
          if (b.type !== "image/avif") {
            reject(
              new Error(`AVIF encode failed: browser returned a non-AVIF blob (type: ${b.type})`)
            );
            return;
          }
          resolve(b);
        },
        "image/avif",
        quality / 100
      );
    });
    onProgress?.(100);
  } else {
    // Non-HEIC, non-AVIF: use browser-image-compression for size reduction / resize
    const mime = formatToMime(format);
    const options: Parameters<typeof imageCompression>[1] = {
      maxSizeMB: 50,
      useWebWorker: true,
      fileType: mime,
      initialQuality: quality / 100,
      onProgress,
    };
    if (opts.maxDimension > 0 && !opts.exactWidth && !opts.exactHeight && !opts.scalePct) {
      options.maxWidthOrHeight = opts.maxDimension;
    } else if (needsResize(opts)) {
      // For exact/scale resize: do it via canvas after compression
      // browser-image-compression handles quality; we then resize
      const compressed = await imageCompression(file, options);
      blob = await blobToBitmapToBlob(compressed, opts);
      const name = outputFilename(file.name, format);
      const url = URL.createObjectURL(blob);
      return { blob, name, size: blob.size, url };
    }
    blob = await imageCompression(file, options);
  }

  const name = outputFilename(file.name, format);
  const url = URL.createObjectURL(blob);
  return { blob, name, size: blob.size, url };
}
