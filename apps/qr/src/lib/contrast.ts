import { hexToRgb } from "./qr";

/**
 * Calculates relative luminance of a hex colour per WCAG 2.1.
 * Returns null if the hex is invalid.
 */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const linearise = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = linearise(rgb.r);
  const g = linearise(rgb.g);
  const b = linearise(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Returns the WCAG contrast ratio between two hex colours.
 * Returns null if either colour is invalid.
 */
export function contrastRatio(fgHex: string, bgHex: string): number | null {
  const L1 = relativeLuminance(fgHex);
  const L2 = relativeLuminance(bgHex);
  if (L1 === null || L2 === null) return null;
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Estimates a recommended foreground colour (black or white)
 * that will have the best contrast against the given background.
 */
export function suggestFgForBg(bgHex: string): string {
  const L = relativeLuminance(bgHex);
  if (L === null) return "#000000";
  // WCAG: prefer white on dark backgrounds, black on light
  const contrastWithWhite = (1 + 0.05) / (L + 0.05);
  const contrastWithBlack = (L + 0.05) / (0 + 0.05);
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#000000";
}

/**
 * Scannability thresholds. QR scanners need enough contrast to distinguish
 * dark modules from light background.
 * Based on empirical testing: ~3:1 minimum, ~4.5:1 recommended.
 */
export const CONTRAST_THRESHOLD_WARN = 3.0;
export const CONTRAST_THRESHOLD_GOOD = 4.5;

export type ContrastLevel = "good" | "warn" | "fail";

export function classifyContrast(ratio: number): ContrastLevel {
  if (ratio >= CONTRAST_THRESHOLD_GOOD) return "good";
  if (ratio >= CONTRAST_THRESHOLD_WARN) return "warn";
  return "fail";
}
