/**
 * OG tool brand mark: a rounded rectangle (the OG image frame) with a
 * share-arrow at top-right corner. Distinct from colours' 3-square mark
 * but clearly the same teal/amber/coral family. No backing panel — flat
 * transparent-background glyph made only of brand-colour shapes.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "brand-mark"}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* OG frame body — teal */}
      <rect x="3" y="8" width="21" height="15" rx="3" fill="#2f9d8d" />
      {/* Amber header strip */}
      <rect x="3" y="8" width="21" height="5" rx="3" fill="#e8b04b" />
      {/* Coral accent block at bottom-left */}
      <rect x="3" y="18" width="7" height="5" rx="2" fill="#d9594c" />
      {/* Share arrow — amber, top-right, no opaque backing */}
      <path
        d="M22 10 L26 6 M26 6 L22.5 6 M26 6 L26 9.5"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
