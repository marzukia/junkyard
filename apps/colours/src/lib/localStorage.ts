/**
 * localStorage persistence helpers for the Colours palette state.
 *
 * Only persists the palette (colors + locked + count + harmony) since that is
 * the in-progress work the user is most likely to lose on a refresh. The URL
 * hash already handles full-state sharing/restoring via the share link.
 *
 * Uses a versioned key so future format changes can migrate gracefully.
 */

import { normalizeHex } from "./color";
import { MIN_PALETTE_COUNT, clampCount } from "./palette";
import { HARMONY_MODES } from "./palette";
import type { HarmonyMode } from "./palette";

const STORAGE_KEY = "colours_palette_v1";

export interface PersistedPalette {
  colors: string[];
  locked: boolean[];
  count: number;
  harmonyMode: HarmonyMode;
}

const VALID_HARMONY_MODES = new Set<string>(HARMONY_MODES.map((m) => m.value));

/** Write the current palette to localStorage. Never throws. */
export function savePalette(palette: PersistedPalette): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
  } catch {
    // Quota exceeded or private browsing — silently ignore.
  }
}

/**
 * Read the persisted palette from localStorage.
 * Returns null if nothing is stored or if the stored data is invalid.
 * Never throws.
 */
export function loadPalette(): PersistedPalette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;

    const count = clampCount(typeof p.count === "number" ? p.count : MIN_PALETTE_COUNT);

    const rawColors = Array.isArray(p.colors) ? p.colors : [];
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      const normalized = normalizeHex(String(rawColors[i] ?? ""));
      colors.push(normalized ?? "#808080");
    }

    const rawLocked = Array.isArray(p.locked) ? p.locked : [];
    const locked: boolean[] = Array.from({ length: count }, (_, i) =>
      Boolean(rawLocked[i] ?? false)
    );

    const harmonyMode: HarmonyMode = VALID_HARMONY_MODES.has(String(p.harmonyMode))
      ? (p.harmonyMode as HarmonyMode)
      : "analogous";

    return { colors, locked, count, harmonyMode };
  } catch {
    return null;
  }
}

/** Remove the persisted palette. Never throws. */
export function clearPalette(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
