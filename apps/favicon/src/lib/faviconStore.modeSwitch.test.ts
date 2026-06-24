/**
 * Regression test for dogfood wave-2 bug #4:
 * setSourceMode() revokes the sourceUrl.  generate() must detect the stale url
 * and bail quietly instead of surfacing "Failed to load image".
 *
 * The guard in FaviconGenerator.tsx compares snapMode/snapUrl to the current
 * store values.  Here we verify the store-side half: after setSourceMode the
 * sourceUrl is null and the mode has changed — so snapUrl !== sourceUrl is true
 * and the guard would fire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFaviconStore } from "./faviconStore";

beforeEach(() => {
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  useFaviconStore.setState({
    sourceMode: "image",
    sourceUrl: "blob:source-image",
    sourceFile: null,
    sourceText: "",
    previews: [],
    zipUrl: null,
    status: "idle",
    errorMsg: null,
    progress: 0,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("faviconStore: mode-switch mid-generation guard", () => {
  it("sourceUrl is null after setSourceMode — snapshot comparison detects stale url", () => {
    // Simulate generate() capturing snapshot before setSourceMode fires
    const snapUrl = useFaviconStore.getState().sourceUrl; // "blob:source-image"
    const snapMode = useFaviconStore.getState().sourceMode; // "image"

    // User switches mode mid-generation
    useFaviconStore.getState().setSourceMode("text");

    const currentUrl = useFaviconStore.getState().sourceUrl;
    const currentMode = useFaviconStore.getState().sourceMode;

    // The guard condition in generate(): snapMode !== currentMode OR snapUrl !== currentUrl
    const shouldBail =
      snapMode !== currentMode || (snapMode === "image" && snapUrl !== currentUrl);
    expect(shouldBail).toBe(true);
  });

  it("sourceMode changes to text after setSourceMode('text')", () => {
    useFaviconStore.getState().setSourceMode("text");
    expect(useFaviconStore.getState().sourceMode).toBe("text");
  });

  it("sourceUrl becomes null after setSourceMode", () => {
    useFaviconStore.getState().setSourceMode("text");
    expect(useFaviconStore.getState().sourceUrl).toBeNull();
  });

  it("no bail when mode and url are unchanged", () => {
    const snapUrl = useFaviconStore.getState().sourceUrl;
    const snapMode = useFaviconStore.getState().sourceMode;
    const currentUrl = useFaviconStore.getState().sourceUrl;
    const currentMode = useFaviconStore.getState().sourceMode;

    const shouldBail =
      snapMode !== currentMode || (snapMode === "image" && snapUrl !== currentUrl);
    expect(shouldBail).toBe(false);
  });
});
