/**
 * AI super-resolution upscaling using @huggingface/transformers.
 *
 * Model: see MODEL_ID const below (~50 MB). Swin2SR trained for classical super-resolution at 2x scale.
 * For 4x we run two 2x passes.
 *
 * COOP/COEP note: GitHub Pages cannot send cross-origin isolation headers, so
 * SharedArrayBuffer is unavailable. We force numThreads=1 before loading any
 * ONNX session -- this routes entirely through the single-threaded WASM backend
 * and never touches SharedArrayBuffer. WebGPU is attempted first (no isolation
 * required); WASM single-thread is the fallback.
 */
import { RawImage, pipeline } from "@huggingface/transformers";
import { configureTransformersEnv } from "@junkyardsh/ui/ai";
import type { OutputFormat } from "./imageHelpers";
import { outputMime } from "./imageHelpers";

export const MODEL_ID = "Xenova/swin2SR-classical-sr-x2-64";
// Approx download size shown to the user.
export const MODEL_SIZE_MB = 50;

export type ScaleFactor = 2 | 4;

export type ProgressCallback = (loaded: number, total: number, status: string) => void;

type TransformersProgressEvent = {
  status: string;
  loaded?: number;
  total?: number;
};

// Pipeline type for image-to-image
type ImageToImagePipeline = (
  input: RawImage,
  options?: Record<string, unknown>
) => Promise<RawImage>;

let upscaler: ImageToImagePipeline | null = null;

/** Load (or return cached) the image-to-image pipeline. */
export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
  if (upscaler) return;
  configureTransformersEnv();

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

  upscaler = (await (
    pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
  )("image-to-image", MODEL_ID, {
    progress_callback: progressCb,
  })) as ImageToImagePipeline;
}

export interface UpscaleResult {
  /** Upscaled image as a blob URL */
  resultUrl: string;
  /** Output dimensions */
  width: number;
  height: number;
  /** Approximate output file size in bytes */
  resultSize: number;
  /** The format used for encoding */
  format: OutputFormat;
}

/**
 * Run AI super-resolution on a File. Returns a blob URL with the upscaled image.
 * For scale=4, runs two 2x passes through the model.
 * The output format defaults to PNG; pass format="jpeg" or "webp" for smaller files.
 * JPEG/WebP quality defaults to 0.88.
 */
export async function upscaleImage(
  file: File,
  scale: ScaleFactor,
  format: OutputFormat = "png",
  quality = 0.88
): Promise<UpscaleResult> {
  if (!upscaler) throw new Error("Model not loaded -- call loadModel() first.");

  // Load the source image as a RawImage
  const srcUrl = URL.createObjectURL(file);
  let rawImage = await RawImage.fromURL(srcUrl);
  URL.revokeObjectURL(srcUrl);

  // Run once for 2x, twice for 4x.
  // For 4x: dispose the pass-1 output after promoting it to rawImage so the
  // JS engine can GC the intermediate buffer before pass 2 allocates its own.
  if (scale === 4) {
    const pass1 = await upscaler(rawImage);
    // rawImage (the source) is no longer needed; drop the reference so it can
    // be collected before the second pass allocates a new output tensor.
    rawImage = pass1;
    const pass2 = await upscaler(rawImage);
    rawImage = pass2;
  } else {
    rawImage = await upscaler(rawImage);
  }

  // Convert RawImage back to a blob URL via canvas
  const canvas = new OffscreenCanvas(rawImage.width, rawImage.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d not available.");

  // Swin2SR outputs a 3-channel RGB RawImage. ImageData requires 4-channel RGBA
  // (width * height * 4 bytes). Convert to RGBA via RawImage.rgba() before
  // constructing ImageData, otherwise the ImageData constructor throws a
  // DOMException for wrong data length.
  const rgbaImage =
    (rawImage as unknown as { channels: number; rgba(): typeof rawImage }).channels === 4
      ? rawImage
      : (rawImage as unknown as { rgba(): typeof rawImage }).rgba();
  const clampedData = new Uint8ClampedArray(
    (rgbaImage.data as unknown as ArrayLike<number> & { buffer?: ArrayBuffer }).buffer ??
      Array.from(rgbaImage.data as unknown as ArrayLike<number>)
  );
  const imageData = new ImageData(clampedData, rgbaImage.width, rgbaImage.height);
  ctx.putImageData(imageData, 0, 0);

  const mime = outputMime(format);
  const encodeOptions: ImageEncodeOptions = { type: mime };
  if (format !== "png") encodeOptions.quality = quality;
  const resultBlob = await canvas.convertToBlob(encodeOptions);
  const resultUrl = URL.createObjectURL(resultBlob);

  return {
    resultUrl,
    width: rawImage.width,
    height: rawImage.height,
    resultSize: resultBlob.size,
    format,
  };
}

/** Revoke a blob URL returned by upscaleImage(). */
export function revokeResult(url: string): void {
  URL.revokeObjectURL(url);
}

/** True if the model is already loaded and cached. */
export function isModelLoaded(): boolean {
  return upscaler !== null;
}
