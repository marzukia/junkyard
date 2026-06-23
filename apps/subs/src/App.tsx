import { CueList } from "./components/CueList";
import { DropZone } from "./components/DropZone";
import { ThemeToggle } from "./components/ThemeToggle";
import { Toolbar } from "./components/Toolbar";
import { useSubsStore } from "./store/useSubsStore";
import { AppSwitcher } from "./AppSwitcher";

/** Minimalist film-strip glyph, 3 stacked bars in brand palette, distinct from the 3-square colours mark */
function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Subtitle bars, teal / amber */}
      <rect x="6" y="11" width="20" height="4" rx="2" fill="#2f9d8d" />
      <rect x="8" y="18" width="16" height="4" rx="2" fill="#e8b04b" />
      {/* Corner accent dots, coral */}
      <rect x="4" y="4" width="4" height="4" rx="1" fill="#d9594c" />
      <rect x="24" y="4" width="4" height="4" rx="1" fill="#d9594c" />
      <rect x="4" y="24" width="4" height="4" rx="1" fill="#d9594c" />
      <rect x="24" y="24" width="4" height="4" rx="1" fill="#d9594c" />
    </svg>
  );
}

export function App() {
  const cues = useSubsStore((s) => s.cues);
  const loaded = cues.length > 0;

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
              <span className="site-title-main">Subs</span>
            </span>
            <span className="site-title-sub">Edit, shift &amp; convert .srt / .vtt subtitles</span>
          </h1>
        </div>
      </header>

      <main className="site-main">
        {!loaded && <DropZone />}
        {loaded && (
          <>
            <Toolbar />
            <CueList />
          </>
        )}
      </main>

      <footer className="site-footer">
        <span>Runs entirely in your browser, no data leaves your device</span>
        <span className="site-footer-sep">·</span>
        <span>
          Made by{" "}
          <a href="https://mrzk.io" target="_blank" rel="noreferrer" className="site-footer-link">
            Andryo Marzuki
          </a>
        </span>
        <span className="site-footer-sep">·</span>
        <a
          href="https://junkyard.sh/"
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
