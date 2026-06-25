/**
 * Regression tests for qrStore persist rehydration robustness.
 * Poison localStorage with wrong-typed values and verify the store falls back
 * to safe defaults rather than throwing on text.trim() or invalid enum access.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "qr-settings";

function writePersistedState(state: Record<string, unknown>) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ state, version: 0 }));
}

describe("qrStore — persist rehydration guard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("falls back to default text when a poisoned store injects a non-string text", async () => {
    writePersistedState({ text: 42 });
    const { useQRStore } = await import("./qrStore");
    const state = useQRStore.getState();
    expect(typeof state.text).toBe("string");
    expect(() => state.text.trim()).not.toThrow();
  });

  it("falls back to default text when persisted text is an object", async () => {
    writePersistedState({ text: { url: "https://evil.example" } });
    const { useQRStore } = await import("./qrStore");
    const state = useQRStore.getState();
    expect(typeof state.text).toBe("string");
    expect(() => state.text.trim()).not.toThrow();
  });

  it("falls back to default errorCorrectionLevel when persisted value is invalid", async () => {
    writePersistedState({ errorCorrectionLevel: "X" });
    const { useQRStore } = await import("./qrStore");
    expect(useQRStore.getState().errorCorrectionLevel).toBe("M");
  });

  it("falls back to default dotStyle when persisted value is invalid", async () => {
    writePersistedState({ dotStyle: 99 });
    const { useQRStore } = await import("./qrStore");
    expect(useQRStore.getState().dotStyle).toBe("square");
  });

  it("falls back to safe defaults on a fully garbage persisted state", async () => {
    writePersistedState({
      text: false,
      fgColor: 0,
      bgColor: null,
      errorCorrectionLevel: [],
      dotStyle: {},
      eyeStyle: { bad: true },
    });
    const { useQRStore } = await import("./qrStore");
    const state = useQRStore.getState();
    expect(typeof state.text).toBe("string");
    expect(() => state.text.trim()).not.toThrow();
    expect(typeof state.fgColor).toBe("string");
    expect(["L", "M", "Q", "H"]).toContain(state.errorCorrectionLevel);
    expect(["square", "rounded", "dots", "classy"]).toContain(state.dotStyle);
  });

  it("preserves valid persisted values on rehydrate", async () => {
    writePersistedState({
      fgColor: "#000000",
      bgColor: "#ffffff",
      errorCorrectionLevel: "H",
      dotStyle: "rounded",
      eyeStyle: "circle",
    });
    const { useQRStore } = await import("./qrStore");
    const state = useQRStore.getState();
    expect(state.fgColor).toBe("#000000");
    expect(state.errorCorrectionLevel).toBe("H");
    expect(state.dotStyle).toBe("rounded");
    expect(state.eyeStyle).toBe("circle");
  });
});
