import type { ReactNode } from "react";

interface BrandMarkProps {
  children: ReactNode;
  label?: string;
}

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
