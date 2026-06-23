/**
 * Video Toolkit BrandMark - a film frame with a play triangle.
 * Teal frame, amber play button.
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
      {/* Film frame outline */}
      <rect x="3" y="6" width="26" height="20" rx="3" fill="#2f9d8d" />
      {/* Film sprocket holes */}
      <rect x="5" y="8" width="3" height="3" rx="1" fill="white" opacity="0.6" />
      <rect x="5" y="14" width="3" height="3" rx="1" fill="white" opacity="0.6" />
      <rect x="5" y="20" width="3" height="3" rx="1" fill="white" opacity="0.6" />
      <rect x="24" y="8" width="3" height="3" rx="1" fill="white" opacity="0.6" />
      <rect x="24" y="14" width="3" height="3" rx="1" fill="white" opacity="0.6" />
      <rect x="24" y="20" width="3" height="3" rx="1" fill="white" opacity="0.6" />
      {/* Play triangle */}
      <polygon points="13,11 13,21 22,16" fill="#e8b04b" />
    </svg>
  );
}
