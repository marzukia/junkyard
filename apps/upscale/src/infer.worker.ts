import { RawImage, pipeline, env } from "@huggingface/transformers";
/**
 * Web Worker for upscale: runs model load + inference off the main thread.
 *
 * Because blob URLs created in a worker are not accessible from the main thread,
 * this worker returns the raw image bytes as an ArrayBuffer instead of a URL.
 * The main thread creates the blob URL after receiving the result.
 *
 * Shared boilerplate (env config, progress posting, error/results posting)
 * is handled via kit/lib/workerInference.ts.
 */
import type { WorkerRequest } from "@junkyardsh/ui";
import {
  loadPipeline,
  postResult,
  postError,
} from "../../../kit/lib/workerInference";
import type { OutputFormat } from "./lib/imageHelpers";
import { outputMime } from "./lib/imageHelpers";
import type { ScaleFactor } from "./lib/upscale";
import { MODEL_ID } from "./lib/upscale";

type ImageToImagePipeline = (
  input: RawImage,
  options?: Record<string, unknown>
) => Promise<RawImage>;
let upscaler: ImageToImagePipeline | null = null;

export type UpscaleWorkerResult = {
  imageBytes: ArrayBuffer;
  width: number;
  height: number;
  resultSize: number;
  format: OutputFormat;
};

type Args = {
  file: File;
  scale: ScaleFactor;
  format: OutputFormat;
  quality: number;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file, scale, format, quality } = e.data.args;

  try {
    if (!upscaler) {
      upscaler = await loadPipeline<ImageToImagePipeline>(env,
        async (progressCb) => {
          return (await (
            pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
          )("image-to-image", MODEL_ID, {
            progress_callback: progressCb,
          })) as ImageToImagePipeline;
        }
      );
    }

    const srcUrl = URL.createObjectURL(file);
    let rawImage = await RawImage.fromURL(srcUrl);
    URL.revokeObjectURL(srcUrl);

    if (scale === 4) {
      const pass1 = await upscaler(rawImage);
      rawImage = pass1;
      const pass2 = await upscaler(rawImage);
      rawImage = pass2;
    } else {
      rawImage = await upscaler(rawImage);
    }

    const canvas = new OffscreenCanvas(rawImage.width, rawImage.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2d not available.");

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
    const imageBytes = await resultBlob.arrayBuffer();

    postResult<UpscaleWorkerResult>({
      imageBytes,
      width: rawImage.width,
      height: rawImage.height,
      resultSize: resultBlob.size,
      format,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during upscaling.";
    postError(message);
  }
};
