import { ContrastChecker } from "./components/ContrastChecker";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { BrandMark } from "./components/BrandMark";
import { PaletteGenerator } from "./components/PaletteGenerator";
import { ShareButton } from "./components/ShareButton";
import { SpaceToggle } from "./components/SpaceToggle";
import { ThreePointGenerator } from "./components/ThreePointGenerator";
import { TwoPointGenerator } from "./components/TwoPointGenerator";
import { VisionToggle } from "./components/VisionToggle";
import { useUrlSync } from "./lib/useUrlSync";

// 2×2 grid with the top-right square absent, mirrors the favicon shape.
// Sized via CSS to track the cap-height of the "Colours" wordmark.
function ColoursBrandGlyph() {
  return (
    <>
      <rect x="2" y="2" width="13" height="13" rx="2" fill="#2f9d8d" />
      <rect x="2" y="17" width="13" height="13" rx="2" fill="#e8b04b" />
      <rect x="17" y="17" width="13" height="13" rx="2" fill="#d9594c" />
    </>
  );
}

export function App() {
  // Hydrates store from URL hash on mount; writes hash on state changes (debounced).
  useUrlSync();

  return (
    <div className="app-root">
      <Header
        title="Colours"
        subtitle="Colour &amp; Gradient Toolkit"
        brandMark={
          <BrandMark>
            <ColoursBrandGlyph />
          </BrandMark>
        }
        controls={
          <>
            <ShareButton />
            <SpaceToggle />
          </>
        }
        visionBar={<VisionToggle />}
      />

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

      <Footer blurb="Interpolates in LAB, RGB, or HSL via culori" />
    </div>
  );
}
