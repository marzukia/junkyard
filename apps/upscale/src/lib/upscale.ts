/**
 * AI super-resolution upscaling using @huggingface/transformers.
 *
 * Model loading and inference run in infer.worker.ts (web worker).
 * This file only contains types and constants used by the main thread.
 */

export const MODEL_ID = "Xenova/swin2SR-classical-sr-x2-64";
// Approx download size shown to the user.
export const MODEL_SIZE_MB = 50;

export type ScaleFactor = 2 | 4;

export { revokeResult } from "../../../../kit/lib/imageHelpers";
