/**
 * Pure palette export formatters. No React imports — fully unit-testable.
 *
 * Each formatter accepts a string[] of hex values and returns a formatted string
 * ready to copy or download.
 *
 * All formatters normalize entries via normalizeHex (falling back to #000000) so
 * output is always clean #rrggbb even if a caller passes an unvalidated string.
 */

import { normalizeHex } from "./color";

export type ExportFormat = "css" | "tailwind" | "scss" | "json" | "svg";

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "css", label: "CSS" },
  { value: "tailwind", label: "Tailwind" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "svg", label: "SVG" },
];

/** Sanitize a hex entry: return a clean #rrggbb or the fallback "#000000". */
function safeHex(hex: string): string {
  return normalizeHex(hex) ?? "#000000";
}

/** :root { --color-1: #hex; ... } */
export function formatCss(colors: string[]): string {
  const lines = colors.map((hex, i) => `  --color-${i + 1}: ${safeHex(hex)};`).join("\n");
  return `:root {\n${lines}\n}`;
}

/** colors: { 'color-1': '#hex', ... } (for theme.extend.colors) */
export function formatTailwind(colors: string[]): string {
  const lines = colors.map((hex, i) => `  'color-${i + 1}': '${safeHex(hex)}',`).join("\n");
  return `colors: {\n${lines}\n}`;
}

/** $color-1: #hex; ... */
export function formatScss(colors: string[]): string {
  return colors.map((hex, i) => `$color-${i + 1}: ${safeHex(hex)};`).join("\n");
}

/** Pretty-printed JSON array */
export function formatJson(colors: string[]): string {
  return JSON.stringify(colors.map(safeHex), null, 2);
}

/**
 * SVG swatch strip — one <rect> per colour, 80px wide × 80px tall.
 * Produces a standalone valid SVG document.
 * Colours are normalized via safeHex so the fill attribute is always a clean
 * #rrggbb literal — no injection through a crafted hex string.
 */
export function formatSvg(colors: string[]): string {
  const w = 80;
  const h = 80;
  const totalWidth = w * colors.length;
  const rects = colors
    .map(
      (hex, i) => `  <rect x="${i * w}" y="0" width="${w}" height="${h}" fill="${safeHex(hex)}" />`
    )
    .join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${h}" viewBox="0 0 ${totalWidth} ${h}">`,
    rects,
    "</svg>",
  ].join("\n");
}

/** Dispatch to the correct formatter by format key. */
export function formatPalette(colors: string[], format: ExportFormat): string {
  switch (format) {
    case "css":
      return formatCss(colors);
    case "tailwind":
      return formatTailwind(colors);
    case "scss":
      return formatScss(colors);
    case "json":
      return formatJson(colors);
    case "svg":
      return formatSvg(colors);
  }
}
