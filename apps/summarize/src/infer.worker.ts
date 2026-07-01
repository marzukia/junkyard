/**
 * Web Worker for summarize: runs model load + inference off the main thread.
 * Communicates via postMessage using the WorkerMsg / WorkerRequest protocol
 * defined in lib/workerTask.ts.
 *
 * Worker is terminated on cancel (no clean abort in transformers.js).
 * Re-creating the worker on next run uses the browser cache -- no re-download.
 */
import type { WorkerRequest } from "@junkyardsh/kit";
import { postError, postResult } from "../../../kit/lib/workerInference";
import {
  type SummaryOptions,
  type SummaryResult,
  isModelLoaded,
  loadModel,
  summarize,
} from "./lib/summarizer";

type Args = {
  inputText: string;
  minWords: number;
  maxWords: number;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { inputText, minWords, maxWords } = e.data.args;

  try {
    if (!isModelLoaded()) {
      await loadModel();
    }

    const opts: SummaryOptions = {
      minWords,
      maxWords,
      onChunkProgress: (done, total) => {
        const msg: WorkerMsg<SummaryResult> = { type: "chunk_progress", done, total };
        self.postMessage(msg);
      },
    };

    const result = await summarize(inputText, opts);
    postResult<SummaryResult>(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during summarization.";
    postError<SummaryResult>(message);
  }
};
