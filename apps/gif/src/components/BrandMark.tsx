/** GIF Maker brand mark: film strip with play triangle. Teal frame, amber sprockets, coral play. */
export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Main film frame */}
      <rect x="4" y="8" width="24" height="16" rx="2" stroke="#2f9d8d" strokeWidth="2" />
      {/* Top sprocket holes */}
      <rect x="7" y="4" width="3" height="4" rx="1" fill="#e8b04b" />
      <rect x="14.5" y="4" width="3" height="4" rx="1" fill="#e8b04b" />
      <rect x="22" y="4" width="3" height="4" rx="1" fill="#e8b04b" />
      {/* Bottom sprocket holes */}
      <rect x="7" y="24" width="3" height="4" rx="1" fill="#e8b04b" />
      <rect x="14.5" y="24" width="3" height="4" rx="1" fill="#e8b04b" />
      <rect x="22" y="24" width="3" height="4" rx="1" fill="#e8b04b" />
      {/* Play triangle */}
      <path d="M13 12 L13 20 L21 16 Z" fill="#d9594c" />
    </svg>
  );
}
