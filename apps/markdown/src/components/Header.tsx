import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  /** The tool's display name, e.g. "Typecheck" */
  title: string;
  /** One-line descriptor shown below the title in mono. E.g. "Font pairing explorer" */
  subtitle: string;
  /** The BrandMark component (tool passes its own glyph wrapped in <BrandMark>). */
  brandMark: ReactNode;
  /**
   * Optional extra controls rendered right of center in the header (e.g. tool-specific
   * toggle pills, share buttons). ThemeToggle lives in the utility bar above, not here.
   */
  controls?: ReactNode;
}

/**
 * Shared site header: utility bar (ThemeToggle) + title block + optional controls.
 *
 * Render it as the first child of .app-root:
 *   <div className="app-root">
 *     <Header title="..." subtitle="..." brandMark={<BrandMark>...</BrandMark>} />
 *     <main className="site-main">...</main>
 *     <Footer ... />
 *   </div>
 */
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
