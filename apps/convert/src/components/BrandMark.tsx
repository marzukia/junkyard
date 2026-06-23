/**
 * Convert tool BrandMark — two offset rounded squares (amber + teal)
 * with a conversion arrow. Transparent background; same family as colours' 3-square mark.
 */
export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* back square (amber), offset top-right */}
      <rect x="13" y="4" width="15" height="15" rx="3" fill="#e8b04b" />
      {/* front square (teal), offset bottom-left */}
      <rect x="4" y="13" width="15" height="15" rx="3" fill="#2f9d8d" />
      {/* conversion arrow (white) */}
      <path
        d="M21 11 L11 21 M11 21 L11 17 M11 21 L15 21"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
