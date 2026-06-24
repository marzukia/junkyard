/**
 * Regression test for dogfood wave-2 bug #5:
 * Tesseract worker errors must not escape to window as uncaught errors when the
 * UX is already handling them gracefully.
 *
 * The fix adds `errorHandler: () => {}` to both createWorker() calls so the
 * worker-level error event is suppressed at source.  The try/catch in runOcr()
 * and runBatch() already owns the UX; the errorHandler prevents a second,
 * uncaught propagation.
 *
 * We test the store-side invariant: setStatus("error") correctly surfaces the
 * error state and does not leave the store in "loading" or "running".
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useOcrStore } from "./store";

beforeEach(() => {
  useOcrStore.setState({
    status: "idle",
    progress: 0,
    progressMessage: "",
    rawText: "",
    editedText: "",
    confidence: 0,
  });
});

describe("ocrStore: error path does not leave store stuck in loading/running", () => {
  it("setStatus('error') transitions from 'loading' to 'error'", () => {
    useOcrStore.getState().setStatus("loading");
    expect(useOcrStore.getState().status).toBe("loading");

    // Simulate catch block in runOcr firing after worker error
    useOcrStore.getState().setStatus("error");
    expect(useOcrStore.getState().status).toBe("error");
  });

  it("setStatus('error') transitions from 'running' to 'error'", () => {
    useOcrStore.getState().setStatus("running");
    useOcrStore.getState().setStatus("error");
    expect(useOcrStore.getState().status).toBe("error");
  });

  it("setProgress with message is set correctly on error", () => {
    useOcrStore.getState().setStatus("loading");
    useOcrStore.getState().setProgress(0, "OCR failed. Try a clearer image.");
    const s = useOcrStore.getState();
    expect(s.progress).toBe(0);
    expect(s.progressMessage).toBe("OCR failed. Try a clearer image.");
  });
});
