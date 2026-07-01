/**
 * Background removal using @huggingface/transformers with RMBG-1.4.
 *
 * Model loading and inference run in infer.worker.ts (web worker).
 * This file only contains types and utilities used by the main thread.
 */

export { revokeResult } from "../../../../kit/lib/imageHelpers";
