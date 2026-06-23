/**
 * Web Worker for depth: runs model load + inference off the main thread.
 * Returns image bytes (ArrayBuffer) instead of blob URL (not cross-context).
 * Also returns the raw depth cache data for colourmap re-renders without re-inference.
 */
import type { WorkerMsg, WorkerRequest } from "./lib/workerTask";
import { type DepthEstimationPipeline, RawImage, env, pipeline } from "@huggingface/transformers";
import type { ColourMap } from "./lib/depthEstimation";
import { applyColourMap } from "./lib/depthEstimation";

(env.backends as unknown as { onnx: { wasm: { numThreads: number } } }).onnx.wasm.numThreads = 1;
env.useBrowserCache = true;

const MODEL_ID = "onnx-community/depth-anything-v2-small";

type TransformersProgressEvent = { status: string; loaded?: number; total?: number };

let estimator: DepthEstimationPipeline | null = null;

export type DepthWorkerResult = {
  imageBytes: ArrayBuffer;
  width: number;
  height: number;
  /** Serialised normalised depth array for colourmap re-renders. */
  normalisedDepth: Float32Array;
};

type Args = {
  file: File;
  colourMap: ColourMap;
  invert: boolean;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file, colourMap, invert } = e.data.args;

  try {
    if (!estimator) {
      estimator = (await (pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>)(
        "depth-estimation",
        MODEL_ID,
        {
          progress_callback: (event: TransformersProgressEvent) => {
            if (event.status === "progress" || event.status === "download") {
              const msg: WorkerMsg<DepthWorkerResult> = { type: "progress", loaded: event.loaded ?? 0, total: event.total ?? 1, status: event.status };
              self.postMessage(msg);
            } else if (event.status === "initiate") {
              self.postMessage({ type: "progress", loaded: 0, total: 1, status: "initiate" } as WorkerMsg<DepthWorkerResult>);
            } else if (event.status === "done") {
              self.postMessage({ type: "progress", loaded: 1, total: 1, status: "done" } as WorkerMsg<DepthWorkerResult>);
            }
          },
        }
      )) as DepthEstimationPipeline;
    }

    const bitmap = await createImageBitmap(file);
    const origW = bitmap.width;
    const origH = bitmap.height;

    const fileUrl = URL.createObjectURL(file);
    const rawImage = await RawImage.fromURL(fileUrl);
    URL.revokeObjectURL(fileUrl);

    const output = await estimator(rawImage);
    const depthMap = (output as { depth: RawImage }).depth;
    if (!depthMap) throw new Error("Depth estimation returned no depth map.");

    const depthData = depthMap.data as Float32Array | Uint8Array;
    const depthH = depthMap.height;
    const depthW = depthMap.width;

    let dMin = Number.POSITIVE_INFINITY;
    let dMax = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < depthData.length; i++) {
      const v = depthData[i];
      if (v < dMin) dMin = v;
      if (v > dMax) dMax = v;
    }
    const dRange = dMax - dMin || 1;

    const normalised = new Float32Array(origW * origH);
    for (let py = 0; py < origH; py++) {
      for (let px = 0; px < origW; px++) {
        const dy = Math.min(Math.round((py / origH) * depthH), depthH - 1);
        const dx = Math.min(Math.round((px / origW) * depthW), depthW - 1);
        const raw = depthData[dy * depthW + dx];
        normalised[py * origW + px] = (raw - dMin) / dRange;
      }
    }
    bitmap.close();

    // Render the colourised depth map
    const outCanvas = new OffscreenCanvas(origW, origH);
    const ctx = outCanvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2d not available.");
    const imageData = ctx.createImageData(origW, origH);
    const pixels = imageData.data;
    for (let i = 0; i < normalised.length; i++) {
      const t = invert ? 1 - normalised[i] : normalised[i];
      const [r, g, b] = applyColourMap(t, colourMap);
      const idx = i * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    const blob = await outCanvas.convertToBlob({ type: "image/png" });
    const imageBytes = await blob.arrayBuffer();

    const msg: WorkerMsg<DepthWorkerResult> = {
      type: "result",
      payload: { imageBytes, width: origW, height: origH, normalisedDepth: normalised },
    };
    self.postMessage(msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during depth estimation.";
    const msg: WorkerMsg<DepthWorkerResult> = { type: "error", message };
    self.postMessage(msg);
  }
};
