import { create } from "zustand";
import type { FreeformCard } from "../lib/canvasExport";
import type { CollageShapeId } from "../lib/collageShapes";

export type AppMode = "grid" | "freeform";

export interface GridCell {
  id: string;
  photoUrl: string | null;
  photoFile: File | null;
  panX: number; // focal point [-0.5, 0.5]
  panY: number;
  zoom: number; // >=1
}

// Snapshot of just cell contents for undo
type CellsSnapshot = GridCell[];

const SETTINGS_KEY = "collage:settings:v2";

interface PersistedSettings {
  templateId: string;
  aspectId: string;
  gutter: number;
  radius: number;
  background: string;
  collageShape: CollageShapeId;
  borderWidth: number;
  borderColor: string;
}

function loadSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}

function saveSettings(s: PersistedSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage quota or private mode — silently ignore
  }
}

export interface CollageStore {
  // Mode
  mode: AppMode;
  setMode: (m: AppMode) => void;

  // Layout
  templateId: string;
  setTemplateId: (id: string) => void;
  cells: GridCell[];
  setCells: (cells: GridCell[]) => void;
  updateCell: (id: string, patch: Partial<GridCell>) => void;
  assignPhotoToCell: (cellId: string, url: string, file: File) => void;
  removePhotoFromCell: (cellId: string) => void;
  swapCells: (aId: string, bId: string) => void;

  // Undo
  undoStack: CellsSnapshot[];
  pushUndo: () => void;
  undo: () => void;
  canUndo: boolean;

  // Canvas appearance
  aspectId: string;
  setAspectId: (id: string) => void;
  gutter: number;
  setGutter: (px: number) => void;
  radius: number;
  setRadius: (px: number) => void;
  background: string;
  setBackground: (c: string) => void;
  collageShape: CollageShapeId;
  setCollageShape: (s: CollageShapeId) => void;
  borderWidth: number;
  setBorderWidth: (px: number) => void;
  borderColor: string;
  setBorderColor: (c: string) => void;

  // Global photo library (for the drop zone)
  library: { url: string; file: File }[];
  addPhotos: (files: File[]) => void;
  clearLibrary: () => void;

  // Freeform cards
  freeformCards: FreeformCard[];
  addFreeformCard: (card: FreeformCard) => void;
  updateFreeformCard: (id: string, patch: Partial<FreeformCard>) => void;
  removeFreeformCard: (id: string) => void;
  clearFreeformCards: () => void;

  // Selected cell (for per-cell controls panel)
  selectedCellId: string | null;
  setSelectedCellId: (id: string | null) => void;
}

function makeCells(count: number): GridCell[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cell-${i}`,
    photoUrl: null,
    photoFile: null,
    panX: 0,
    panY: 0,
    zoom: 1,
  }));
}

const LAYOUT_COUNTS: Record<string, number> = {
  single: 1,
  "2-horizontal": 2,
  "2-vertical": 2,
  "3-left-large": 3,
  "3-top-large": 3,
  "3-equal": 3,
  "4-grid": 4,
  "4-banner": 4,
  "6-grid": 6,
  "9-grid": 9,
};

const MAX_UNDO = 20;

// Load saved settings once at module init
const saved = loadSettings();

export const useCollageStore = create<CollageStore>((set, get) => ({
  mode: "grid",
  setMode: (m) => set({ mode: m }),

  templateId: saved.templateId ?? "4-grid",
  setTemplateId: (id) => {
    const count = LAYOUT_COUNTS[id] ?? 4;
    const existing = get().cells;
    const newCells = makeCells(count).map((c, i) => ({
      ...c,
      photoUrl: existing[i]?.photoUrl ?? null,
      photoFile: existing[i]?.photoFile ?? null,
      panX: existing[i]?.panX ?? 0,
      panY: existing[i]?.panY ?? 0,
      zoom: existing[i]?.zoom ?? 1,
    }));
    const s = get();
    saveSettings({
      templateId: id,
      aspectId: s.aspectId,
      gutter: s.gutter,
      radius: s.radius,
      background: s.background,
      collageShape: s.collageShape,
      borderWidth: s.borderWidth,
      borderColor: s.borderColor,
    });
    set({ templateId: id, cells: newCells, selectedCellId: null });
  },

  cells: makeCells(LAYOUT_COUNTS[saved.templateId ?? "4-grid"] ?? 4),
  setCells: (cells) => set({ cells }),
  updateCell: (id, patch) =>
    set((s) => ({ cells: s.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  assignPhotoToCell: (cellId, url, file) =>
    set((s) => ({
      cells: s.cells.map((c) =>
        c.id === cellId ? { ...c, photoUrl: url, photoFile: file, panX: 0, panY: 0, zoom: 1 } : c
      ),
    })),
  removePhotoFromCell: (cellId) => {
    const s = get();
    // Push undo before mutating
    const snapshot = s.cells.map((c) => ({ ...c }));
    set((st) => ({
      undoStack: [...st.undoStack, snapshot].slice(-MAX_UNDO),
      canUndo: true,
      cells: st.cells.map((c) => (c.id === cellId ? { ...c, photoUrl: null, photoFile: null } : c)),
    }));
  },
  swapCells: (aId, bId) => {
    const s = get();
    const snapshot = s.cells.map((c) => ({ ...c }));
    set((st) => {
      const a = st.cells.find((c) => c.id === aId);
      const b = st.cells.find((c) => c.id === bId);
      if (!a || !b) return st;
      return {
        undoStack: [...st.undoStack, snapshot].slice(-MAX_UNDO),
        canUndo: true,
        cells: st.cells.map((c) => {
          if (c.id === aId)
            return {
              ...c,
              photoUrl: b.photoUrl,
              photoFile: b.photoFile,
              panX: b.panX,
              panY: b.panY,
              zoom: b.zoom,
            };
          if (c.id === bId)
            return {
              ...c,
              photoUrl: a.photoUrl,
              photoFile: a.photoFile,
              panX: a.panX,
              panY: a.panY,
              zoom: a.zoom,
            };
          return c;
        }),
      };
    });
  },

  undoStack: [],
  canUndo: false,
  pushUndo: () => {
    const snapshot = get().cells.map((c) => ({ ...c }));
    set((s) => ({
      undoStack: [...s.undoStack, snapshot].slice(-MAX_UNDO),
      canUndo: true,
    }));
  },
  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set((s) => ({
      cells: prev,
      undoStack: s.undoStack.slice(0, -1),
      canUndo: s.undoStack.length > 1,
    }));
  },

  aspectId: saved.aspectId ?? "1:1",
  setAspectId: (id) => {
    const s = get();
    saveSettings({
      templateId: s.templateId,
      aspectId: id,
      gutter: s.gutter,
      radius: s.radius,
      background: s.background,
      collageShape: s.collageShape,
      borderWidth: s.borderWidth,
      borderColor: s.borderColor,
    });
    set({ aspectId: id });
  },
  gutter: saved.gutter ?? 8,
  setGutter: (px) => {
    const s = get();
    saveSettings({
      templateId: s.templateId,
      aspectId: s.aspectId,
      gutter: px,
      radius: s.radius,
      background: s.background,
      collageShape: s.collageShape,
      borderWidth: s.borderWidth,
      borderColor: s.borderColor,
    });
    set({ gutter: px });
  },
  radius: saved.radius ?? 0,
  setRadius: (px) => {
    const s = get();
    saveSettings({
      templateId: s.templateId,
      aspectId: s.aspectId,
      gutter: s.gutter,
      radius: px,
      background: s.background,
      collageShape: s.collageShape,
      borderWidth: s.borderWidth,
      borderColor: s.borderColor,
    });
    set({ radius: px });
  },
  background: saved.background ?? "#ffffff",
  setBackground: (c) => {
    const s = get();
    saveSettings({
      templateId: s.templateId,
      aspectId: s.aspectId,
      gutter: s.gutter,
      radius: s.radius,
      background: c,
      collageShape: s.collageShape,
      borderWidth: s.borderWidth,
      borderColor: s.borderColor,
    });
    set({ background: c });
  },
  collageShape: saved.collageShape ?? "rectangle",
  setCollageShape: (sh) => {
    const s = get();
    saveSettings({
      templateId: s.templateId,
      aspectId: s.aspectId,
      gutter: s.gutter,
      radius: s.radius,
      background: s.background,
      collageShape: sh,
      borderWidth: s.borderWidth,
      borderColor: s.borderColor,
    });
    set({ collageShape: sh });
  },

  borderWidth: saved.borderWidth ?? 0,
  setBorderWidth: (px) => {
    const s = get();
    saveSettings({
      templateId: s.templateId,
      aspectId: s.aspectId,
      gutter: s.gutter,
      radius: s.radius,
      background: s.background,
      collageShape: s.collageShape,
      borderWidth: px,
      borderColor: s.borderColor,
    });
    set({ borderWidth: px });
  },
  borderColor: saved.borderColor ?? "#000000",
  setBorderColor: (c) => {
    const s = get();
    saveSettings({
      templateId: s.templateId,
      aspectId: s.aspectId,
      gutter: s.gutter,
      radius: s.radius,
      background: s.background,
      collageShape: s.collageShape,
      borderWidth: s.borderWidth,
      borderColor: c,
    });
    set({ borderColor: c });
  },

  library: [],
  addPhotos: (files) => {
    const newEntries = files.map((f) => ({ url: URL.createObjectURL(f), file: f }));
    set((s) => ({ library: [...s.library, ...newEntries] }));
  },
  clearLibrary: () =>
    set((s) => {
      for (const e of s.library) URL.revokeObjectURL(e.url);
      return { library: [] };
    }),

  freeformCards: [],
  addFreeformCard: (card) => set((s) => ({ freeformCards: [...s.freeformCards, card] })),
  updateFreeformCard: (id, patch) =>
    set((s) => ({
      freeformCards: s.freeformCards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  removeFreeformCard: (id) =>
    set((s) => ({ freeformCards: s.freeformCards.filter((c) => c.id !== id) })),
  clearFreeformCards: () => set({ freeformCards: [] }),

  selectedCellId: null,
  setSelectedCellId: (id) => set({ selectedCellId: id }),
}));
