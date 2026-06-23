import type { ReactNode } from "react";

interface BrandMarkProps {
  /**
   * The SVG glyph to render inside the brand-mark frame.
   * Must be valid SVG children (paths, rects, circles, etc.) that fit a 32x32 viewBox.
   */
  children: ReactNode;
  /** Optional accessible label. Defaults to hidden (decorative). */
  label?: string;
}

/**
 * Brand mark wrapper, renders the tool's unique SVG glyph at the correct
 * size tracked to the header title cap-height (via .brand-mark CSS class).
 */
export function BrandMark({ children, label }: BrandMarkProps) {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {children}
    </svg>
  );
}
