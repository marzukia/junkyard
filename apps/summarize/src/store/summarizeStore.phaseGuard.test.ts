/**
 * Monotonic phase guard tests for summarizeStore.
 *
 * Invariant: setPhase(X) where rank(X) < rank(current) is a no-op,
 * UNLESS X === "idle" (the cancel/reset sentinel).
 *
 * Re-run contract: done/error → setPhase("idle") → setPhase("model-loading")
 * must succeed. The run handler (handleSummarize) calls setPhase("idle")
 * first so this path is always open.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useSummarizeStore } from "./summarizeStore";
import type { Phase } from "./summarizeStore";

function phase(): Phase {
  return useSummarizeStore.getState().phase;
}
function sp(p: Phase) {
  useSummarizeStore.getState().setPhase(p);
}

describe("summarizeStore monotonic phase guard", () => {
  beforeEach(() => {
    useSummarizeStore.getState().reset();
  });

  it("advances forward through the pipeline", () => {
    expect(phase()).toBe("idle");
    sp("model-loading");
    expect(phase()).toBe("model-loading");
    sp("processing");
    expect(phase()).toBe("processing");
    sp("done");
    expect(phase()).toBe("done");
  });

  it("blocks regression from processing back to model-loading (stray progress)", () => {
    sp("model-loading");
    sp("processing");
    sp("model-loading");
    expect(phase()).toBe("processing");
  });

  it("blocks regression from done back to model-loading", () => {
    sp("model-loading");
    sp("processing");
    sp("done");
    sp("model-loading");
    expect(phase()).toBe("done");
  });

  it("blocks regression from done back to processing", () => {
    sp("model-loading");
    sp("processing");
    sp("done");
    sp("processing");
    expect(phase()).toBe("done");
  });

  it("allows error from any inference phase", () => {
    sp("model-loading");
    sp("processing");
    sp("error");
    expect(phase()).toBe("error");
  });

  it("allows idle (cancel sentinel) even after inference started", () => {
    sp("model-loading");
    sp("processing");
    sp("idle");
    expect(phase()).toBe("idle");
  });

  it("re-run from done: idle reset allows model-loading (done->idle->model-loading)", () => {
    sp("model-loading");
    sp("processing");
    sp("done");
    expect(phase()).toBe("done");
    // Re-run sequence: handleSummarize calls setPhase("idle") then setPhase("model-loading")
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
});
