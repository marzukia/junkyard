/**
 * Image captioning using @huggingface/transformers with ViT-GPT2.
 *
 * COOP/COEP note: GitHub Pages cannot send cross-origin isolation headers, so
 * SharedArrayBuffer is unavailable. We force numThreads=1 before loading any
 * ONNX session, this routes entirely through the single-threaded WASM backend
 * and never touches SharedArrayBuffer. WebGPU is attempted first (no isolation
 * required for WebGPU); WASM single-thread is the fallback.
 */
import { RawImage, pipeline } from "@huggingface/transformers";
import { configureTransformersEnv } from "./transformersEnv";


// Approx download size is ~90 MB for ViT-GPT2 image captioning.
export const MODEL_ID = "Xenova/vit-gpt2-image-captioning";
export const MODEL_SIZE_MB = 90;

export type ProgressCallback = (loaded: number, total: number, status: string) => void;

type TransformersProgressEvent = {
  status: string;
  loaded?: number;
  total?: number;
};

// ImageToTextPipeline type from @huggingface/transformers
type ImageToTextPipeline = (
  input: RawImage | string,
  options?: Record<string, unknown>
) => Promise<Array<{ generated_text: string }>>;

let captioner: ImageToTextPipeline | null = null;

/** Load (or return cached) the image-to-text pipeline. */
export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
  if (captioner) return;
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

  captioner = (await (
    pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
  )("image-to-text", MODEL_ID, {
    progress_callback: progressCb,
  })) as ImageToTextPipeline;
}

export interface CaptionResult {
  caption: string;
  /** Additional candidates when num_captions > 1. May be empty. */
  candidates: string[];
}

/** Resize an image file to 224x224 and return a RawImage for the model. */
async function prepareRawImage(file: File): Promise<{ rawImage: RawImage; blobUrl: string }> {
  const bitmap = await createImageBitmap(file);

  // Resize to 224x224 for ViT (its expected input size)
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

/**
 * Generate one or more captions for an image file.
 * When numCaptions > 1, beam search with multiple return sequences is used.
 * ViT-GPT2 supports num_return_sequences via beam search.
 */
export async function captionImage(file: File, numCaptions = 1): Promise<CaptionResult> {
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

/**
 * Fetch an image from a URL and return it as a File.
 * Throws a descriptive error if the URL is not a supported image type or the
 * fetch fails (CORS, 404, non-image content-type).
 */
export async function fetchImageFromUrl(url: string): Promise<File> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      "Could not reach that URL. It may be blocked by CORS policy, or the address is unreachable."
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const supportedPrefixes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!supportedPrefixes.some((t) => contentType.startsWith(t))) {
    throw new Error(
      `The URL did not return an image (got "${contentType || "unknown type"}"). Make sure the URL points directly to a PNG, JPG, WebP or GIF file.`
    );
  }

  const blob = await response.blob();
  const filename = url.split("/").pop()?.split("?")[0] ?? "image.jpg";
  return new File([blob], filename, { type: blob.type || contentType });
}

/** True if the model is already loaded (cached). */
export function isModelLoaded(): boolean {
  return captioner !== null;
}
