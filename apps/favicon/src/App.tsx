import { FaviconGenerator } from "./components/FaviconGenerator";
import { ThemeToggle } from "./components/ThemeToggle";
import { AppSwitcher } from "./AppSwitcher";

function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Three squares: large/medium/small = multiple favicon sizes */}
      <rect x="2" y="2" width="17" height="17" rx="3" fill="#2f9d8d" />
      <rect x="13" y="13" width="13" height="13" rx="2.5" fill="#e8b04b" />
      {/* Coral pixel, top-right corner accent */}
      <rect x="24" y="2" width="6" height="6" rx="1.5" fill="#d9594c" />
    </svg>
  );
}

export function App() {
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
              <span className="site-title-main">Favicon Generator</span>
            </span>
            <span className="site-title-sub">PNG or SVG → full favicon set, in your browser</span>
          </h1>
        </div>
      </header>

      <main className="site-main">
        <FaviconGenerator />
      </main>

      <footer className="site-footer">
        <span>Runs entirely in your browser, no upload, no signup</span>
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
