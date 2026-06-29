/**
 * Pure GIF encoding helpers built on gifenc.
 * This module is isolated so unit tests can import it without a DOM.
 */

export { clamp } from "@junkyardsh/ui";

/**
 * Estimate output GIF size in bytes for given dimensions, frame count, and delay.
 * Based on empirical ~2 bits/pixel after quantization (conservative; real GIFs vary widely).
 * Returns null if inputs are invalid.
 */
export function estimateGifBytes(width: number, height: number, frameCount: number): number | null {
  if (width <= 0 || height <= 0 || frameCount <= 0) return null;
  // ~2 bits/pixel per frame after LZW + palette overhead ~1 KB per frame
  const pixelsPerFrame = width * height;
  const bitsPerPixel = 2;
  const bytesPerFrame = Math.ceil((pixelsPerFrame * bitsPerPixel) / 8) + 1024;
  // Plus ~800 bytes GIF header/trailer
  return bytesPerFrame * frameCount + 800;
}

/**
 * Format total animation duration in a human-readable way.
 * e.g. 2500ms -> "2.5 s", 600ms -> "0.6 s"
 */
export function formatDuration(totalMs: number): string {
  if (totalMs < 1000) return `${totalMs} ms`;
  return `${(totalMs / 1000).toFixed(1)} s`;
}

/**
 * Draw text overlay onto a canvas context. Returns the same ctx.
 * Text is rendered at the bottom-center of the image.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!text) return;
  const fontSize = Math.max(12, Math.round(canvasHeight * 0.07));
  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const padding = 8;
  const textWidth = ctx.measureText(text).width;
  const boxW = textWidth + padding * 2;
  const boxH = fontSize + padding * 2;
  const bx = (canvasWidth - boxW) / 2;
  const by = canvasHeight - boxH - 4;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, canvasWidth / 2, canvasHeight - 4 - padding);
  ctx.restore();
}

/**
 * Centiseconds that the GIF spec uses per-frame (100ths of a second).
 * ezgif defaults to 10cs = 100ms; we expose ms to users and convert here.
 */
export function msToCentiseconds(ms: number): number {
  return Math.round(clamp(ms, 20, 60000) / 10);
}

/** Human-readable FPS label for a given delay in ms. */
export function msToFpsLabel(ms: number): string {
  const fps = 1000 / ms;
  if (fps >= 10) return `${fps.toFixed(0)} fps`;
  return `${fps.toFixed(1)} fps`;
}

/** Generate a collision-safe ID string. */
export function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

/** A single GIF frame as held in state. */
export interface GifFrame {
  id: string;
  file: File;
  previewUrl: string;
  /** Per-frame delay override in ms, or null to use global. */
  delayMs: number | null;
  /** Natural pixel dimensions of the image. */
  width: number;
  height: number;
}

/** Given a list of frames and a global delay, resolve each frame's effective ms. */
export function resolveDelay(frame: GifFrame, globalMs: number): number {
  return frame.delayMs !== null ? frame.delayMs : globalMs;
}

/**
 * Build ImageData from a File by drawing to an offscreen canvas,
 * scaling to fit within maxDim on the longest axis.
 * Optional caption is rendered at the bottom of the frame.
 */
export async function fileToImageData(
  file: File,
  maxDim: number,
  caption?: string
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      if (caption) drawCaption(ctx, caption, w, h);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Extract frames from a video File via an offscreen <video> element.
 * Seeks to evenly-spaced timestamps and snapshots each frame.
 * Returns an array of { blob, width, height } for each extracted frame.
 */
export async function extractVideoFrames(
  file: File,
  frameCount: number,
  maxDim: number
): Promise<{ blob: Blob; width: number; height: number }[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read video duration"));
        return;
      }

      const scale = Math.min(
        1,
        maxDim / Math.max(video.videoWidth || 640, video.videoHeight || 480)
      );
      const w = Math.round((video.videoWidth || 640) * scale);
      const h = Math.round((video.videoHeight || 480) * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("No 2D context"));
        return;
      }

      const timestamps: number[] = [];
      for (let i = 0; i < frameCount; i++) {
        // Evenly space within the video, avoid t=0 which may show blank frame
        timestamps.push((duration * (i + 0.5)) / frameCount);
      }

      const results: { blob: Blob; width: number; height: number }[] = [];

      const captureNext = (idx: number) => {
        if (idx >= timestamps.length) {
          URL.revokeObjectURL(url);
          resolve(results);
          return;
        }
        video.currentTime = timestamps[idx];
      };

      video.onseeked = () => {
        const idx = results.length;
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) results.push({ blob, width: w, height: h });
            captureNext(idx + 1);
          },
          "image/png",
          1
        );
      };

      captureNext(0);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };

    video.src = url;
  });
}

/**
 * Encode frames to a GIF Blob using gifenc.
 * All frames are scaled to fit within maxDim, then cropped/padded to
 * the first frame's output dimensions.
 * Optional caption string is burned into each frame at encode time.
 */
export async function encodeGif(
  frames: GifFrame[],
  globalDelayMs: number,
  loops: number,
  maxDim: number,
  caption?: string
): Promise<Blob> {
  if (frames.length === 0) throw new Error("No frames to encode");

  // Dynamic import so bundle only loads gifenc when encoding is actually triggered.
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");

  // Determine canvas dimensions from first frame
  const firstData = await fileToImageData(frames[0].file, maxDim, caption);
  const W = firstData.width;
  const H = firstData.height;

  const enc = GIFEncoder();

  for (const frame of frames) {
    const imageData = await fileToImageData(frame.file, maxDim, caption);
    // Crop / zero-pad to first-frame dimensions
    const rgba = new Uint8Array(W * H * 4);
    const srcW = imageData.width;
    const srcH = imageData.height;
    const copyW = Math.min(W, srcW);
    const copyH = Math.min(H, srcH);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        const si = (y * srcW + x) * 4;
        const di = (y * W + x) * 4;
        rgba[di] = imageData.data[si];
        rgba[di + 1] = imageData.data[si + 1];
        rgba[di + 2] = imageData.data[si + 2];
        rgba[di + 3] = imageData.data[si + 3];
      }
    }

    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    const delay = msToCentiseconds(resolveDelay(frame, globalDelayMs));

    enc.writeFrame(index, W, H, {
      palette,
      delay,
      repeat: loops,
    });
  }

  enc.finish();
  const bytes = enc.bytes();
  // Copy into a fresh Uint8Array backed by a plain ArrayBuffer (no SharedArrayBuffer)
  const plain = new Uint8Array(bytes.length);
  plain.set(bytes);
  return new Blob([plain], { type: "image/gif" });
}
