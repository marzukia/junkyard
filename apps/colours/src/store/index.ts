import { create } from "zustand";
import type { ColorSpace } from "../lib/color";
import type { CvdType } from "../lib/cvd";
import { loadPalette, savePalette } from "../lib/localStorage";
import {
  type HarmonyMode,
  MAX_PALETTE_COUNT,
  MIN_PALETTE_COUNT,
  clampCount,
  generatePalette,
  regeneratePalette,
} from "../lib/palette";
import type { ShareableState } from "../lib/share";

export type { HarmonyMode, CvdType };

export interface TwoPointState {
  start: string;
  end: string;
  steps: number;
}

export interface ThreePointState {
  start: string;
  mid: string;
  end: string;
  steps: number;
}

export interface PaletteState {
  colors: string[];
  locked: boolean[];
  count: number;
  harmonyMode: HarmonyMode;
}

/**
 * A single entry in the palette undo history.
 * Stored as a snapshot of the full PaletteState so undo is a simple swap.
 */
interface PaletteSnapshot {
  colors: string[];
  locked: boolean[];
  count: number;
  harmonyMode: HarmonyMode;
}

/** Maximum number of undo steps to keep in memory. */
const MAX_UNDO_DEPTH = 20;

/** How many recent palettes to expose in the strip (includes current, so strip = RECENT_COUNT - 1). */
export const RECENT_PALETTE_COUNT = 6;

interface ColoursStore {
  space: ColorSpace;
  setSpace: (space: ColorSpace) => void;

  cvdMode: CvdType;
  setCvdMode: (mode: CvdType) => void;

  twoPoint: TwoPointState;
  setTwoPoint: (patch: Partial<TwoPointState>) => void;

  threePoint: ThreePointState;
  setThreePoint: (patch: Partial<ThreePointState>) => void;

  palette: PaletteState;
  _seedCounter: number;
  regeneratePaletteColors: () => void;
  setPaletteCount: (count: number) => void;
  setPaletteHarmony: (mode: HarmonyMode) => void;
  togglePaletteLock: (index: number) => void;
  setPaletteColor: (index: number, hex: string) => void;
  resetPalette: () => void;
  loadImagePalette: (colors: string[]) => void;
  hydrate: (shared: ShareableState) => void;

  /** Undo stack — each entry is the palette state BEFORE the mutation. */
  _undoStack: PaletteSnapshot[];
  /** Recent palette ring (last RECENT_PALETTE_COUNT distinct generate results). */
  recentPalettes: string[][];
  canUndo: boolean;
  undoPalette: () => void;
}

const INITIAL_COUNT = 5;
// Monotonic counter ensures each generate call uses a distinct seed even on the same tick.
// Initialised with Date.now() so the starting palette differs across page loads.
let _globalSeedCounter = Date.now() & 0xffffffff;

// Try to restore from localStorage; fall back to a fresh palette.
const _persisted = loadPalette();
const initialCount = _persisted?.count ?? INITIAL_COUNT;
const initialHarmony: HarmonyMode = _persisted?.harmonyMode ?? "analogous";
const initialColors =
  _persisted?.colors ?? generatePalette(initialCount, initialHarmony, ++_globalSeedCounter);
const initialLocked = _persisted?.locked ?? Array(initialCount).fill(false);

export { MIN_PALETTE_COUNT, MAX_PALETTE_COUNT };

/** Push a snapshot onto the undo stack, capping at MAX_UNDO_DEPTH. */
function pushUndo(stack: PaletteSnapshot[], snapshot: PaletteSnapshot): PaletteSnapshot[] {
  const next = [...stack, snapshot];
  return next.length > MAX_UNDO_DEPTH ? next.slice(next.length - MAX_UNDO_DEPTH) : next;
}

/** Add a palette to the recent ring, deduplicating by string identity. */
function pushRecent(ring: string[][], colors: string[]): string[][] {
  const key = colors.join(",");
  const filtered = ring.filter((p) => p.join(",") !== key);
  const next = [colors, ...filtered];
  return next.length > RECENT_PALETTE_COUNT ? next.slice(0, RECENT_PALETTE_COUNT) : next;
}

export const useColoursStore = create<ColoursStore>((set, get) => ({
  space: "lab",
  setSpace: (space) => set({ space }),

  cvdMode: "none",
  setCvdMode: (mode) => set({ cvdMode: mode }),

  twoPoint: {
    start: "#2D3A4A",
    end: "#D4A574",
    steps: 8,
  },
  setTwoPoint: (patch) => set((s) => ({ twoPoint: { ...s.twoPoint, ...patch } })),

  threePoint: {
    start: "#1B4332",
    mid: "#74C69D",
    end: "#F8F4E1",
    steps: 9,
  },
  setThreePoint: (patch) => set((s) => ({ threePoint: { ...s.threePoint, ...patch } })),

  palette: {
    colors: initialColors,
    locked: initialLocked,
    count: initialCount,
    harmonyMode: initialHarmony,
  },

  // _seedCounter is always the last seed used; each generate call increments before use.
  _seedCounter: _globalSeedCounter,

  _undoStack: [],
  recentPalettes: [initialColors],
  canUndo: false,

  regeneratePaletteColors: () =>
    set((s) => {
      const snap: PaletteSnapshot = {
        colors: s.palette.colors,
        locked: s.palette.locked,
        count: s.palette.count,
        harmonyMode: s.palette.harmonyMode,
      };
      const nextSeed = s._seedCounter + 1;
      const newColors = regeneratePalette(
        s.palette.colors,
        s.palette.locked,
        s.palette.harmonyMode,
        nextSeed
      );
      const nextPalette = { ...s.palette, colors: newColors };
      savePalette(nextPalette);
      return {
        _seedCounter: nextSeed,
        _undoStack: pushUndo(s._undoStack, snap),
        recentPalettes: pushRecent(s.recentPalettes, newColors),
        canUndo: true,
        palette: nextPalette,
      };
    }),

  undoPalette: () =>
    set((s) => {
      if (s._undoStack.length === 0) return {};
      const stack = [...s._undoStack];
      const snap = stack.pop() as PaletteSnapshot;
      const nextPalette: PaletteState = {
        colors: snap.colors,
        locked: snap.locked,
        count: snap.count,
        harmonyMode: snap.harmonyMode,
      };
      savePalette(nextPalette);
      return {
        _undoStack: stack,
        canUndo: stack.length > 0,
        palette: nextPalette,
      };
    }),

  setPaletteCount: (count) => {
    const clamped = clampCount(count);
    set((s) => {
      const snap: PaletteSnapshot = {
        colors: s.palette.colors,
        locked: s.palette.locked,
        count: s.palette.count,
        harmonyMode: s.palette.harmonyMode,
      };
      const prev = s.palette;
      const nextSeed = s._seedCounter + 1;
      let newColors: string[];
      let newLocked: boolean[];
      if (clamped > prev.count) {
        // Regenerate the whole palette at the new count, preserving locked slots.
        // This keeps appended swatches harmonious with the existing palette.
        const extended = Array(clamped).fill(false) as boolean[];
        for (let i = 0; i < prev.locked.length; i++) extended[i] = prev.locked[i];
        newColors = regeneratePalette(
          [...prev.colors, ...Array(clamped - prev.count).fill("")],
          extended,
          prev.harmonyMode,
          nextSeed
        );
        newLocked = extended;
      } else {
        // Shrink: trim from the right
        newColors = prev.colors.slice(0, clamped);
        newLocked = prev.locked.slice(0, clamped);
      }
      const nextPalette: PaletteState = {
        ...prev,
        count: clamped,
        colors: newColors,
        locked: newLocked,
      };
      savePalette(nextPalette);
      return {
        _seedCounter: clamped > prev.count ? nextSeed : s._seedCounter,
        _undoStack: pushUndo(s._undoStack, snap),
        canUndo: true,
        palette: nextPalette,
      };
    });
  },

  setPaletteHarmony: (mode) => {
    set((s) => {
      const snap: PaletteSnapshot = {
        colors: s.palette.colors,
        locked: s.palette.locked,
        count: s.palette.count,
        harmonyMode: s.palette.harmonyMode,
      };
      const { colors, locked } = s.palette;
      const nextSeed = s._seedCounter + 1;
      const newColors = regeneratePalette(colors, locked, mode, nextSeed);
      const nextPalette: PaletteState = {
        ...s.palette,
        harmonyMode: mode,
        colors: newColors,
      };
      savePalette(nextPalette);
      return {
        _seedCounter: nextSeed,
        _undoStack: pushUndo(s._undoStack, snap),
        canUndo: true,
        palette: nextPalette,
      };
    });
  },

  togglePaletteLock: (index) => {
    set((s) => {
      const snap: PaletteSnapshot = {
        colors: s.palette.colors,
        locked: s.palette.locked,
        count: s.palette.count,
        harmonyMode: s.palette.harmonyMode,
      };
      const newLocked = s.palette.locked.map((v, i) => (i === index ? !v : v));
      const nextPalette = { ...s.palette, locked: newLocked };
      savePalette(nextPalette);
      return {
        _undoStack: pushUndo(s._undoStack, snap),
        canUndo: true,
        palette: nextPalette,
      };
    });
  },

  // Manually set a swatch's colour. Locks the slot so the next regenerate preserves it.
  setPaletteColor: (index, hex) => {
    set((s) => {
      const snap: PaletteSnapshot = {
        colors: s.palette.colors,
        locked: s.palette.locked,
        count: s.palette.count,
        harmonyMode: s.palette.harmonyMode,
      };
      const nextPalette: PaletteState = {
        ...s.palette,
        colors: s.palette.colors.map((c, i) => (i === index ? hex : c)),
        locked: s.palette.locked.map((v, i) => (i === index ? true : v)),
      };
      savePalette(nextPalette);
      return {
        _undoStack: pushUndo(s._undoStack, snap),
        canUndo: true,
        palette: nextPalette,
      };
    });
  },

  // Reset palette to a fresh 5-swatch analogous palette, clearing all locks.
  resetPalette: () =>
    set((s) => {
      const nextSeed = s._seedCounter + 1;
      const count = INITIAL_COUNT;
      const nextPalette: PaletteState = {
        colors: generatePalette(count, "analogous", nextSeed),
        locked: Array(count).fill(false),
        count,
        harmonyMode: "analogous",
      };
      savePalette(nextPalette);
      return {
        _seedCounter: nextSeed,
        _undoStack: [],
        canUndo: false,
        palette: nextPalette,
        recentPalettes: [nextPalette.colors],
      };
    }),

  // Load a palette extracted from an image. Pushes to undo/recent.
  loadImagePalette: (colors: string[]) =>
    set((s) => {
      const snap: PaletteSnapshot = {
        colors: s.palette.colors,
        locked: s.palette.locked,
        count: s.palette.count,
        harmonyMode: s.palette.harmonyMode,
      };
      const clamped = clampCount(colors.length);
      const safeColors = colors.slice(0, clamped);
      const nextPalette: PaletteState = {
        colors: safeColors,
        locked: Array(clamped).fill(false),
        count: clamped,
        harmonyMode: s.palette.harmonyMode,
      };
      savePalette(nextPalette);
      return {
        _undoStack: pushUndo(s._undoStack, snap),
        canUndo: true,
        recentPalettes: pushRecent(s.recentPalettes, safeColors),
        palette: nextPalette,
      };
    }),

  // Restore full app state from a decoded shareable permalink.
  // colors[]/locked[] lengths are already validated to match count by decodeState.
  hydrate: (shared) => {
    savePalette(shared.palette);
    set({
      space: shared.space,
      twoPoint: shared.twoPoint,
      threePoint: shared.threePoint,
      palette: shared.palette,
      _undoStack: [],
      canUndo: false,
      recentPalettes: [shared.palette.colors],
    });
  },
}));
