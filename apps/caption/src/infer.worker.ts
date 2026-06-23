/**
 * Web Worker for caption: runs model load + inference off the main thread.
 */
import type { WorkerMsg, WorkerRequest } from "./lib/workerTask";
import type { CaptionResult } from "./lib/captioner";
import { isModelLoaded, loadModel, captionImage } from "./lib/captioner";

type Args = {
  file: File;
  numCaptions: number;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file, numCaptions } = e.data.args;

  try {
    if (!isModelLoaded()) {
      await loadModel((loaded, total, status) => {
        const msg: WorkerMsg<CaptionResult> = { type: "progress", loaded, total, status };
        self.postMessage(msg);
      });
    }

    const result = await captionImage(file, numCaptions);
    const msg: WorkerMsg<CaptionResult> = { type: "result", payload: result };
    self.postMessage(msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during captioning.";
    const msg: WorkerMsg<CaptionResult> = { type: "error", message };
    self.postMessage(msg);
  }
};
