/**
 * WCAG contrast utilities.
 *
 * relativeLuminance uses the standard sRGB → linear conversion from WCAG 2.x:
 *   https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * The formula matches culori's wcagLuminance implementation; we implement it
 * independently here (rather than re-importing wcagLuminance from culori) so
 * this module has no culori dependency and stays pure/testable without the
 * broader interpolation stack.
 */

/** Convert an 8-bit sRGB channel value (0–255) to its linear-light counterpart. */
function linearise(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance of a hex colour per WCAG 2.x §1.4.3.
 * Returns a value in [0, 1] where 0 = black, 1 = white.
 * Returns 0 on any parse error.
 */
export function relativeLuminance(hex: string): number {
  const stripped = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(stripped)) return 0;
  const r = linearise(Number.parseInt(stripped.slice(0, 2), 16));
  const g = linearise(Number.parseInt(stripped.slice(2, 4), 16));
  const b = linearise(Number.parseInt(stripped.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colours.
 * Returns a value in [1, 21]; 1 = same luminance, 21 = black vs white.
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface WcagAssessment {
  /** AA pass for normal text (≥4.5) */
  aaNormal: boolean;
  /** AA pass for large text / UI components (≥3) */
  aaLarge: boolean;
  /** AAA pass for normal text (≥7) */
  aaaNormal: boolean;
  /** AAA pass for large text (≥4.5) */
  aaaLarge: boolean;
}

/** Assess a contrast ratio against all four WCAG 2.x thresholds. */
export function wcagAssessment(ratio: number): WcagAssessment {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}
