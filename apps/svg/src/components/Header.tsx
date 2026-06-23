import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { AppSwitcher } from "./AppSwitcher";

interface HeaderProps {
  title: string;
  subtitle: string;
  brandMark: ReactNode;
  controls?: ReactNode;
}

export function Header({ title, subtitle, brandMark, controls }: HeaderProps) {
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
      </header>
    </>
  );
}
