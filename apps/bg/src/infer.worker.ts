import { type ImageSegmentationPipeline, RawImage, pipeline, env } from "@huggingface/transformers";
/**
 * Web Worker for bg (background removal): runs model load + inference off the main thread.
 * Returns image bytes as ArrayBuffer (blob URLs don't cross worker boundaries).
 *
 * Shared boilerplate (env config, progress posting, error/results posting)
 * is handled via kit/lib/workerInference.ts.
 */
import type { WorkerRequest } from "@junkyardsh/kit";
import {
  loadPipeline,
  postResult,
  postError,
} from "../../../kit/lib/workerInference";
import { MAX_INFER_SIDE, MODEL_ID } from "./lib/bgConstants";

let segmenter: ImageSegmentationPipeline | null = null;

export type BgWorkerResult = {
  imageBytes: ArrayBuffer;
  width: number;
  height: number;
};

type Args = {
  file: File;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file } = e.data.args;

  try {
    if (!segmenter) {
      segmenter = await loadPipeline<ImageSegmentationPipeline>(env,
        async (progressCb) => {
          return (await (
            pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
          )("image-segmentation", MODEL_ID, {
            progress_callback: progressCb,
          })) as ImageSegmentationPipeline;
        }
      );
    }

    const bitmap = await createImageBitmap(file);
    const origW = bitmap.width;
    const origH = bitmap.height;

    // Downscale for inference if needed
    const maxSide = Math.max(origW, origH);
    let inferW = origW;
    let inferH = origH;
    if (maxSide > MAX_INFER_SIDE) {
      const scale = MAX_INFER_SIDE / maxSide;
      inferW = Math.round(origW * scale);
      inferH = Math.round(origH * scale);
    }

    const inferCanvas = new OffscreenCanvas(inferW, inferH);
    const inferCtx = inferCanvas.getContext("2d");
    if (!inferCtx) throw new Error("OffscreenCanvas 2d not available.");
    inferCtx.drawImage(bitmap, 0, 0, inferW, inferH);

    const inferBlob = await inferCanvas.convertToBlob({ type: "image/png" });
    const imgUrl = URL.createObjectURL(inferBlob);
    const rawImage = await RawImage.fromURL(imgUrl);
    URL.revokeObjectURL(imgUrl);

    const result = await segmenter(rawImage);
    const segments = Array.isArray(result) ? result : [result];
    if (segments.length === 0) throw new Error("Segmentation returned no masks.");

    const mask = segments[0].mask;
    if (!mask) throw new Error("Segmentation mask is missing.");

    const outCanvas = new OffscreenCanvas(origW, origH);
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) throw new Error("OffscreenCanvas 2d not available.");
    outCtx.drawImage(bitmap, 0, 0, origW, origH);
    bitmap.close();

    const imageData = outCtx.getImageData(0, 0, origW, origH);
    const pixels = imageData.data;
    const maskData = mask.data as Uint8Array;
    const maskH = mask.height;
    const maskW = mask.width;

    for (let py = 0; py < origH; py++) {
      for (let px = 0; px < origW; px++) {
        const my = Math.min(Math.round((py / origH) * maskH), maskH - 1);
        const mx = Math.min(Math.round((px / origW) * maskW), maskW - 1);
        const alpha = maskData[my * maskW + mx];
        pixels[(py * origW + px) * 4 + 3] = alpha;
      }
    }
    outCtx.putImageData(imageData, 0, 0);

    const resultBlob = await outCanvas.convertToBlob({ type: "image/png" });
    const imageBytes = await resultBlob.arrayBuffer();

    postResult<BgWorkerResult>({ imageBytes, width: origW, height: origH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during background removal.";
    postError(message);
  }
};
