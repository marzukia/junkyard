import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPalette, loadPalette, savePalette } from "./localStorage";

// ── Minimal localStorage mock ─────────────────────────────────────────────────

const store: Record<string, string> = {};
const STORAGE_KEY = "colours_palette_v1";

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── savePalette / loadPalette roundtrip ───────────────────────────────────────

describe("savePalette / loadPalette", () => {
  it("roundtrips a valid palette", () => {
    const palette = {
      colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"],
      locked: [false, true, false, false, false],
      count: 5,
      harmonyMode: "analogous" as const,
    };
    savePalette(palette);
    const loaded = loadPalette();
    expect(loaded).not.toBeNull();
    expect(loaded?.colors).toEqual(palette.colors);
    expect(loaded?.locked).toEqual(palette.locked);
    expect(loaded?.count).toBe(5);
    expect(loaded?.harmonyMode).toBe("analogous");
  });

  it("returns null when nothing is stored", () => {
    expect(loadPalette()).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    store[STORAGE_KEY] = "{bad json}";
    expect(loadPalette()).toBeNull();
  });

  it("emits console.warn and returns null for invalid hex entries", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const palette = {
      colors: ["notvalid", "#ff0000", "#0000ff"],
      locked: [false, false, false],
      count: 3,
      harmonyMode: "triadic" as const,
    };
    savePalette(palette);
    const loaded = loadPalette();
    // Should return null (not silently substitute grey) and warn about the bad entry.
    expect(loaded).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[colours]")
      // message includes the bad value
    );
    warnSpy.mockRestore();
  });

  it("falls back to analogous for invalid harmony mode", () => {
    store[STORAGE_KEY] = JSON.stringify({
      colors: ["#aabbcc", "#112233", "#445566"],
      locked: [false, false, false],
      count: 3,
      harmonyMode: "invalid_mode",
    });
    const loaded = loadPalette();
    expect(loaded?.harmonyMode).toBe("analogous");
  });

  it("clamps count outside valid range", () => {
    store[STORAGE_KEY] = JSON.stringify({
      colors: ["#ff0000"],
      locked: [false],
      count: 100,
      harmonyMode: "monochromatic",
    });
    const loaded = loadPalette();
    // count=100 clamps to MAX (8); colors shorter than clamped count triggers
    // the invalid-entry path (undefined entries fail hex validation) -> returns null.
    // The store's buildInitialState then falls back to a fresh generated palette.
    expect(loaded).toBeNull();
  });
});

// ── clearPalette ──────────────────────────────────────────────────────────────

describe("clearPalette", () => {
  it("removes stored palette so loadPalette returns null", () => {
    savePalette({
      colors: ["#ff0000", "#00ff00", "#0000ff"],
      locked: [false, false, false],
      count: 3,
      harmonyMode: "triadic",
    });
    expect(loadPalette()).not.toBeNull();
    clearPalette();
    expect(loadPalette()).toBeNull();
  });

  it("does not throw when nothing is stored", () => {
    expect(() => clearPalette()).not.toThrow();
  });
});

// ── Robustness: localStorage throws ──────────────────────────────────────────

describe("localStorage error handling", () => {
  it("savePalette does not throw when localStorage.setItem throws (e.g. quota)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    expect(() =>
      savePalette({
        colors: ["#ff0000", "#00ff00", "#0000ff"],
        locked: [false, false, false],
        count: 3,
        harmonyMode: "analogous",
      })
    ).not.toThrow();
  });

  it("loadPalette returns null when localStorage.getItem throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(loadPalette()).toBeNull();
  });
});
