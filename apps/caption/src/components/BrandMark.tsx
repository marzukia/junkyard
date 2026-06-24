import type { ReactNode } from "react";

interface BrandMarkProps {
  /**
   * The SVG glyph to render inside the brand-mark frame.
   * Must be valid SVG children (paths, rects, circles, etc.) that fit a 32×32 viewBox.
   * The component wraps it in an <svg> with the correct className and aria attributes.
   */
  children: ReactNode;
  /** Optional accessible label. Defaults to hidden (decorative). */
  label?: string;
}

/**
 * Brand mark wrapper — renders the tool's unique SVG glyph at the correct
 * size tracked to the header title cap-height (via .brand-mark CSS class).
 *
 * Usage:
 *   <BrandMark>
 *     <rect x="2" y="2" width="28" height="28" rx="4" fill="#2f9d8d" />
 *   </BrandMark>
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
