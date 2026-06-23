import { create } from "zustand";
import { DEFAULT_SETTINGS } from "./beautifier";
import type { BeautifySettings } from "./beautifier";

const STORAGE_KEY = "screenshot-settings-v1";

function loadPersistedSettings(): BeautifySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<BeautifySettings>;
    // Merge with defaults so any newly added fields have a value.
    // bgImageUrl is an object URL that doesn't survive page reload — always reset it.
    const merged: BeautifySettings = { ...DEFAULT_SETTINGS, ...parsed, bgImageUrl: null };
    // Legacy migration: showWindowFrame=true -> windowFrameType="macos"
    const legacy = parsed as { showWindowFrame?: boolean; windowFrameType?: string };
    if (!merged.windowFrameType && legacy.showWindowFrame) {
      merged.windowFrameType = "macos";
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(s: BeautifySettings): void {
  try {
    // bgImageUrl is an object URL that doesn't survive page reload; don't persist it.
    const { bgImageUrl: _, ...toPersist } = s;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

export interface ScreenshotState {
  settings: BeautifySettings;
  sourceFile: File | null;
  sourceUrl: string | null; // object URL of the loaded image
  previewUrl: string | null; // rendered canvas data-URL
  isRendering: boolean;
  /** Object URL for a user-uploaded background image (non-null only while bgKind=image). */
  bgObjectUrl: string | null;

  setSettings: (patch: Partial<BeautifySettings>) => void;
  setSourceFile: (file: File, objectUrl: string) => void;
  clearSource: () => void;
  setPreviewUrl: (url: string | null) => void;
  setIsRendering: (v: boolean) => void;
  setBgImage: (file: File) => void;
  clearBgImage: () => void;
}

export const useScreenshotStore = create<ScreenshotState>((set) => ({
  settings: loadPersistedSettings(),
  sourceFile: null,
  sourceUrl: null,
  previewUrl: null,
  isRendering: false,
  bgObjectUrl: null,

  setSettings: (patch) =>
    set((s) => {
      const next = { ...s.settings, ...patch };
      persistSettings(next);
      return { settings: next };
    }),

  setSourceFile: (file, objectUrl) =>
    set((s) => {
      if (s.sourceUrl) URL.revokeObjectURL(s.sourceUrl);
      return { sourceFile: file, sourceUrl: objectUrl, previewUrl: null };
    }),

  clearSource: () =>
    set((s) => {
      if (s.sourceUrl) URL.revokeObjectURL(s.sourceUrl);
      return { sourceFile: null, sourceUrl: null, previewUrl: null };
    }),

  setPreviewUrl: (url) => set({ previewUrl: url }),
  setIsRendering: (v) => set({ isRendering: v }),

  setBgImage: (file) =>
    set((s) => {
      if (s.bgObjectUrl) URL.revokeObjectURL(s.bgObjectUrl);
      const url = URL.createObjectURL(file);
      const next = { ...s.settings, bgKind: "image" as const, bgImageUrl: url };
      persistSettings(next);
      return { bgObjectUrl: url, settings: next };
    }),

  clearBgImage: () =>
    set((s) => {
      if (s.bgObjectUrl) URL.revokeObjectURL(s.bgObjectUrl);
      const next = { ...s.settings, bgKind: "gradient" as const, bgImageUrl: null };
      persistSettings(next);
      return { bgObjectUrl: null, settings: next };
    }),
}));
