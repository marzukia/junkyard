/**
 * Color interpolation utilities using culori.
 *
 * Why culori: it handles gamut-safe conversion between lab/rgb/hsl and produces
 * hex strings directly, so we don't need a secondary color lib.
 *
 * LAB interpolation is the default because it models human perception, producing
 * steps that look visually equidistant — unlike RGB/HSL which can have perceptual
 * jumps through yellow/cyan.
 */

import { clampChroma, formatHex, interpolate, wcagLuminance } from "culori";

/**
 * Validates and normalizes a hex color string (3 or 6 digit, with or without #).
 * Returns a lowercased 7-character hex string (e.g. "#aabbcc") or null if invalid.
 */
export function normalizeHex(raw: string): string | null {
  const stripped = raw.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(stripped)) return `#${stripped.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(stripped)) {
    const expanded = stripped
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return null;
}

export type ColorSpace = "lab" | "rgb" | "hsl";

/** All valid ColorSpace values as a runtime constant (kept in sync with the type above). */
export const COLOR_SPACES: ColorSpace[] = ["lab", "rgb", "hsl"];

/**
 * Generate N evenly-stepped hex colors between start and end in the given color space.
 */
export function interpolateTwo(
  start: string,
  end: string,
  steps: number,
  space: ColorSpace
): string[] {
  const fn = interpolate([start, end], space);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const color = fn(t);
    // Clamp chroma for lab to avoid out-of-gamut colors
    const clamped = space === "lab" ? clampChroma(color, "lab") : color;
    return formatHex(clamped) ?? "#000000";
  });
}

/**
 * Generate N evenly-stepped hex colors across start → middle → end.
 *
 * The middle color is placed at index round((N-1)/2) so it always lands exactly
 * on a step. The output is split into two segments: [0..midIdx] interpolated
 * start→mid, [midIdx..N-1] interpolated mid→end. When N is even the two
 * segments have unequal step counts (left gets one more), so their per-step ΔE
 * differs slightly — this is the correct tradeoff for guaranteeing the mid color
 * appears exactly rather than being approximated.
 */
export function interpolateThree(
  start: string,
  mid: string,
  end: string,
  steps: number,
  space: ColorSpace
): string[] {
  if (steps < 3) {
    return interpolateTwo(start, end, steps, space);
  }

  // Mid color sits at the exact midpoint index
  const midIdx = Math.round((steps - 1) / 2);
  const leftCount = midIdx + 1; // steps in start→mid segment (inclusive)
  const rightCount = steps - midIdx; // steps in mid→end segment (inclusive)

  const leftFn = interpolate([start, mid], space);
  const rightFn = interpolate([mid, end], space);

  const result: string[] = [];

  for (let i = 0; i < leftCount; i++) {
    const t = leftCount === 1 ? 0 : i / (leftCount - 1);
    const color = leftFn(t);
    const clamped = space === "lab" ? clampChroma(color, "lab") : color;
    result.push(formatHex(clamped) ?? "#000000");
  }

  // Skip the first of right segment (it's the same mid color, already added)
  for (let i = 1; i < rightCount; i++) {
    const t = i / (rightCount - 1);
    const color = rightFn(t);
    const clamped = space === "lab" ? clampChroma(color, "lab") : color;
    result.push(formatHex(clamped) ?? "#000000");
  }

  return result;
}

/**
 * Returns true if black text (rather than white) should be used on the given
 * background color, based on WCAG relative luminance.
 *
 * WCAG contrast ratio formula: (L1+0.05)/(L2+0.05) where L1>L2.
 * A luminance threshold of ~0.179 is equivalent to requiring ≥3:1 contrast
 * against both black and white (adequate for large text / UI labels).
 */
export function useBlackText(hex: string): boolean {
  try {
    const lum = wcagLuminance(hex);
    return lum > 0.179;
  } catch {
    return true;
  }
}

/**
 * Build a CSS linear-gradient string from an array of hex colors.
 */
export function toCssGradient(colors: string[]): string {
  return `linear-gradient(to right, ${colors.join(", ")})`;
}
