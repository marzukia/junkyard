/**
 * Shared HTML/XML escaping utilities.
 *
 * escapeHtml escapes the five characters that are significant in HTML attribute
 * values and text content: & < > " '
 * It is used in both markdown.ts (attribute interpolation in the safeRenderer)
 * and barcode.ts (SVG attribute interpolation).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
