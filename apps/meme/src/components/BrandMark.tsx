/**
 * Meme tool BrandMark - image frame with two text lines (top amber, bottom coral).
 * Transparent background; matches the favicon glyph family.
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
      {/* Image frame */}
      <rect x="3" y="5" width="26" height="20" rx="3" stroke="#2f9d8d" strokeWidth="2" />
      {/* Top text line - amber */}
      <line
        x1="8"
        y1="10"
        x2="24"
        y2="10"
        stroke="#e8b04b"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Bottom text line - coral */}
      <line
        x1="8"
        y1="20"
        x2="24"
        y2="20"
        stroke="#d9594c"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Small mountain/image glyph in center */}
      <circle cx="12" cy="15" r="1.5" stroke="#2f9d8d" strokeWidth="1.5" />
      <path
        d="M10 18 L13 15 L16 17 L18 15 L22 18"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
