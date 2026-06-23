/**
 * Screenshot tool BrandMark - a screenshot frame with a sparkle accent.
 * Line-art, teal + amber, matches the favicon glyph.
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
      {/* Outer frame (teal) */}
      <rect x="2" y="6" width="28" height="20" rx="3" stroke="#2f9d8d" strokeWidth="2" />
      {/* Inner screenshot inset */}
      <rect x="7" y="10" width="18" height="13" rx="2" stroke="#2f9d8d" strokeWidth="1.5" />
      {/* Sparkle (amber) top-right */}
      <path
        d="M26 4 L27 2 L28 4 L30 5 L28 6 L27 8 L26 6 L24 5 Z"
        stroke="#e8b04b"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Coral dot bottom-left */}
      <circle cx="5" cy="27" r="1.5" stroke="#d9594c" strokeWidth="1.2" />
    </svg>
  );
}
