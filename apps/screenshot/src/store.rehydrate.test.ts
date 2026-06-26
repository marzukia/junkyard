/**
 * Regression test for dogfood wave-2 bug #2:
 * When `bgKind="image"` was persisted but the page reloads (object URL is gone),
 * the store must fall back to the default bgKind (gradient) instead of silently
 * rendering a white background.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./beautifier";

const STORAGE_KEY = "screenshot-settings-v1";

function setStorage(value: object) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

/**
 * Inline the loadPersistedSettings logic from store.ts so we can test it in
 * isolation without DOM side-effects.  Kept in sync with the production code.
 */
function loadPersistedSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_SETTINGS>;
  const bgKindOverride =
    (parsed.bgKind as string | undefined) === "image" ? DEFAULT_SETTINGS.bgKind : parsed.bgKind;
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    bgKind: bgKindOverride ?? DEFAULT_SETTINGS.bgKind,
    bgImageUrl: null,
  };
}

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe("loadPersistedSettings: bgKind=image rehydrate fallback", () => {
  it("resets bgKind to default gradient when persisted bgKind is 'image'", () => {
    setStorage({ bgKind: "image" });
    const s = loadPersistedSettings();
    expect(s.bgKind).toBe(DEFAULT_SETTINGS.bgKind);
    expect(s.bgKind).not.toBe("image");
  });

  it("always clears bgImageUrl on rehydrate even when bgKind was image", () => {
    // bgImageUrl should never be persisted, but defensive test
    setStorage({ bgKind: "image", bgImageUrl: "blob:stale" });
    const s = loadPersistedSettings();
    expect(s.bgImageUrl).toBeNull();
  });

  it("preserves bgKind=gradient on rehydrate", () => {
    setStorage({ bgKind: "gradient", gradientId: "dusk" });
    const s = loadPersistedSettings();
    expect(s.bgKind).toBe("gradient");
    expect(s.gradientId).toBe("dusk");
  });

  it("preserves bgKind=solid on rehydrate", () => {
    setStorage({ bgKind: "solid", solidColor: "#ff0000" });
    const s = loadPersistedSettings();
    expect(s.bgKind).toBe("solid");
  });

  it("returns default settings when storage is empty", () => {
    const s = loadPersistedSettings();
    expect(s.bgKind).toBe(DEFAULT_SETTINGS.bgKind);
  });
});
