/**
 * Reusable hook for running a single inference task in a Web Worker.
 *
 * Pattern:
 *   - Worker is created on first run (or re-created after cancel/terminate).
 *   - Cancel terminates the worker immediately (transformers.js has no clean abort).
 *   - Worker communicates progress and result via postMessage.
 *   - Re-creating the worker on next run re-downloads nothing: the browser
 *     cache (set via env.useBrowserCache = true in each worker) retains the model.
 *
 * Each app provides its own worker URL via Vite's new URL(..., import.meta.url).
 * The message protocol is typed generically so the hook works for any tool.
 */
import { useCallback, useRef } from "react";

export type WorkerMsg<TResult> =
  | { type: "progress"; loaded: number; total: number; status: string }
  | { type: "chunk_progress"; done: number; total: number }
  | { type: "result"; payload: TResult }
  | { type: "error"; message: string };

export type WorkerRequest<TArgs> = {
  type: "run";
  args: TArgs;
};

export interface WorkerTaskHandlers<TResult> {
  onProgress: (loaded: number, total: number, status: string) => void;
  onChunkProgress?: (done: number, total: number) => void;
  onResult: (result: TResult) => void;
  onError: (message: string) => void;
}

/**
 * Returns { run, cancel }.
 *
 * run(workerUrl, args, handlers) - starts the worker with args; resolves when
 *   result or error is received.
 * cancel() - terminates the running worker immediately.
 *
 * The workerUrl must be a `new URL('./infer.worker.ts', import.meta.url)`
 * expression so Vite bundles it as a separate chunk.
 */
export function useWorkerTask<TArgs, TResult>() {
  const workerRef = useRef<Worker | null>(null);

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const run = useCallback(
    (
      workerUrl: URL,
      args: TArgs,
      handlers: WorkerTaskHandlers<TResult>
    ): Promise<void> => {
      // Terminate any in-flight worker first
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      return new Promise<void>((resolve) => {
        const worker = new Worker(workerUrl, { type: "module" });
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent<WorkerMsg<TResult>>) => {
          const msg = e.data;
          switch (msg.type) {
            case "progress":
              handlers.onProgress(msg.loaded, msg.total, msg.status);
              break;
            case "chunk_progress":
              handlers.onChunkProgress?.(msg.done, msg.total);
              break;
            case "result":
              workerRef.current = null;
              worker.terminate();
              handlers.onResult(msg.payload);
              resolve();
              break;
            case "error":
              workerRef.current = null;
              worker.terminate();
              handlers.onError(msg.message);
              resolve();
              break;
          }
        };

        worker.onerror = (e) => {
          workerRef.current = null;
          worker.terminate();
          handlers.onError(e.message ?? "Worker error");
          resolve();
        };

        const req: WorkerRequest<TArgs> = { type: "run", args };
        worker.postMessage(req);
      });
    },
    []
  );

  return { run, cancel };
}
