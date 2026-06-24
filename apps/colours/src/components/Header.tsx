import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { AppSwitcher } from "./AppSwitcher";

interface HeaderProps {
  title: string;
  subtitle: string;
  brandMark: ReactNode;
  controls?: ReactNode;
  /** Extra full-width content rendered below the main header row (e.g. the vision-simulation bar). */
  visionBar?: ReactNode;
}

export function Header({ title, subtitle, brandMark, controls, visionBar }: HeaderProps) {
  return (
    <>
      <div className="utility-bar">
        <AppSwitcher />
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
        {visionBar != null && (
          <div className="site-header-vision">
            <div className="site-header-inner">{visionBar}</div>
          </div>
        )}
      </header>
    </>
  );
}
