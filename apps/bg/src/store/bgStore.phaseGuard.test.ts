/**
 * Monotonic phase guard tests for bgStore.
 *
 * The guard in setPhase must refuse backward transitions once inference starts,
 * so that a trailing/duplicate `progress` message from the worker cannot flip
 * the UI back to "Downloading model" mid-processing.
 *
 * Invariant: setPhase(X) where rank(X) < rank(current) is a no-op,
 * UNLESS X === "idle" (the cancel/reset sentinel).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useBgStore } from "./bgStore";
import type { Phase } from "./bgStore";

function phase(): Phase {
  return useBgStore.getState().phase;
}
function sp(p: Phase) {
  useBgStore.getState().setPhase(p);
}

describe("bgStore monotonic phase guard", () => {
  beforeEach(() => {
    useBgStore.getState().reset();
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

  it("blocks regression from processing back to model-loading", () => {
    sp("model-loading");
    sp("processing");
    // stray progress message attempts regression
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

  it("allows error from any inference phase (forward/equal rank)", () => {
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

  it("setResult bypasses the guard and always lands on done", () => {
    sp("model-loading");
    sp("processing");
    // Simulate direct setResult call (sets phase: "done" directly in store)
    useBgStore.getState().setResult("blob:fake", 100, 100);
    expect(phase()).toBe("done");
    // A subsequent stray progress message must not regress
    sp("model-loading");
    expect(phase()).toBe("done");
  });
});
