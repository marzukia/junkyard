/**
 * Collage tool brand mark: a 2x2 grid of rounded photo frames with
 * a small overlapping frame in amber, stroke-based line-art style.
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
      {/* Top-left cell */}
      <rect x="2" y="2" width="13" height="13" rx="2.5" stroke="#2f9d8d" strokeWidth="1.8" />
      {/* Top-right cell */}
      <rect x="17" y="2" width="13" height="13" rx="2.5" stroke="#2f9d8d" strokeWidth="1.8" />
      {/* Bottom-left cell */}
      <rect x="2" y="17" width="13" height="13" rx="2.5" stroke="#2f9d8d" strokeWidth="1.8" />
      {/* Bottom-right cell */}
      <rect x="17" y="17" width="13" height="13" rx="2.5" stroke="#2f9d8d" strokeWidth="1.8" />
      {/* Overlapping accent frame — amber */}
      <rect x="11" y="11" width="10" height="10" rx="2" stroke="#e8b04b" strokeWidth="1.8" />
    </svg>
  );
}
