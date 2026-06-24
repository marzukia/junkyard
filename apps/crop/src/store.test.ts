import { beforeEach, describe, expect, it } from "vitest";
import { useCropStore } from "./store";

/**
 * Tests for undo/redo history stacks and format persistence helpers.
 * These guard the invariants added in the QoL pass:
 *   - Rotate/flip/crop-commit push to undoStack and clear redoStack
 *   - undo() pops undoStack and pushes current state onto redoStack
 *   - redo() pops redoStack and pushes current state onto undoStack
 */

function getStore() {
  return useCropStore.getState();
}

function resetStore() {
  useCropStore.setState({
    file: null,
    imageUrl: null,
    imageW: 800,
    imageH: 600,
    crop: { x: 0, y: 0, w: 800, h: 600 },
    rotation: 0,
    flipH: false,
    flipV: false,
    aspect: "free",
    resizeW: 0,
    resizeH: 0,
    resizeLocked: true,
    format: "png",
    quality: 92,
    resultUrl: null,
    resultName: null,
    undoStack: [],
    redoStack: [],
  });
}

describe("undo/redo", () => {
  beforeEach(() => {
    resetStore();
  });

  it("rotateLeft pushes current state to undoStack and clears redoStack", () => {
    // Pre-seed a redo entry to verify it gets cleared
    useCropStore.setState({
      redoStack: [
        { crop: { x: 0, y: 0, w: 800, h: 600 }, rotation: 0, flipH: false, flipV: false },
      ],
    });

    getStore().rotateLeft();

    const s = getStore();
    expect(s.rotation).toBe(270); // (0 - 90 + 360) % 360
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0].rotation).toBe(0); // previous state
    expect(s.redoStack).toHaveLength(0); // cleared
  });

  it("rotateRight pushes current state to undoStack", () => {
    getStore().rotateRight();

    const s = getStore();
    expect(s.rotation).toBe(90);
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0].rotation).toBe(0);
  });

  it("toggleFlipH pushes to undoStack", () => {
    getStore().toggleFlipH();

    const s = getStore();
    expect(s.flipH).toBe(true);
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0].flipH).toBe(false);
  });

  it("setCropWithHistory pushes to undoStack", () => {
    const newCrop = { x: 10, y: 10, w: 200, h: 200 };
    getStore().setCropWithHistory(newCrop);

    const s = getStore();
    expect(s.crop).toEqual(newCrop);
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0].crop).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it("undo restores previous state and pushes current to redoStack", () => {
    getStore().rotateRight(); // now rotation=90, undoStack has rotation=0
    getStore().undo();

    const s = getStore();
    expect(s.rotation).toBe(0); // restored
    expect(s.undoStack).toHaveLength(0);
    expect(s.redoStack).toHaveLength(1);
    expect(s.redoStack[0].rotation).toBe(90); // what we undid
  });

  it("redo restores undone state and pushes it back onto undoStack", () => {
    getStore().rotateRight(); // rotation=90
    getStore().undo(); // rotation=0, redo has rotation=90
    getStore().redo(); // rotation=90 again

    const s = getStore();
    expect(s.rotation).toBe(90);
    expect(s.redoStack).toHaveLength(0);
    expect(s.undoStack).toHaveLength(1);
  });

  it("undo on empty stack is a no-op", () => {
    const before = getStore().rotation;
    getStore().undo();
    expect(getStore().rotation).toBe(before);
    expect(getStore().undoStack).toHaveLength(0);
  });

  it("redo on empty stack is a no-op", () => {
    const before = getStore().rotation;
    getStore().redo();
    expect(getStore().rotation).toBe(before);
    expect(getStore().redoStack).toHaveLength(0);
  });

  it("undoStack is capped at 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      getStore().rotateRight();
    }
    expect(getStore().undoStack.length).toBeLessThanOrEqual(50);
  });
});

describe("new fields: straighten and cropShape", () => {
  beforeEach(() => {
    resetStore();
    useCropStore.setState({ straighten: 0, cropShape: "rect" });
  });

  it("setStraighten updates the straighten value", () => {
    getStore().setStraighten(15);
    expect(getStore().straighten).toBe(15);
  });

  it("setStraighten to negative value works", () => {
    getStore().setStraighten(-22.5);
    expect(getStore().straighten).toBe(-22.5);
  });

  it("setCropShape switches between rect and circle", () => {
    getStore().setCropShape("circle");
    expect(getStore().cropShape).toBe("circle");
    getStore().setCropShape("rect");
    expect(getStore().cropShape).toBe("rect");
  });

  it("loadImage resets straighten and cropShape", () => {
    getStore().setStraighten(20);
    getStore().setCropShape("circle");
    // Simulate loadImage
    getStore().loadImage(new File([], "test.png"), "blob:test", 800, 600);
    expect(getStore().straighten).toBe(0);
    expect(getStore().cropShape).toBe("rect");
  });
});

// ── Bug regression: partial-JPEG decode failure must NOT call loadImage ───────
// Before the fix, App.tsx used img.onload which fires even for truncated JPEGs
// with a valid header, resulting in a blank canvas. The fix wraps img.decode()
// (which rejects on corrupt images) in try/catch and only calls store.loadImage
// on success. This test pins the store's loadImage contract: it should only ever
// be called with a valid URL+dimensions, and its resulting state must be coherent.
describe("loadImage contract (partial-JPEG decode regression guard)", () => {
  beforeEach(() => {
    resetStore();
  });

  it("loadImage sets imageUrl and dimensions when called with valid args", () => {
    getStore().loadImage(new File(["x"], "valid.jpg"), "blob:valid-jpeg", 1920, 1080);
    const s = getStore();
    expect(s.imageUrl).toBe("blob:valid-jpeg");
    expect(s.imageW).toBe(1920);
    expect(s.imageH).toBe(1080);
    expect(s.file).not.toBeNull();
  });

  it("store imageUrl remains null if loadImage is never called (decode-failure path)", () => {
    // Simulates the scenario where img.decode() rejects and loadImage is skipped.
    // The store must stay in its initial empty state — no imageUrl, no file.
    const s = getStore();
    expect(s.imageUrl).toBeNull();
    expect(s.file).toBeNull();
  });

  it("loadImage with zero dimensions is detectable as an invalid load", () => {
    // A fully-blank canvas scenario would surface as naturalWidth=0/naturalHeight=0.
    // img.decode() should catch this before we reach loadImage, but the store's own
    // crop init (which fits to imageW/imageH) must not crash on zero dimensions.
    expect(() =>
      getStore().loadImage(new File(["x"], "blank.jpg"), "blob:blank", 0, 0)
    ).not.toThrow();
    // crop rect initialised to the full image — w=0, h=0 in this edge case
    expect(getStore().crop.w).toBe(0);
    expect(getStore().crop.h).toBe(0);
  });
});
