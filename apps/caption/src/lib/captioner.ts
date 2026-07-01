/**
 * Image captioning using @huggingface/transformers with ViT-GPT2.
 *
 * Model loading and inference run in infer.worker.ts (web worker).
 * This file only contains types, constants, and pure utilities used by the main thread.
 */

// Approx download size is ~90 MB for ViT-GPT2 image captioning.
export const MODEL_ID = "Xenova/vit-gpt2-image-captioning";
export const MODEL_SIZE_MB = 90;

export interface CaptionResult {
  caption: string;
  /** Additional candidates when num_captions > 1. May be empty. */
  candidates: string[];
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
