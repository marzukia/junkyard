/**
 * Regression tests for markdownStore persist rehydration robustness.
 * Poison the localStorage with a non-string source and verify the store
 * falls back to DEFAULT_MD rather than throwing on marked.parse(nonString).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "md-editor-source";

function writePersistedSource(value: unknown) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ state: { source: value }, version: 0 }));
}

describe("markdownStore — persist rehydration guard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("falls back to DEFAULT_MD when persisted source is a number", async () => {
    writePersistedSource(99);
    const { useMarkdownStore, DEFAULT_MD } = await import("./markdownStore");
    expect(useMarkdownStore.getState().source).toBe(DEFAULT_MD);
  });

  it("falls back to DEFAULT_MD when persisted source is null", async () => {
    writePersistedSource(null);
    const { useMarkdownStore, DEFAULT_MD } = await import("./markdownStore");
    expect(useMarkdownStore.getState().source).toBe(DEFAULT_MD);
  });

  it("falls back to DEFAULT_MD when persisted source is an array", async () => {
    writePersistedSource(["line1", "line2"]);
    const { useMarkdownStore, DEFAULT_MD } = await import("./markdownStore");
    expect(useMarkdownStore.getState().source).toBe(DEFAULT_MD);
  });

  it("preserves a valid string source on rehydrate", async () => {
    writePersistedSource("# My Notes\n\nSome content here.");
    const { useMarkdownStore } = await import("./markdownStore");
    expect(useMarkdownStore.getState().source).toBe("# My Notes\n\nSome content here.");
  });

  it("source is always a string after rehydrating a poisoned value", async () => {
    writePersistedSource({ obj: true });
    const { useMarkdownStore } = await import("./markdownStore");
    expect(typeof useMarkdownStore.getState().source).toBe("string");
  });
});
