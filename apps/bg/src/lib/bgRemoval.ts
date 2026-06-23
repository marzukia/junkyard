/**
 * Background removal using @huggingface/transformers with RMBG-1.4.
 *
 * COOP/COEP note: GitHub Pages cannot send cross-origin isolation headers, so
 * SharedArrayBuffer is unavailable. We force numThreads=1 before loading any
 * ONNX session — this routes entirely through the single-threaded WASM backend
 * and never touches SharedArrayBuffer. WebGPU is attempted first (no isolation
 * required for WebGPU); WASM single-thread is the fallback.
 */
import { type ImageSegmentationPipeline, RawImage, env, pipeline } from "@huggingface/transformers";

// ── Disable multi-threaded WASM (requires SharedArrayBuffer / COOP+COEP) ──────
// Must be set BEFORE any InferenceSession is created.
(env.backends as unknown as { onnx: { wasm: { numThreads: number } } }).onnx.wasm.numThreads = 1;

// Use browser cache so subsequent visits skip the download.
env.useBrowserCache = true;

const MODEL_ID = "briaai/RMBG-1.4";

// Maximum edge length before downscaling for inference (avoids OOM on huge images)
const MAX_INFER_SIDE = 1024;

export type ProgressCallback = (loaded: number, total: number, status: string) => void;

type TransformersProgressEvent = {
  status: string;
  loaded?: number;
  total?: number;
};

let segmenter: ImageSegmentationPipeline | null = null;

/** Load (or return cached) the segmentation pipeline. */
export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
  if (segmenter) return;

  const progressCb = (event: TransformersProgressEvent) => {
    if (!onProgress) return;
    if (event.status === "progress" || event.status === "download") {
      onProgress(event.loaded ?? 0, event.total ?? 1, event.status);
    } else if (event.status === "initiate") {
      onProgress(0, 1, "initiate");
    } else if (event.status === "done") {
      onProgress(1, 1, "done");
    }
  };

  // The pipeline() return type is a wide union — cast via unknown to the
  // concrete type we need. skipLibCheck can't help here since the error is in
  // our own code. This is safe: "image-segmentation" always returns
  // ImageSegmentationPipeline per the transformers.js docs.
  segmenter = (await (
    pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
  )("image-segmentation", MODEL_ID, {
    progress_callback: progressCb,
  })) as ImageSegmentationPipeline;
}

export interface RemovalResult {
  /** Transparent PNG as a blob URL */
  resultUrl: string;
  /** Original image dimensions */
  width: number;
  height: number;
}

/** Remove background from an image file. Returns a blob URL with transparency. */
export async function removeBackground(file: File): Promise<RemovalResult> {
  if (!segmenter) throw new Error("Model not loaded. Call loadModel() first.");

  const bitmap = await createImageBitmap(file);
  const origW = bitmap.width;
  const origH = bitmap.height;

  // Downscale for inference if needed (keeps memory sane for large photos)
  const scale = Math.min(1, MAX_INFER_SIDE / Math.max(origW, origH));
  const inferW = Math.round(origW * scale);
  const inferH = Math.round(origH * scale);

  const inferCanvas = new OffscreenCanvas(inferW, inferH);
  const ctx2d = inferCanvas.getContext("2d");
  if (!ctx2d) throw new Error("OffscreenCanvas 2d not available.");
  ctx2d.drawImage(bitmap, 0, 0, inferW, inferH);
  const blob = await inferCanvas.convertToBlob({ type: "image/png" });

  // Build a RawImage from the blob
  const imgUrl = URL.createObjectURL(blob);
  const rawImage = await RawImage.fromURL(imgUrl);
  URL.revokeObjectURL(imgUrl);

  // Run segmentation — RMBG-1.4 returns [{label, score, mask}]
  const result = await segmenter(rawImage);

  const segments = Array.isArray(result) ? result : [result];
  if (segments.length === 0) {
    throw new Error("Segmentation returned no masks.");
  }

  // RMBG-1.4 returns a single foreground mask
  const mask = segments[0].mask;
  if (!mask) throw new Error("Segmentation mask is missing.");

  // Composite: draw original at full resolution, apply mask at matching size
  const outCanvas = new OffscreenCanvas(origW, origH);
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("OffscreenCanvas 2d not available.");

  // Draw original
  outCtx.drawImage(bitmap, 0, 0, origW, origH);
  bitmap.close();

  // Get pixel data and apply mask
  const imageData = outCtx.getImageData(0, 0, origW, origH);
  const pixels = imageData.data;

  // mask is H×W single-channel; upscale mask coordinates to original size
  const maskData = mask.data as Uint8Array;
  const maskH = mask.height;
  const maskW = mask.width;

  for (let py = 0; py < origH; py++) {
    for (let px = 0; px < origW; px++) {
      // Nearest-neighbour map back to mask coords
      const my = Math.min(Math.round((py / origH) * maskH), maskH - 1);
      const mx = Math.min(Math.round((px / origW) * maskW), maskW - 1);
      const alpha = maskData[my * maskW + mx];
      pixels[(py * origW + px) * 4 + 3] = alpha;
    }
  }

  outCtx.putImageData(imageData, 0, 0);

  const resultBlob = await outCanvas.convertToBlob({ type: "image/png" });
  const resultUrl = URL.createObjectURL(resultBlob);

  return { resultUrl, width: origW, height: origH };
}

/** Revoke a blob URL returned by removeBackground(). */
export function revokeResult(url: string): void {
  URL.revokeObjectURL(url);
}

/** True if the model is already loaded (cached). */
export function isModelLoaded(): boolean {
  return segmenter !== null;
}
