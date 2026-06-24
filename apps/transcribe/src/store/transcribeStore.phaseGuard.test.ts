/**
 * Monotonic phase guard tests for transcribeStore.
 *
 * Phase order: idle < model-loading < decoding < transcribing < done/error.
 *
 * A stray `progress` message after decoding/transcribing has started must not
 * flip the UI back to "Downloading model". Short/silent clips that never fire
 * chunk_progress (staying at "decoding" until onResult) must still reach "done"
 * when setResult fires.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useTranscribeStore } from "./transcribeStore";
import type { Phase } from "./transcribeStore";

function phase(): Phase {
  return useTranscribeStore.getState().phase;
}
function sp(p: Phase) {
  useTranscribeStore.getState().setPhase(p);
}

describe("transcribeStore monotonic phase guard", () => {
  beforeEach(() => {
    useTranscribeStore.getState().reset();
  });

  it("advances forward through the full pipeline", () => {
    sp("model-loading");
    expect(phase()).toBe("model-loading");
    sp("decoding");
    expect(phase()).toBe("decoding");
    sp("transcribing");
    expect(phase()).toBe("transcribing");
    sp("done");
    expect(phase()).toBe("done");
  });

  it("blocks regression from decoding back to model-loading", () => {
    sp("model-loading");
    sp("decoding");
    // stray progress message
    sp("model-loading");
    expect(phase()).toBe("decoding");
  });

  it("blocks regression from transcribing back to model-loading", () => {
    sp("model-loading");
    sp("decoding");
    sp("transcribing");
    sp("model-loading");
    expect(phase()).toBe("transcribing");
  });

  it("blocks regression from transcribing back to decoding", () => {
    sp("model-loading");
    sp("decoding");
    sp("transcribing");
    sp("decoding");
    expect(phase()).toBe("transcribing");
  });

  it("short/silent clip: setResult advances from decoding to done without chunk_progress", () => {
    // Simulate: model-loading → decoding → onResult (no chunk_progress fired)
    sp("model-loading");
    sp("decoding");
    // No sp("transcribing") — short clip, no chunks emitted
    useTranscribeStore.getState().setResult("text", []);
    expect(phase()).toBe("done");
  });

  it("allows idle (cancel sentinel) from any phase", () => {
    sp("model-loading");
    sp("decoding");
    sp("transcribing");
    sp("idle");
    expect(phase()).toBe("idle");
  });

  it("re-run from done: idle reset allows model-loading (done->idle->model-loading)", () => {
    // Simulate a complete transcription run
    sp("model-loading");
    sp("decoding");
    sp("transcribing");
    sp("done");
    expect(phase()).toBe("done");
    // Re-run sequence: runTranscription calls setPhase("idle") then setPhase("model-loading")
    sp("idle");
    sp("model-loading");
    expect(phase()).toBe("model-loading");
  });

  it("re-run from error: idle reset allows model-loading (error->idle->model-loading)", () => {
    sp("model-loading");
    sp("error");
    expect(phase()).toBe("error");
    sp("idle");
    sp("model-loading");
    expect(phase()).toBe("model-loading");
  });

  it("trailing progress after transcribing is ignored", () => {
    sp("model-loading");
    sp("decoding");
    sp("transcribing");
    useTranscribeStore.getState().setResult("hello", []);
    // Stray late-arriving progress after result
    sp("model-loading");
    expect(phase()).toBe("done");
  });
});
