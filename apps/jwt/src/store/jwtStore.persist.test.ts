/**
 * Regression tests for jwtStore persist rehydration robustness.
 * Poison the localStorage with a non-string rawToken and verify the store
 * falls back to "" rather than throwing on rawToken.trim().
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "jwt-tool-state";

function writePersistedRawToken(value: unknown) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ state: { rawToken: value }, version: 0 }));
}

describe("jwtStore — persist rehydration guard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("falls back to '' when persisted rawToken is a number", async () => {
    writePersistedRawToken(42);
    const { useJwtStore } = await import("./jwtStore");
    expect(useJwtStore.getState().rawToken).toBe("");
  });

  it("falls back to '' when persisted rawToken is null", async () => {
    writePersistedRawToken(null);
    const { useJwtStore } = await import("./jwtStore");
    expect(useJwtStore.getState().rawToken).toBe("");
  });

  it("falls back to '' when persisted rawToken is an object", async () => {
    writePersistedRawToken({ nested: true });
    const { useJwtStore } = await import("./jwtStore");
    expect(useJwtStore.getState().rawToken).toBe("");
  });

  it("preserves a valid string rawToken on rehydrate", async () => {
    writePersistedRawToken("eyJhbGciOiJIUzI1NiJ9.test.sig");
    const { useJwtStore } = await import("./jwtStore");
    expect(useJwtStore.getState().rawToken).toBe("eyJhbGciOiJIUzI1NiJ9.test.sig");
  });

  it("rawToken.trim() does not throw when rehydrating a poisoned non-string value", async () => {
    writePersistedRawToken(false);
    const { useJwtStore } = await import("./jwtStore");
    expect(() => useJwtStore.getState().rawToken.trim()).not.toThrow();
  });
});
