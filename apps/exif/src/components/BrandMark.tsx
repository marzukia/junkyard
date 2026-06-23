/**
 * EXIF tool brand mark — a camera body outline with a lens circle and
 * two coral metadata "tag" lines in the top-right corner.
 * Same geometric family as colours' 3-square mark; same palette.
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
      {/* Camera body — outline only, no fill backing panel */}
      <rect x="2" y="7" width="28" height="19" rx="3" stroke="#2f9d8d" strokeWidth="2" />
      {/* Viewfinder bump — teal fill */}
      <rect x="11" y="4" width="10" height="4" rx="1.5" fill="#2f9d8d" />
      {/* Lens ring — amber */}
      <circle cx="16" cy="16" r="6" fill="#e8b04b" />
      {/* Inner lens aperture — teal tint */}
      <circle cx="16" cy="16" r="3" fill="#2f9d8d" opacity="0.25" />
      {/* Metadata tag lines — coral */}
      <rect x="23" y="10" width="4" height="2" rx="1" fill="#d9594c" />
      <rect x="23" y="14" width="2.5" height="2" rx="1" fill="#d9594c" opacity="0.65" />
    </svg>
  );
}
