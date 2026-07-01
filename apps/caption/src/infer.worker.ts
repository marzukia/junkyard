/**
 * Web Worker for caption: runs model load + inference off the main thread.
 *
 * Shared boilerplate (env config, progress posting, error/results posting)
 * is handled via kit/lib/workerInference.ts.
 */
import { RawImage, env, pipeline } from "@huggingface/transformers";
import type { WorkerRequest } from "@junkyardsh/kit";
import { loadPipeline, postError, postResult } from "../../../kit/lib/workerInference";
import type { CaptionResult } from "./lib/captioner";
import { MODEL_ID } from "./lib/captioner";

type ImageToTextPipeline = (
  input: RawImage | string,
  options?: Record<string, unknown>
) => Promise<Array<{ generated_text: string }>>;

let captioner: ImageToTextPipeline | null = null;

function isModelLoaded(): boolean {
  return captioner !== null;
}

async function prepareRawImage(file: File): Promise<{ rawImage: RawImage; blobUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(224, 224);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d not available.");
  ctx.drawImage(bitmap, 0, 0, 224, 224);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const blobUrl = URL.createObjectURL(blob);
  const rawImage = await RawImage.fromURL(blobUrl);
  return { rawImage, blobUrl };
}

async function captionImage(file: File, numCaptions = 1): Promise<CaptionResult> {
  if (!captioner) throw new Error("Model not loaded, call loadModel() first.");
  const { rawImage, blobUrl } = await prepareRawImage(file);
  try {
    const n = Math.max(1, Math.min(numCaptions, 5));
    const options: Record<string, unknown> =
      n === 1
        ? { max_new_tokens: 50 }
        : {
            max_new_tokens: 50,
            num_beams: n,
            num_return_sequences: n,
          };
    const result = await captioner(rawImage, options);
    const texts = (Array.isArray(result) ? result : [])
      .map((r) => r.generated_text?.trim() ?? "")
      .filter(Boolean);
    if (texts.length === 0) throw new Error("Model returned an empty caption.");
    const [primary, ...rest] = texts;
    return { caption: primary, candidates: rest };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

type Args = {
  file: File;
  numCaptions: number;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file, numCaptions } = e.data.args;

  try {
    if (!isModelLoaded()) {
      captioner = await loadPipeline<ImageToTextPipeline>(env, async (progressCb) => {
        return (await (
          pipeline as (
            task: string,
            model: string,
            opts: Record<string, unknown>
          ) => Promise<unknown>
        )("image-to-text", MODEL_ID, {
          progress_callback: progressCb,
        })) as ImageToTextPipeline;
      });
    }

    const result = await captionImage(file, numCaptions);
    postResult<CaptionResult>(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during captioning.";
    postError(message);
  }
};
