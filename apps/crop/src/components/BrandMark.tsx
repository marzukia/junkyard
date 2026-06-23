export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Crop frame corners: teal outer L-shapes */}
      <path
        d="M4 12 L4 4 L12 4"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 4 L28 4 L28 12"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20 L4 28 L12 28"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 28 L28 28 L28 20"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner amber rect - the crop selection */}
      <rect x="10" y="10" width="12" height="12" rx="1.5" stroke="#e8b04b" strokeWidth="2" />
    </svg>
  );
}
