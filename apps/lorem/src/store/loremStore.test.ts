/**
 * Verifies that user-facing selection state (mode, wordBank, etc.) survives a
 * simulated page reload via Zustand's localStorage persist middleware.
 *
 * Each test clears localStorage and re-imports the store module so we start
 * from a clean slate, mimicking a fresh page load with whatever the test puts
 * in storage beforehand.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Re-import the store from a fresh module each test so hydration runs again.
async function freshStore() {
  vi.resetModules();
  const { useLoremStore } = await import("./loremStore");
  return useLoremStore;
}

describe("loremStore persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("uses defaults when no persisted state exists", async () => {
    const store = await freshStore();
    const state = store.getState();
    expect(state.mode).toBe("paragraphs");
    expect(state.wordBank).toBe("classic");
    expect(state.count).toBe(3);
    expect(state.activeTab).toBe("lorem");
    expect(state.classicStart).toBe(false);
  });

  it("restores mode and wordBank from localStorage on reload", async () => {
    // Simulate what Zustand writes after the user changes selections.
    localStorage.setItem(
      "lorem-tool-settings",
      JSON.stringify({
        state: {
          mode: "words",
          wordBank: "hipster",
          count: 10,
          listStyle: "ordered",
          activeTab: "placeholder",
          classicStart: true,
          width: 1200,
          height: 630,
          bgColor: "#ff0000",
          textColor: "#ffffff",
          label: "test",
          format: "png",
        },
        version: 0,
      })
    );

    const store = await freshStore();
    const state = store.getState();

    expect(state.mode).toBe("words");
    expect(state.wordBank).toBe("hipster");
    expect(state.count).toBe(10);
    expect(state.listStyle).toBe("ordered");
    expect(state.activeTab).toBe("placeholder");
    expect(state.classicStart).toBe(true);
  });

  it("persists mode change immediately to localStorage", async () => {
    const store = await freshStore();
    store.getState().setMode("list");

    const raw = localStorage.getItem("lorem-tool-settings");
    expect(raw).not.toBeNull();
    if (!raw) return;
    const parsed = JSON.parse(raw);
    expect(parsed.state.mode).toBe("list");
  });

  it("persists wordBank change immediately to localStorage", async () => {
    const store = await freshStore();
    store.getState().setWordBank("bacon");

    const raw = localStorage.getItem("lorem-tool-settings");
    expect(raw).not.toBeNull();
    if (!raw) return;
    const parsed = JSON.parse(raw);
    expect(parsed.state.wordBank).toBe("bacon");
  });

  it("round-trips: change then reload restores the changed value", async () => {
    // Load 1: change mode to sentences and wordBank to corporate
    const store1 = await freshStore();
    store1.getState().setMode("sentences");
    store1.getState().setWordBank("corporate");

    // Simulate reload: re-import the module with localStorage already set
    const store2 = await freshStore();
    const state = store2.getState();
    expect(state.mode).toBe("sentences");
    expect(state.wordBank).toBe("corporate");
  });

  it("does not persist output or seed to localStorage", async () => {
    const store = await freshStore();
    // Trigger a write by changing something
    store.getState().setMode("words");

    const raw = localStorage.getItem("lorem-tool-settings");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    expect(parsed.state).not.toHaveProperty("seed");
    expect(parsed.state).not.toHaveProperty("output");
  });

  it("stores version 0 in localStorage", async () => {
    const store = await freshStore();
    store.getState().setMode("words");

    const raw = localStorage.getItem("lorem-tool-settings");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(0);
  });
});

// ── Bug 3: setMode clamps count to new mode's max ────────────────────────────

describe("loremStore setMode count clamping", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("switching from words (max 200) to paragraphs (max 20) clamps count to 20", async () => {
    const store = await freshStore();
    store.getState().setMode("words");
    store.getState().setCount(200);
    store.getState().setMode("paragraphs");
    expect(store.getState().count).toBe(20);
  });

  it("switching from words (max 200) to list (max 30) clamps count to 30", async () => {
    const store = await freshStore();
    store.getState().setMode("words");
    store.getState().setCount(200);
    store.getState().setMode("list");
    expect(store.getState().count).toBe(30);
  });

  it("switching from words (max 200) to sentences (max 20) clamps count to 20", async () => {
    const store = await freshStore();
    store.getState().setMode("words");
    store.getState().setCount(150);
    store.getState().setMode("sentences");
    expect(store.getState().count).toBe(20);
  });

  it("count in-range for new mode is not changed", async () => {
    const store = await freshStore();
    store.getState().setMode("words");
    store.getState().setCount(10);
    store.getState().setMode("paragraphs");
    expect(store.getState().count).toBe(10);
  });

  it("switching to words mode does not clamp (max 200)", async () => {
    const store = await freshStore();
    store.getState().setMode("paragraphs");
    store.getState().setCount(15);
    store.getState().setMode("words");
    expect(store.getState().count).toBe(15);
  });
});
