/**
 * Web Worker for transcribe: runs model load + inference off the main thread.
 * The File object is cloned (structured clone) into the worker.
 * decodeAudioFile uses OfflineAudioContext which is available in workers.
 */
import type { WorkerMsg, WorkerRequest } from "@junkyardsh/ui";
import type { TranscriptionResult } from "./lib/transcription";
import { isModelLoaded, loadModel, transcribeFile } from "./lib/transcription";

type Args = {
  file: File;
  language?: string;
  translateToEnglish: boolean;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file, language, translateToEnglish } = e.data.args;

  try {
    if (!isModelLoaded()) {
      await loadModel((loaded, total, status) => {
        const msg: WorkerMsg<TranscriptionResult> = { type: "progress", loaded, total, status };
        self.postMessage(msg);
      });
    }

    // Signal that audio decode is starting (runs inside transcribeFile before inference)
    self.postMessage({
      type: "progress",
      loaded: 0,
      total: 1,
      status: "decoding",
    } as WorkerMsg<TranscriptionResult>);

    let chunksProcessed = 0;
    const result = await transcribeFile(
      file,
      undefined,
      language !== "auto" ? language : undefined,
      {
        translateToEnglish,
        onChunk: (n) => {
          chunksProcessed = n;
          const msg: WorkerMsg<TranscriptionResult> = {
            type: "chunk_progress",
            done: chunksProcessed,
            total: chunksProcessed + 1,
          };
          self.postMessage(msg);
        },
      }
    );

    const msg: WorkerMsg<TranscriptionResult> = { type: "result", payload: result };
    self.postMessage(msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during transcription.";
    const msg: WorkerMsg<TranscriptionResult> = { type: "error", message };
    self.postMessage(msg);
  }
};
