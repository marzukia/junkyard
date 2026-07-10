/**
 * Brand palette — single source of truth for junkyard.sh colors.
 *
 * Used by OG banner generation, CSS theme variables, and app BrandMark glyphs.
 * If you change these, update all three consumers.
 */

export const BRAND = {
  /** Primary teal accent (header brand mark, links, CTAs). */
  accent: "#2f9d8d",
  /** Amber highlight (secondary accents, tags). */
  amber: "#e8b04b",
  /** Red/coral (tertiary accents, warnings, error states). */
  coral: "#d9594c",
} as const;

export type BrandColor = keyof typeof BRAND;

/** Per-category accent colours for OG banner generation. */
export const CATEGORY_COLORS: Record<string, string> = {
  image: BRAND.accent,
  text: "#5b8def",
  ai: "#a855f7",
  docs: BRAND.amber,
} as const;
