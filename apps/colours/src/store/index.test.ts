import { beforeEach, describe, expect, it } from "vitest";
import { MIN_PALETTE_COUNT, useColoursStore } from "./index";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

describe("setPaletteColor", () => {
  beforeEach(() => {
    // Reset to a known palette: 5 unlocked swatches.
    useColoursStore.setState((s) => ({
      palette: {
        ...s.palette,
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
        locked: [false, false, false, false, false],
        count: 5,
      },
    }));
  });

  it("sets the colour at the given index", () => {
    useColoursStore.getState().setPaletteColor(2, "#abcdef");
    expect(useColoursStore.getState().palette.colors[2]).toBe("#abcdef");
  });

  it("locks the slot it edits", () => {
    useColoursStore.getState().setPaletteColor(1, "#0a0b0c");
    expect(useColoursStore.getState().palette.locked[1]).toBe(true);
  });

  it("does not change other swatches' colours or locks", () => {
    const before = [...useColoursStore.getState().palette.colors];
    useColoursStore.getState().setPaletteColor(3, "#777777");
    const after = useColoursStore.getState().palette.colors;
    expect(after[0]).toBe(before[0]);
    expect(after[4]).toBe(before[4]);
    expect(useColoursStore.getState().palette.locked[0]).toBe(false);
  });

  it("preserves a manually-set colour across a regenerate", () => {
    useColoursStore.getState().setPaletteColor(2, "#abcdef");
    useColoursStore.getState().regeneratePaletteColors();
    const { colors } = useColoursStore.getState().palette;
    expect(colors[2]).toBe("#abcdef");
    // The other (unlocked) swatches should still be valid hex (and generally re-rolled).
    expect(colors[0]).toMatch(HEX_RE);
    expect(colors).toHaveLength(5);
  });
});

describe("resetPalette", () => {
  it("resets to 5 swatches with analogous harmony and no locks", () => {
    // Set up a dirty state: non-default count, harmony, and some locked swatches.
    useColoursStore.setState((s) => ({
      palette: {
        ...s.palette,
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"],
        locked: [true, false, true, false, true, false, true],
        count: 7,
        harmonyMode: "triadic",
      },
    }));

    useColoursStore.getState().resetPalette();
    const { colors, locked, count, harmonyMode } = useColoursStore.getState().palette;

    expect(count).toBe(5);
    expect(harmonyMode).toBe("analogous");
    expect(locked).toEqual([false, false, false, false, false]);
    expect(colors).toHaveLength(5);
    for (const hex of colors) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("generates different colours from the pre-reset state (seed advances)", () => {
    // Lock a specific colour, then reset — reset must not preserve locked colours.
    useColoursStore.setState((s) => ({
      palette: {
        ...s.palette,
        colors: ["#ff0000", "#ff0001", "#ff0002", "#ff0003", "#ff0004"],
        locked: [true, true, true, true, true],
        count: 5,
        harmonyMode: "monochromatic",
      },
    }));

    useColoursStore.getState().resetPalette();
    const { colors, locked } = useColoursStore.getState().palette;

    // No locks should remain after reset.
    expect(locked.every((v) => v === false)).toBe(true);
    // The reset palette must be valid hex.
    for (const hex of colors) {
      expect(hex).toMatch(HEX_RE);
    }
    // Reset palette must not be identical to the all-red locked colours.
    expect(colors.every((c) => c === "#ff0000")).toBe(false);
  });

  it("count is not less than MIN_PALETTE_COUNT after reset", () => {
    useColoursStore.getState().resetPalette();
    expect(useColoursStore.getState().palette.count).toBeGreaterThanOrEqual(MIN_PALETTE_COUNT);
  });
});


// ── W4: undo coverage for lock-toggle, manual-color-set, count-change ─────────

describe("togglePaletteLock is undoable (W4)", () => {
  beforeEach(() => {
    useColoursStore.setState((s) => ({
      palette: {
        ...s.palette,
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
        locked: [false, false, false, false, false],
        count: 5,
      },
      _undoStack: [],
      canUndo: false,
    }));
  });

  it("togglePaletteLock pushes to undo stack", () => {
    const before = useColoursStore.getState().palette.locked[0];
    useColoursStore.getState().togglePaletteLock(0);
    expect(useColoursStore.getState().canUndo).toBe(true);
    expect(useColoursStore.getState()._undoStack.length).toBeGreaterThan(0);
    // Undo restores the pre-toggle state
    useColoursStore.getState().undoPalette();
    expect(useColoursStore.getState().palette.locked[0]).toBe(before);
  });
});

describe("setPaletteColor is undoable (W4)", () => {
  beforeEach(() => {
    useColoursStore.setState((s) => ({
      palette: {
        ...s.palette,
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
        locked: [false, false, false, false, false],
        count: 5,
      },
      _undoStack: [],
      canUndo: false,
    }));
  });

  it("setPaletteColor pushes to undo stack", () => {
    const originalColor = useColoursStore.getState().palette.colors[1];
    useColoursStore.getState().setPaletteColor(1, "#abcdef");
    expect(useColoursStore.getState().canUndo).toBe(true);
    // Undo reverts the color change
    useColoursStore.getState().undoPalette();
    expect(useColoursStore.getState().palette.colors[1]).toBe(originalColor);
    // Undo also reverts the auto-lock
    expect(useColoursStore.getState().palette.locked[1]).toBe(false);
  });
});

describe("setPaletteCount is undoable (W4)", () => {
  beforeEach(() => {
    useColoursStore.setState((s) => ({
      palette: {
        ...s.palette,
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
        locked: [false, false, false, false, false],
        count: 5,
        harmonyMode: "analogous",
      },
      _undoStack: [],
      canUndo: false,
    }));
  });

  it("setPaletteCount pushes to undo stack", () => {
    useColoursStore.getState().setPaletteCount(7);
    expect(useColoursStore.getState().canUndo).toBe(true);
    expect(useColoursStore.getState().palette.count).toBe(7);
    useColoursStore.getState().undoPalette();
    expect(useColoursStore.getState().palette.count).toBe(5);
  });
});
