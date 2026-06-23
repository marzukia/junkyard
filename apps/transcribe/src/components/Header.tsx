import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  /** The tool's display name */
  title: string;
  /** One-line descriptor shown below the title in mono */
  subtitle: string;
  /** The BrandMark component (tool passes its own glyph wrapped in <BrandMark>) */
  brandMark: ReactNode;
  /** Optional extra controls rendered right of center in the header */
  controls?: ReactNode;
}

export function Header({ title, subtitle, brandMark, controls }: HeaderProps) {
  return (
    <>
      <div className="utility-bar">
        <ThemeToggle />
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <h1 className="site-title">
            <span className="site-title-row">
              {brandMark}
              <span className="site-title-main">{title}</span>
            </span>
            <span className="site-title-sub">{subtitle}</span>
          </h1>
          {controls != null && <div className="header-controls">{controls}</div>}
        </div>
      </header>
    </>
  );
}
