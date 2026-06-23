/**
 * Web Worker for upscale: runs model load + inference off the main thread.
 *
 * Because blob URLs created in a worker are not accessible from the main thread,
 * this worker returns the raw image bytes as an ArrayBuffer instead of a URL.
 * The main thread creates the blob URL after receiving the result.
 */
import type { WorkerMsg, WorkerRequest } from "./lib/workerTask";
import { RawImage, pipeline } from "@huggingface/transformers";
import { configureTransformersEnv } from "./lib/transformersEnv";
import type { OutputFormat } from "./lib/imageHelpers";
import { outputMime } from "./lib/imageHelpers";
import type { ScaleFactor } from "./lib/upscale";
import { MODEL_ID } from "./lib/upscale";

type ImageToImagePipeline = (input: RawImage, options?: Record<string, unknown>) => Promise<RawImage>;
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

type TransformersProgressEvent = { status: string; loaded?: number; total?: number };

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file, scale, format, quality } = e.data.args;

  try {
    if (!upscaler) {
    configureTransformersEnv();
      upscaler = (await (pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>)(
        "image-to-image",
        MODEL_ID,
        {
          progress_callback: (event: TransformersProgressEvent) => {
            if (event.status === "progress" || event.status === "download") {
              const msg: WorkerMsg<UpscaleWorkerResult> = {
                type: "progress",
                loaded: event.loaded ?? 0,
                total: event.total ?? 1,
                status: event.status,
              };
              self.postMessage(msg);
            } else if (event.status === "initiate") {
              const msg: WorkerMsg<UpscaleWorkerResult> = { type: "progress", loaded: 0, total: 1, status: "initiate" };
              self.postMessage(msg);
            } else if (event.status === "done") {
              const msg: WorkerMsg<UpscaleWorkerResult> = { type: "progress", loaded: 1, total: 1, status: "done" };
              self.postMessage(msg);
            }
          },
        }
      )) as ImageToImagePipeline;
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

    const msg: WorkerMsg<UpscaleWorkerResult> = {
      type: "result",
      payload: { imageBytes, width: rawImage.width, height: rawImage.height, resultSize: resultBlob.size, format },
    };
    self.postMessage(msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during upscaling.";
    const msg: WorkerMsg<UpscaleWorkerResult> = { type: "error", message };
    self.postMessage(msg);
  }
};
