/**
 * Regression tests for svg store persist rehydration robustness.
 * Poison localStorage with wrong-typed values and verify the store falls back
 * to safe defaults rather than throwing on input.trim() or options field access.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "svg-optimizer-prefs";

function writePersistedState(state: Record<string, unknown>) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ state, version: 0 }));
}

describe("svgStore — persist rehydration guard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("falls back to '' when a poisoned store injects a non-string input", async () => {
    writePersistedState({ input: 42, options: {} });
    const { useSvgStore } = await import("./store");
    const state = useSvgStore.getState();
    expect(typeof state.input).toBe("string");
    expect(() => state.input.trim()).not.toThrow();
  });

  it("falls back to '' when persisted input is an object", async () => {
    writePersistedState({ input: { svg: "<svg/>" } });
    const { useSvgStore } = await import("./store");
    const state = useSvgStore.getState();
    expect(state.input).toBe("");
    expect(() => state.input.trim()).not.toThrow();
  });

  it("falls back to default options when persisted options fields have wrong types", async () => {
    writePersistedState({
      options: {
        precision: "high",
        stripMetadata: "yes",
        collapseGroups: null,
        removeViewBox: 1,
        removeComments: [],
        convertShapes: {},
        cleanupIds: "true",
      },
    });
    const { useSvgStore } = await import("./store");
    const state = useSvgStore.getState();
    expect(typeof state.options.precision).toBe("number");
    expect(typeof state.options.stripMetadata).toBe("boolean");
    expect(typeof state.options.collapseGroups).toBe("boolean");
    expect(typeof state.options.removeViewBox).toBe("boolean");
    expect(typeof state.options.removeComments).toBe("boolean");
    expect(typeof state.options.convertShapes).toBe("boolean");
    expect(typeof state.options.cleanupIds).toBe("boolean");
  });

  it("falls back to safe defaults on a fully garbage persisted state", async () => {
    writePersistedState({ input: false, options: "bad" });
    const { useSvgStore } = await import("./store");
    const state = useSvgStore.getState();
    expect(typeof state.input).toBe("string");
    expect(() => state.input.trim()).not.toThrow();
    expect(typeof state.options).toBe("object");
    expect(typeof state.options.precision).toBe("number");
  });

  it("preserves valid persisted options on rehydrate", async () => {
    writePersistedState({
      options: {
        precision: 4,
        stripMetadata: false,
        collapseGroups: false,
        removeViewBox: true,
        removeComments: false,
        convertShapes: true,
        cleanupIds: false,
      },
    });
    const { useSvgStore } = await import("./store");
    const state = useSvgStore.getState();
    expect(state.options.precision).toBe(4);
    expect(state.options.stripMetadata).toBe(false);
    expect(state.options.removeViewBox).toBe(true);
    expect(state.options.cleanupIds).toBe(false);
  });
});
