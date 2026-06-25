/**
 * Regression tests for barcodeStore persist rehydration robustness.
 * Poison localStorage with wrong-typed values and verify the store falls back
 * to safe defaults rather than throwing on input.trim() / format lookup.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "barcode-settings";

function writePersistedState(state: Record<string, unknown>) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ state, version: 0 }));
}

describe("barcodeStore — persist rehydration guard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("falls back to DEFAULT_INPUT when persisted input is a number", async () => {
    writePersistedState({ format: "CODE128", input: 42 });
    const { useBarcodeStore } = await import("./barcodeStore");
    const state = useBarcodeStore.getState();
    expect(typeof state.input).toBe("string");
    // input.trim() must not throw
    expect(() => state.input.trim()).not.toThrow();
  });

  it("falls back to DEFAULT_FORMAT when persisted format is an unknown string", async () => {
    writePersistedState({ format: "MADE_UP", input: "hello" });
    const { useBarcodeStore } = await import("./barcodeStore");
    const state = useBarcodeStore.getState();
    expect(state.format).toBe("CODE128");
  });

  it("falls back to safe defaults on a fully garbage persisted state", async () => {
    writePersistedState({ format: { bad: true }, input: null, width: "wide", height: [] });
    const { useBarcodeStore } = await import("./barcodeStore");
    const state = useBarcodeStore.getState();
    expect(typeof state.input).toBe("string");
    expect(typeof state.format).toBe("string");
    expect(typeof state.width).toBe("number");
    expect(typeof state.height).toBe("number");
    expect(() => state.input.trim()).not.toThrow();
  });

  it("preserves valid persisted values on rehydrate", async () => {
    writePersistedState({
      format: "EAN13",
      input: "5901234123457",
      width: 400,
      height: 150,
      margin: 5,
      displayValue: false,
    });
    const { useBarcodeStore } = await import("./barcodeStore");
    const state = useBarcodeStore.getState();
    expect(state.format).toBe("EAN13");
    expect(state.input).toBe("5901234123457");
    expect(state.width).toBe(400);
    expect(state.displayValue).toBe(false);
  });

  it("input.trim() does not throw when rehydrating a non-string input", async () => {
    writePersistedState({ input: { obj: true } });
    const { useBarcodeStore } = await import("./barcodeStore");
    expect(() => useBarcodeStore.getState().input.trim()).not.toThrow();
  });
});
