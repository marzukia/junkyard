/**
 * Shared inference-worker factory for AI-powered junkyard apps.
 *
 * Every AI app (bg, caption, depth, upscale, transcribe, translate, summarize)
 * needs the same plumbing:
 *   - env config (numThreads=1, useBrowserCache) before pipeline() call
 *   - Progress-callback posting as WorkerMsg
 *   - Singleton model caching
 *
 * This factory provides that boilerplate. App-specific logic (model ID,
 * inference type, result type, post-processing) lives in the app's own
 * infer.worker.ts.
 *
 * The caller passes the `env` object from its own `@huggingface/transformers`
 * import. This avoids a dynamic import here that Rollup cannot resolve from
 * the kit/ directory during worker builds.
 */

import type { WorkerMsg, WorkerRequest } from "@junkyardsh/ui";

/** Minimal env shape we need from @huggingface/transformers. */
interface TransformersEnv {
  useBrowserCache: boolean;
  backends: { onnx: { wasm: { numThreads: number } } };
}

/** Shape of the progress event emitted by @huggingface/transformers pipeline(). */
export interface TransformersProgressEvent {
  status: string;
  loaded?: number;
  total?: number;
}

/**
 * Post a progress WorkerMsg to self (the worker's global scope).
 * Handles all event statuses (initiate / progress / download / done).
 */
export function postProgress<T>(
  event: TransformersProgressEvent
): void {
  if (event.status === "progress" || event.status === "download") {
    const msg: WorkerMsg<T> = {
      type: "progress",
      loaded: event.loaded ?? 0,
      total: event.total ?? 1,
      status: event.status,
    };
    self.postMessage(msg);
  } else if (event.status === "initiate") {
    self.postMessage({
      type: "progress",
      loaded: 0,
      total: 1,
      status: "initiate",
    } as WorkerMsg<T>);
  } else if (event.status === "done") {
    self.postMessage({
      type: "progress",
      loaded: 1,
      total: 1,
      status: "done",
    } as WorkerMsg<T>);
  }
}

/**
 * Post an error WorkerMsg to self.
 */
export function postError<T>(message: string): void {
  const msg: WorkerMsg<T> = { type: "error", message };
  self.postMessage(msg);
}

/**
 * Post a result WorkerMsg to self.
 */
export function postResult<T>(payload: T): void {
  const msg: WorkerMsg<T> = { type: "result", payload };
  self.postMessage(msg);
}

/**
 * Wrap a pipeline load so the caller doesn't repeat the env-config + progress
 * callback boilerplate.
 *
 * @param env - the `env` object from the caller's `@huggingface/transformers` import
 * @param load - async function that calls pipeline() and returns the model
 * @param onProgress - optional callback (called before self.postMessage)
 */
export async function loadPipeline<T>(
  env: TransformersEnv,
  load: (progressCb: (event: TransformersProgressEvent) => void) => Promise<T>,
  onProgress?: (loaded: number, total: number, status: string) => void
): Promise<T> {
  // Disable multi-threaded WASM (requires SharedArrayBuffer / COOP+COEP).
  // GitHub Pages cannot send cross-origin isolation headers, so we route
  // entirely through the single-threaded WASM backend.
  env.backends.onnx.wasm.numThreads = 1;
  // Cache models in the browser so subsequent visits skip the download.
  env.useBrowserCache = true;

  const progressCb = (event: TransformersProgressEvent) => {
    if (onProgress) {
      if (event.status === "progress" || event.status === "download") {
        onProgress(event.loaded ?? 0, event.total ?? 1, event.status);
      } else if (event.status === "initiate") {
        onProgress(0, 1, "initiate");
      } else if (event.status === "done") {
        onProgress(1, 1, "done");
      }
    }
    postProgress(event);
  };

  return load(progressCb);
}
