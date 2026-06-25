/**
 * Regression tests for csvStore persist rehydration robustness.
 * Poison localStorage with wrong-typed values and verify the store falls back
 * to safe defaults rather than throwing on input.trim() or other type assumptions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "csv-tool-prefs";

function writePersistedState(state: Record<string, unknown>) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ state, version: 0 }));
}

describe("csvStore — persist rehydration guard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("falls back to '' when a poisoned store injects a non-string input", async () => {
    writePersistedState({ mode: "csv-to-json", input: 99 });
    const { useCsvStore } = await import("./csvStore");
    const state = useCsvStore.getState();
    expect(typeof state.input).toBe("string");
    expect(() => state.input.trim()).not.toThrow();
  });

  it("falls back to default mode when persisted mode is invalid", async () => {
    writePersistedState({ mode: "invalid-mode" });
    const { useCsvStore } = await import("./csvStore");
    expect(useCsvStore.getState().mode).toBe("csv-to-json");
  });

  it("falls back to default delimiter when persisted delimiter is invalid", async () => {
    writePersistedState({ delimiter: 42 });
    const { useCsvStore } = await import("./csvStore");
    expect(useCsvStore.getState().delimiter).toBe(",");
  });

  it("falls back to default outputFormat when persisted outputFormat is invalid", async () => {
    writePersistedState({ outputFormat: ["array"] });
    const { useCsvStore } = await import("./csvStore");
    expect(useCsvStore.getState().outputFormat).toBe("json");
  });

  it("falls back to safe defaults on a fully garbage persisted state", async () => {
    writePersistedState({ mode: 0, delimiter: null, input: { bad: true }, outputFormat: false });
    const { useCsvStore } = await import("./csvStore");
    const state = useCsvStore.getState();
    expect(typeof state.input).toBe("string");
    expect(() => state.input.trim()).not.toThrow();
    expect(["csv-to-json", "json-to-csv"]).toContain(state.mode);
    expect([",", "\t", ";", "|"]).toContain(state.delimiter);
  });

  it("preserves valid persisted values on rehydrate", async () => {
    writePersistedState({
      mode: "json-to-csv",
      delimiter: ";",
      autoDelimiter: false,
      hasHeader: false,
      outputFormat: "markdown",
    });
    const { useCsvStore } = await import("./csvStore");
    const state = useCsvStore.getState();
    expect(state.mode).toBe("json-to-csv");
    expect(state.delimiter).toBe(";");
    expect(state.autoDelimiter).toBe(false);
    expect(state.outputFormat).toBe("markdown");
  });
});
