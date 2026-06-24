/**
 * Regression test for dogfood bug #1:
 * Sidebar used `generating` but it was missing from the useChatStore() destructure.
 * This asserts the store exposes `generating` and that calling setGenerating
 * updates it — confirming the field Sidebar reads is wired through the store.
 */
import { describe, expect, it } from "vitest";
import { useChatStore } from "./chatStore";

describe("chatStore — generating field (bug #1 regression)", () => {
  it("exposes generating with a default of false", () => {
    const state = useChatStore.getState();
    expect(typeof state.generating).toBe("boolean");
    expect(state.generating).toBe(false);
  });

  it("setGenerating(true) flips generating to true", () => {
    useChatStore.getState().setGenerating(true);
    expect(useChatStore.getState().generating).toBe(true);
    // restore
    useChatStore.getState().setGenerating(false);
  });

  it("Sidebar selector includes generating — reads correctly when true", () => {
    // Simulate the selector Sidebar now uses
    useChatStore.getState().setGenerating(true);
    const { generating } = useChatStore.getState();
    expect(generating).toBe(true);
    // restore
    useChatStore.getState().setGenerating(false);
  });
});
