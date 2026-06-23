import { ContrastChecker } from "./components/ContrastChecker";
import { PaletteGenerator } from "./components/PaletteGenerator";
import { ShareButton } from "./components/ShareButton";
import { SpaceToggle } from "./components/SpaceToggle";
import { ThemeToggle } from "./components/ThemeToggle";
import { ThreePointGenerator } from "./components/ThreePointGenerator";
import { TwoPointGenerator } from "./components/TwoPointGenerator";
import { VisionToggle } from "./components/VisionToggle";
import { useUrlSync } from "./lib/useUrlSync";
import { AppSwitcher } from "./AppSwitcher";

// 2×2 grid with the top-right square absent, mirrors the favicon shape.
// Sized via CSS to track the cap-height of the "Colours" wordmark.
function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="13" height="13" rx="2" fill="#2f9d8d" />
      <rect x="2" y="17" width="13" height="13" rx="2" fill="#e8b04b" />
      <rect x="17" y="17" width="13" height="13" rx="2" fill="#d9594c" />
    </svg>
  );
}

export function App() {
  // Hydrates store from URL hash on mount; writes hash on state changes (debounced).
  useUrlSync();

  return (
    <div className="app-root">
      <div className="utility-bar">
        <AppSwitcher />
        <ThemeToggle />
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <h1 className="site-title">
            <span className="site-title-row">
              <BrandMark />
              <span className="site-title-main">Colours</span>
            </span>
            <span className="site-title-sub">Colour &amp; Gradient Toolkit</span>
          </h1>
          <div className="header-controls">
            <ShareButton />
            <SpaceToggle />
          </div>
        </div>
        <div className="site-header-vision">
          <div className="site-header-inner">
            <VisionToggle />
          </div>
        </div>
      </header>

      <main className="site-main">
        {/* Palette generator spans the full width */}
        <div className="palette-section-wrapper">
          <PaletteGenerator />
        </div>

        {/* Gradient generators + contrast checker below */}
        <div className="generators-grid">
          <TwoPointGenerator />
          <ThreePointGenerator />
        </div>

        {/* WCAG contrast checker, full width below the generators */}
        <ContrastChecker />
      </main>

      <footer className="site-footer">
        <span>Interpolates in LAB, RGB, or HSL via culori</span>
        <span className="site-footer-sep">·</span>
        <span>
          Made by{" "}
          <a href="https://mrzk.io" target="_blank" rel="noreferrer" className="site-footer-link">
            Andryo Marzuki
          </a>
        </span>
        <span className="site-footer-sep">·</span>
        <a
          href="https://junkyard.mrzk.io/"
          target="_blank"
          rel="noreferrer"
          className="site-footer-link"
        >
          more tools
        </a>
      </footer>
    </div>
  );
}
