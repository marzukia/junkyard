/**
 * Shared helper: configure @huggingface/transformers global env.
 *
 * Call configureTransformersEnv() once inside a model-init function,
 * BEFORE pipeline() is invoked. Never call it at module level -- import-time
 * mutation of the transformers singleton makes testing harder and prevents
 * tree-shaking.
 *
 * Idempotent: repeated calls are safe (cheap assignments, library ignores
 * redundant writes after the first InferenceSession is created).
 *
 * Source of truth: kit/components/transformersEnv.ts
 * Vendored into: apps/{bg,caption,depth,translate,upscale}/src/lib/
 * To update all copies: node scripts/vendor-transformers-env.mjs
 */
/**
 * Lazy-imported @huggingface/transformers env configuration.
 *
 * The static import was replaced with a dynamic import so that apps which
 * don't use AI features (barcode, base64, colours, …) don't pull the
 * ~2 MB @huggingface/transformers bundle into their production build.
 */

export async function configureTransformersEnv(): Promise<void> {
  const { env } = await import("@huggingface/transformers");
  // Disable multi-threaded WASM (requires SharedArrayBuffer / COOP+COEP).
  // GitHub Pages cannot send cross-origin isolation headers, so we route
  // entirely through the single-threaded WASM backend.
  (env.backends as unknown as { onnx: { wasm: { numThreads: number } } }).onnx.wasm.numThreads = 1;
  // Cache models in the browser so subsequent visits skip the download.
  env.useBrowserCache = true;
}
