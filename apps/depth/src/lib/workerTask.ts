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
 * Each app provides a worker factory via a Vite ?worker import:
 *   import InferWorker from "./infer.worker.ts?worker";
 *   run(() => new InferWorker(), args, handlers)
 *
 * Using ?worker (not new URL(..., import.meta.url)) ensures Vite compiles the
 * worker into a real JS chunk — passing a URL through a helper defeats static
 * analysis and causes Vite to inline the raw TypeScript as an unexecutable
 * data:video/mp2t URL.
 *
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
 * Decides whether a transformers.js progress event should be forwarded to the
 * UI. Throttles to whole-percent boundaries so the rapid per-chunk callbacks
 * don't cause a re-render storm, while always letting through:
 *   - first event (lastPct === -1)
 *   - indeterminate state (total === 0, byte count is meaningless)
 *   - 100% completion
 *   - status transitions (e.g. "download" → "done")
 *   - any event where the rounded whole-percent has changed
 *
 * Exported for unit testing. Not intended for direct use outside this module.
 */
export function shouldEmitProgress(
  loaded: number,
  total: number,
  status: string,
  lastPct: number,
  lastStatus: string,
): boolean {
  if (lastPct === -1) return true; // first event
  if (total === 0) return true; // indeterminate
  if (status !== lastStatus) return true; // status transition
  const pct = Math.round((loaded / total) * 100);
  return pct !== lastPct; // includes pct === 100 (completion)
}

/**
 * Returns { run, cancel }.
 *
 * run(createWorker, args, handlers) - creates a worker via the factory,
 *   starts it with args, and resolves when result or error is received.
 * cancel() - terminates the running worker immediately.
 *
 * createWorker must be a factory from a Vite ?worker import, e.g.:
 *   import InferWorker from "./infer.worker.ts?worker";
 *   run(() => new InferWorker(), args, handlers)
 *
 * This ensures Vite compiles the worker into a real JS chunk rather than
 * inlining the raw TypeScript as an unexecutable data: URL.
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
      createWorker: () => Worker,
      args: TArgs,
      handlers: WorkerTaskHandlers<TResult>
    ): Promise<void> => {
      // Terminate any in-flight worker first
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      return new Promise<void>((resolve) => {
        const worker = createWorker();
        workerRef.current = worker;

        // Per-run throttle state; resets for each new inference job.
        let lastPct = -1;
        let lastStatus = "";
        let maxPct = -1;

        worker.onmessage = (e: MessageEvent<WorkerMsg<TResult>>) => {
          const msg = e.data;
          switch (msg.type) {
            case "progress": {
              const { loaded, total, status } = msg;
              const rawPct = total > 0 ? Math.round((loaded / total) * 100) : -1;
              const displayPct = maxPct === -1 ? rawPct : Math.max(maxPct, rawPct);

              // Throttle decision uses displayPct so the bar never regresses.
              // Always emit first event, indeterminate, and status transitions.
              // Otherwise suppress if displayPct hasn't increased.
              if (lastPct !== -1 && total !== 0 && status === lastStatus && displayPct === lastPct) {
                break; // suppress — no meaningful change
              }

              maxPct = displayPct;
              lastPct = displayPct;
              lastStatus = status;

              // Adjust loaded so the UI renders displayPct, not the raw regressed pct
              const adjustedLoaded = total > 0 ? Math.ceil((displayPct / 100) * total) : loaded;
              handlers.onProgress(adjustedLoaded, total, status);
              break;
            }
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
          handlers.onError(
            e.message
              ? `Worker error: ${e.message}`
              : "Worker failed to load or initialise — check that your browser supports ES module workers and that the model files are accessible."
          );
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
