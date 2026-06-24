/**
 * Monotonic phase guard tests for translateStore.
 *
 * Phase order: idle < model-loading < translating < done/error.
 *
 * Invariant: setPhase(X) where rank(X) < rank(current) is a no-op,
 * UNLESS X === "idle" (the cancel/reset sentinel).
 *
 * Re-run contract: done/error → setPhase("idle") → setPhase("model-loading")
 * must succeed. The run handler (handleTranslate) calls setPhase("idle")
 * first so this path is always open.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useTranslateStore } from "./translateStore";
import type { Phase } from "./translateStore";

function phase(): Phase {
  return useTranslateStore.getState().phase;
}
function sp(p: Phase) {
  useTranslateStore.getState().setPhase(p);
}

describe("translateStore monotonic phase guard", () => {
  beforeEach(() => {
    useTranslateStore.getState().reset();
  });

  it("advances forward through the pipeline", () => {
    expect(phase()).toBe("idle");
    sp("model-loading");
    expect(phase()).toBe("model-loading");
    sp("translating");
    expect(phase()).toBe("translating");
    sp("done");
    expect(phase()).toBe("done");
  });

  it("blocks regression from translating back to model-loading (stray progress)", () => {
    sp("model-loading");
    sp("translating");
    sp("model-loading");
    expect(phase()).toBe("translating");
  });

  it("blocks regression from done back to model-loading", () => {
    sp("model-loading");
    sp("translating");
    sp("done");
    sp("model-loading");
    expect(phase()).toBe("done");
  });

  it("blocks regression from done back to translating", () => {
    sp("model-loading");
    sp("translating");
    sp("done");
    sp("translating");
    expect(phase()).toBe("done");
  });

  it("allows error from any inference phase", () => {
    sp("model-loading");
    sp("translating");
    sp("error");
    expect(phase()).toBe("error");
  });

  it("allows idle (cancel sentinel) even after inference started", () => {
    sp("model-loading");
    sp("translating");
    sp("idle");
    expect(phase()).toBe("idle");
  });

  it("re-run from done: idle reset allows model-loading (done->idle->model-loading)", () => {
    sp("model-loading");
    sp("translating");
    sp("done");
    expect(phase()).toBe("done");
    // Re-run sequence: handleTranslate calls setPhase("idle") then setPhase("model-loading")
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
