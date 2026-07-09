/**
 * Validate a 3- or 6-digit hex color string (with or without leading #).
 * Returns the normalised "#rrggbb" form, or null if invalid.
 */
export function parseHexColor(raw: string): string | null {
  const s = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    const [r, g, b] = s.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    return `#${s.toLowerCase()}`;
  }
  return null;
}

/** True if the string is a valid 3- or 6-digit hex color (with or without #). */
export function isValidHex(hex: string): boolean {
  return parseHexColor(hex) !== null;
}
