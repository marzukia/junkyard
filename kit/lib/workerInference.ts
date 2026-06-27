/**
 * Shared inference-worker factory for AI-powered junkyard apps.
 *
 * Every AI app (bg, caption, depth, upscale, transcribe, translate, summarize)
 * needs the same plumbing:
 *   - configureTransformersEnv() before pipeline() call
 *   - Progress-callback posting as WorkerMsg
 *   - Singleton model caching
 *
 * This factory provides that boilerplate. App-specific logic (model ID,
 * inference type, result type, post-processing) lives in the app's own
 * infer.worker.ts.
 */

import { configureTransformersEnv } from "@junkyardsh/ui/ai";
import type { WorkerMsg, WorkerRequest } from "@junkyardsh/ui";

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
 * @param load - async function that calls pipeline() and returns the model
 * @param onProgress - optional callback (called before self.postMessage)
 */
export async function loadPipeline<T>(
  load: (progressCb: (event: TransformersProgressEvent) => void) => Promise<T>,
  onProgress?: (loaded: number, total: number, status: string) => void
): Promise<T> {
  await configureTransformersEnv();

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
