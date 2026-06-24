/**
 * Palette generation logic — no React/Mantine imports so this is unit-testable.
 *
 * All harmony modes generate from a base hue in HSL space, with controlled
 * saturation and lightness spreads so palettes look designed, not muddy.
 * Culori is used for the final hsl→hex conversion.
 */

import { formatHex, hsl } from "culori";

export type HarmonyMode = "auto" | "analogous" | "complementary" | "triadic" | "monochromatic";

export const HARMONY_MODES: { value: HarmonyMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "analogous", label: "Analogous" },
  { value: "complementary", label: "Complementary" },
  { value: "triadic", label: "Triadic" },
  { value: "monochromatic", label: "Monochromatic" },
];

export const MIN_PALETTE_COUNT = 3;
export const MAX_PALETTE_COUNT = 8;

/**
 * A minimal seeded PRNG (mulberry32) so palette generation can be deterministic
 * given the same seed. Accepts a 32-bit integer seed.
 */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert fractional HSL (h∈[0,1], s∈[0,1], l∈[0,1]) to a #rrggbb hex string. */
function hslToHex(h: number, s: number, l: number): string {
  return formatHex({ mode: "hsl", h: h * 360, s, l }) ?? "#000000";
}

/** Wrap a hue value into [0, 1). */
function wrapHue(h: number): number {
  return ((h % 1) + 1) % 1;
}

/**
 * Extract the HSL hue fraction (0..1) from a hex colour string.
 * Returns undefined for achromatic colours (saturation ≤ 0.04) or parse failures,
 * so callers can gracefully fall back to a random base hue.
 */
export function hueFromHex(hex: string): number | undefined {
  try {
    const parsed = hsl(hex);
    if (!parsed) return undefined;
    // Achromatic (greyscale) colours have no meaningful hue
    if ((parsed.s ?? 0) <= 0.04) return undefined;
    return parsed.h !== undefined ? parsed.h / 360 : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Derive a base hue from the first locked colour in the palette.
 * Returns undefined if no colour is locked, or if the locked colour is achromatic.
 */
export function deriveSeedHue(current: string[], locked: boolean[]): number | undefined {
  for (let i = 0; i < locked.length; i++) {
    if (locked[i] && current[i]) {
      return hueFromHex(current[i]);
    }
  }
  return undefined;
}

/**
 * Generate a harmonious palette.
 *
 * @param count   Number of swatches (clamped to MIN_PALETTE_COUNT..MAX_PALETTE_COUNT)
 * @param mode    Harmony mode
 * @param seed    Optional 32-bit integer seed for the PRNG (defaults to Date.now())
 * @param baseHue Optional base hue in [0, 1] (overrides PRNG-derived hue)
 */
export function generatePalette(
  count: number,
  mode: HarmonyMode,
  seed?: number,
  baseHue?: number
): string[] {
  const n = Math.max(MIN_PALETTE_COUNT, Math.min(MAX_PALETTE_COUNT, count));
  const rand = mulberry32(seed ?? Date.now() & 0xffffffff);

  const hue = baseHue !== undefined ? baseHue : rand();

  switch (mode) {
    case "monochromatic":
      return generateMonochromatic(hue, n, rand);
    case "analogous":
      return generateAnalogous(hue, n, rand);
    case "complementary":
      return generateComplementary(hue, n, rand);
    case "triadic":
      return generateTriadic(hue, n, rand);
    default: {
      // Pick a random harmony mode (not auto itself) for variety
      const modes = HARMONY_MODES.filter((m) => m.value !== "auto").map((m) => m.value);
      const picked = modes[Math.floor(rand() * modes.length)];
      return generatePalette(n, picked, seed, hue);
    }
  }
}

/**
 * Regenerate a palette, preserving swatches at locked indices.
 * When one or more swatches are locked, the base hue is derived from the first
 * locked colour so unlocked swatches are harmonious with the seed colour.
 * Achromatic locked colours (greyscale) fall back to a random base hue.
 *
 * @param current  Existing color array
 * @param locked   Boolean array parallel to `current`; true = preserve that index
 * @param mode     Harmony mode
 * @param seed     PRNG seed
 */
export function regeneratePalette(
  current: string[],
  locked: boolean[],
  mode: HarmonyMode,
  seed?: number
): string[] {
  const count = current.length;
  const seedHue = deriveSeedHue(current, locked);
  const fresh = generatePalette(count, mode, seed, seedHue);
  return fresh.map((color, i) => (locked[i] ? current[i] : color));
}

/**
 * Clamp a palette count to the valid [MIN, MAX] range and round to integer.
 * NaN (e.g. from a crafted permalink) falls back to MIN_PALETTE_COUNT.
 */
export function clampCount(n: number): number {
  const safe = Number.isNaN(n) ? MIN_PALETTE_COUNT : n;
  return Math.round(Math.max(MIN_PALETTE_COUNT, Math.min(MAX_PALETTE_COUNT, safe)));
}

// ── Harmony generators ────────────────────────────────────────────────────────

/**
 * Monochromatic: same hue, varied saturation and lightness across a tasteful range.
 * Avoids the muddy middle by keeping saturation above 0.35 and spreading lightness
 * from ~0.25 (rich dark) to ~0.88 (near-white tint).
 */
function generateMonochromatic(baseHue: number, n: number, rand: () => number): string[] {
  // Saturation: high and consistent (0.45–0.75) so all swatches feel related
  const baseSat = 0.45 + rand() * 0.3;
  // Lightness spread: from 0.20 to 0.88
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const l = 0.2 + t * 0.68;
    // Slight saturation variation so it doesn't look purely synthetic
    const s = Math.max(0.15, baseSat - t * 0.15);
    return hslToHex(baseHue, s, l);
  });
}

/**
 * Analogous: hues clustered within ±40° of the base, with a light randomised spread.
 * Saturation 0.55–0.80, lightness 0.35–0.72 to keep them vivid.
 */
function generateAnalogous(baseHue: number, n: number, rand: () => number): string[] {
  const spread = 0.08 + rand() * 0.05; // ±28–47° in fraction
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const h = wrapHue(baseHue - spread + t * spread * 2);
    const s = 0.55 + rand() * 0.25;
    const l = 0.38 + rand() * 0.3;
    return hslToHex(h, s, l);
  });
}

/**
 * Complementary: hues split between base quadrant and its complement (±180°),
 * with accent neutrals in the middle to help them coexist.
 */
function generateComplementary(baseHue: number, n: number, rand: () => number): string[] {
  const compHue = wrapHue(baseHue + 0.5);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    // Alternate between base family and complement family
    const useComp = i % 2 === 1;
    const anchorHue = useComp ? compHue : baseHue;
    const h = wrapHue(anchorHue + (rand() - 0.5) * 0.06);
    const s = 0.5 + rand() * 0.3;
    // Lightness varies across the palette so adjacent swatches are distinguishable
    const l = 0.3 + t * 0.5 + (rand() - 0.5) * 0.08;
    return hslToHex(h, Math.min(0.95, s), Math.max(0.15, Math.min(0.88, l)));
  });
}

/**
 * Triadic: three anchor hues at 0°, 120°, 240° from the base, then n swatches
 * drawn round-robin from these anchors with lightness variation.
 */
function generateTriadic(baseHue: number, n: number, rand: () => number): string[] {
  const anchors = [baseHue, wrapHue(baseHue + 1 / 3), wrapHue(baseHue + 2 / 3)];
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const anchor = anchors[i % 3];
    const h = wrapHue(anchor + (rand() - 0.5) * 0.05);
    const s = 0.55 + rand() * 0.25;
    const l = 0.32 + t * 0.45 + (rand() - 0.5) * 0.08;
    return hslToHex(h, Math.min(0.95, s), Math.max(0.18, Math.min(0.85, l)));
  });
}
