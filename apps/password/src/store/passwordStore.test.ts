/**
 * Tests for passwordStore rehydration clamping (Bug 4).
 *
 * Poisoned localStorage values (length ≤ 0, NaN, wordCount ≤ 0, count > 20)
 * must be clamped to valid ranges so output is never an empty string and
 * counts stay bounded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function freshStore() {
  vi.resetModules();
  const { usePasswordStore } = await import("./passwordStore");
  return usePasswordStore;
}

describe("passwordStore — poisoned localStorage clamping", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("uses safe defaults when no persisted state exists", async () => {
    const store = await freshStore();
    const s = store.getState();
    expect(s.length).toBeGreaterThan(0);
    expect(s.wordCount).toBeGreaterThan(0);
    expect(s.count).toBeGreaterThanOrEqual(1);
    expect(s.count).toBeLessThanOrEqual(20);
  });

  it("clamps length=0 to default (20)", async () => {
    localStorage.setItem(
      "pw-generator-settings",
      JSON.stringify({
        state: {
          length: 0,
          wordCount: 5,
          count: 5,
          mode: "random",
          upper: true,
          lower: true,
          digits: true,
          symbols: true,
          excludeAmbiguous: false,
          minDigits: 0,
          minSymbols: 0,
          separator: "-",
          capitalize: false,
          appendNumber: false,
        },
        version: 0,
      })
    );
    const store = await freshStore();
    expect(store.getState().length).toBeGreaterThanOrEqual(4);
  });

  it("clamps length=NaN to default (20)", async () => {
    localStorage.setItem(
      "pw-generator-settings",
      JSON.stringify({
        state: {
          length: null,
          wordCount: 5,
          count: 5,
          mode: "random",
          upper: true,
          lower: true,
          digits: true,
          symbols: true,
          excludeAmbiguous: false,
          minDigits: 0,
          minSymbols: 0,
          separator: "-",
          capitalize: false,
          appendNumber: false,
        },
        version: 0,
      })
    );
    const store = await freshStore();
    expect(store.getState().length).toBeGreaterThanOrEqual(4);
  });

  it("clamps wordCount=0 to default (5)", async () => {
    localStorage.setItem(
      "pw-generator-settings",
      JSON.stringify({
        state: {
          length: 20,
          wordCount: 0,
          count: 5,
          mode: "passphrase",
          upper: true,
          lower: true,
          digits: true,
          symbols: true,
          excludeAmbiguous: false,
          minDigits: 0,
          minSymbols: 0,
          separator: "-",
          capitalize: false,
          appendNumber: false,
        },
        version: 0,
      })
    );
    const store = await freshStore();
    expect(store.getState().wordCount).toBeGreaterThanOrEqual(1);
  });

  it("clamps count=500 to max 20", async () => {
    localStorage.setItem(
      "pw-generator-settings",
      JSON.stringify({
        state: {
          length: 20,
          wordCount: 5,
          count: 500,
          mode: "random",
          upper: true,
          lower: true,
          digits: true,
          symbols: true,
          excludeAmbiguous: false,
          minDigits: 0,
          minSymbols: 0,
          separator: "-",
          capitalize: false,
          appendNumber: false,
        },
        version: 0,
      })
    );
    const store = await freshStore();
    expect(store.getState().count).toBeLessThanOrEqual(20);
  });

  it("clamps count=0 to at least 1", async () => {
    localStorage.setItem(
      "pw-generator-settings",
      JSON.stringify({
        state: {
          length: 20,
          wordCount: 5,
          count: 0,
          mode: "random",
          upper: true,
          lower: true,
          digits: true,
          symbols: true,
          excludeAmbiguous: false,
          minDigits: 0,
          minSymbols: 0,
          separator: "-",
          capitalize: false,
          appendNumber: false,
        },
        version: 0,
      })
    );
    const store = await freshStore();
    expect(store.getState().count).toBeGreaterThanOrEqual(1);
  });

  it("valid persisted values pass through unchanged", async () => {
    localStorage.setItem(
      "pw-generator-settings",
      JSON.stringify({
        state: {
          length: 16,
          wordCount: 4,
          count: 3,
          mode: "random",
          upper: true,
          lower: true,
          digits: true,
          symbols: false,
          excludeAmbiguous: false,
          minDigits: 0,
          minSymbols: 0,
          separator: "-",
          capitalize: false,
          appendNumber: false,
        },
        version: 0,
      })
    );
    const store = await freshStore();
    expect(store.getState().length).toBe(16);
    expect(store.getState().wordCount).toBe(4);
    expect(store.getState().count).toBe(3);
  });
});
