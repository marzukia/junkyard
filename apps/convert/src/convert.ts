/**
 * Pure conversion utilities — no React, no side effects.
 * These are the functions unit tests target.
 */

export type OutputFormat = "jpg" | "png" | "webp" | "avif";

export interface ConvertOptions {
  format: OutputFormat;
  /** 0–100 */
  quality: number;
  /** max dimension (width or height) in px; 0 = no resize */
  maxDimension: number;
  /** exact pixel width; overrides maxDimension when set */
  exactWidth: number;
  /** exact pixel height; overrides maxDimension when set */
  exactHeight: number;
  /** resize by percentage (1–200); 0 = disabled */
  scalePct: number;
}

/** Guess whether a File is HEIC/HEIF by MIME type or extension. */
export function isHeic(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime === "image/heic" || mime === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

/** Map an OutputFormat to the canonical MIME type string. */
export function formatToMime(format: OutputFormat): string {
  switch (format) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
  }
}

/**
 * Returns true if the browser can encode to AVIF via canvas.toBlob.
 * Uses a real round-trip probe (1x1 canvas) rather than UA sniffing.
 * Result is cached after the first call.
 */
let _avifProbeResult: boolean | null = null;

export async function canEncodeAvif(): Promise<boolean> {
  if (_avifProbeResult !== null) return _avifProbeResult;
  if (typeof document === "undefined") {
    _avifProbeResult = false;
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    // Wrap in a race so environments where toBlob never calls back (e.g. jsdom)
    // resolve to false rather than hanging indefinitely.
    const blob = await Promise.race<Blob | null>([
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/avif", 0.5);
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ]);
    _avifProbeResult = blob !== null && blob.type === "image/avif";
  } catch {
    _avifProbeResult = false;
  }
  return _avifProbeResult;
}

/** Reset the cached AVIF probe result (for testing). */
export function _resetAvifProbeCache(): void {
  _avifProbeResult = null;
}

/** Derive the output filename: swap extension, preserve stem. */
export function outputFilename(inputName: string, format: OutputFormat): string {
  const dot = inputName.lastIndexOf(".");
  const stem = dot >= 0 ? inputName.slice(0, dot) : inputName;
  const ext = format === "jpg" ? "jpg" : format;
  return `${stem}.${ext}`;
}

/**
 * Validate that a File is a real, readable image by attempting createImageBitmap
 * on the first 4 KB (magic-bytes check) and, for non-HEIC files, via a bitmap decode.
 * Returns null on success, or a human-readable reason string on failure.
 *
 * For HEIC we can only check magic bytes and extension since the browser cannot
 * natively decode HEIC; heic2any will do the real decode later.
 */
export async function validateImageFile(file: File): Promise<string | null> {
  // Check file is non-empty
  if (file.size === 0) return "File is empty";

  // Check magic bytes for common formats
  const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  // JPEG: FF D8
  const isJpegMagic = headerBytes[0] === 0xff && headerBytes[1] === 0xd8;
  // PNG: 89 50 4E 47
  const isPngMagic =
    headerBytes[0] === 0x89 &&
    headerBytes[1] === 0x50 &&
    headerBytes[2] === 0x4e &&
    headerBytes[3] === 0x47;
  // WebP: RIFF....WEBP
  const isWebpMagic =
    headerBytes[0] === 0x52 &&
    headerBytes[1] === 0x49 &&
    headerBytes[2] === 0x46 &&
    headerBytes[3] === 0x46 &&
    headerBytes[8] === 0x57 &&
    headerBytes[9] === 0x45 &&
    headerBytes[10] === 0x42 &&
    headerBytes[11] === 0x50;
  // GIF87a / GIF89a
  const isGifMagic = headerBytes[0] === 0x47 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46;
  // BMP: BM
  const isBmpMagic = headerBytes[0] === 0x42 && headerBytes[1] === 0x4d;
  // AVIF / HEIC / HEIF: ftyp box at offset 4 (bytes 4-7 = "ftyp")
  const isFtypBox =
    headerBytes[4] === 0x66 &&
    headerBytes[5] === 0x74 &&
    headerBytes[6] === 0x79 &&
    headerBytes[7] === 0x70;

  const name = file.name.toLowerCase();
  const isHeicExt = name.endsWith(".heic") || name.endsWith(".heif");
  const isAvifExt = name.endsWith(".avif");

  if (isHeicExt || isAvifExt || file.type === "image/heic" || file.type === "image/heif") {
    // For HEIC/AVIF we verify the ftyp box; we can't do a full decode without heic2any
    if (!isFtypBox && file.size > 16) {
      return "Not a valid HEIC/AVIF file (missing ftyp box)";
    }
    return null;
  }

  const knownMagic =
    isJpegMagic || isPngMagic || isWebpMagic || isGifMagic || isBmpMagic || isFtypBox;

  if (!knownMagic) {
    // For unknown magic, still try createImageBitmap as a last resort
    try {
      const bm = await createImageBitmap(file);
      bm.close();
      return null;
    } catch {
      return "Not a recognisable image file";
    }
  }

  // For files with known magic, attempt a quick decode to catch truncated/corrupt files
  try {
    const bm = await createImageBitmap(file);
    bm.close();
    return null;
  } catch {
    return "File appears corrupt or truncated";
  }
}

export { formatBytes } from "@junkyardsh/kit";

/**
 * Build a ZIP archive (store, no compression) from an array of named blobs.
 * Uses only platform APIs — no third-party library required.
 */
export async function buildZip(entries: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  // ZIP spec: local file header + data, then central directory, then end of central directory
  const enc = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralEntries: Uint8Array[] = [];
  let offset = 0;

  for (const { name, blob } of entries) {
    const nameBytes = enc.encode(name);
    const data = new Uint8Array(await blob.arrayBuffer());
    const crc = crc32(data);

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true); // signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // compression: store
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, 0, true); // mod date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    // Central directory entry
    const central = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(central.buffer);
    cdv.setUint32(0, 0x02014b50, true); // signature
    cdv.setUint16(4, 20, true); // version made by
    cdv.setUint16(6, 20, true); // version needed
    cdv.setUint16(8, 0, true); // flags
    cdv.setUint16(10, 0, true); // compression
    cdv.setUint16(12, 0, true); // mod time
    cdv.setUint16(14, 0, true); // mod date
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, data.length, true);
    cdv.setUint32(24, data.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true); // extra length
    cdv.setUint16(32, 0, true); // comment length
    cdv.setUint16(34, 0, true); // disk number
    cdv.setUint16(36, 0, true); // int file attr
    cdv.setUint32(38, 0, true); // ext file attr
    cdv.setUint32(42, offset, true); // local header offset
    central.set(nameBytes, 46);

    localHeaders.push(local, data);
    centralEntries.push(central);
    offset += local.length + data.length;
  }

  const centralDir = concat(centralEntries);
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, centralDir.length, true);
  edv.setUint32(16, offset, true);
  edv.setUint16(20, 0, true);

  const all = concat([...localHeaders, centralDir, eocd]);
  return new Blob([all.buffer as ArrayBuffer], { type: "application/zip" });
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) {
    out.set(a, pos);
    pos += a.length;
  }
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Compute output dimensions given source dimensions and resize options.
 * Priority: exactWidth/exactHeight > scalePct > maxDimension.
 */
export function computeOutputDimensions(
  srcW: number,
  srcH: number,
  opts: Pick<ConvertOptions, "maxDimension" | "exactWidth" | "exactHeight" | "scalePct">
): { w: number; h: number } {
  const { exactWidth, exactHeight, scalePct, maxDimension } = opts;

  if (exactWidth > 0 || exactHeight > 0) {
    // Aspect-locked exact dimension
    if (exactWidth > 0 && exactHeight > 0) {
      return { w: exactWidth, h: exactHeight };
    }
    if (exactWidth > 0) {
      return { w: exactWidth, h: Math.round((srcH / srcW) * exactWidth) };
    }
    return { w: Math.round((srcW / srcH) * exactHeight), h: exactHeight };
  }

  if (scalePct > 0) {
    const f = scalePct / 100;
    return { w: Math.round(srcW * f), h: Math.round(srcH * f) };
  }

  if (maxDimension > 0 && (srcW > maxDimension || srcH > maxDimension)) {
    const ratio = Math.min(maxDimension / srcW, maxDimension / srcH);
    return { w: Math.round(srcW * ratio), h: Math.round(srcH * ratio) };
  }

  return { w: srcW, h: srcH };
}

/**
 * Draw an ImageBitmap onto a canvas with optional resize, then export as a Blob.
 * This is the low-level canvas path — called after HEIC decoding or for
 * direct format conversion where browser-image-compression isn't needed.
 */
export function bitmapToBlob(bitmap: ImageBitmap, opts: ConvertOptions): Promise<Blob> {
  const { format, quality } = opts;

  const { w, h } = computeOutputDimensions(bitmap.width, bitmap.height, opts);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2D context unavailable"));
  ctx.drawImage(bitmap, 0, 0, w, h);

  const mime = formatToMime(format);
  const q = quality / 100;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("canvas.toBlob returned null"));
          return;
        }
        // Detect silent format fallback: browsers that lack AVIF encode return a PNG blob
        // with type "image/png" instead of rejecting or returning null.
        if (blob.type !== mime) {
          reject(
            new Error(
              `AVIF encode failed: browser returned ${blob.type} instead of ${mime} -- try Chrome 94+ or Firefox 113+`
            )
          );
          return;
        }
        resolve(blob);
      },
      mime,
      q
    );
  });
}
