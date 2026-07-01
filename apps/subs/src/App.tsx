import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { BrandMark } from "@junkyardsh/kit";
import { CueList } from "./components/CueList";
import { DropZone } from "./components/DropZone";
import { Toolbar } from "./components/Toolbar";
import { useSubsStore } from "./store/useSubsStore";

/** Minimalist film-strip glyph, 3 stacked bars in brand palette, distinct from the 3-square colours mark */
function SubsBrandGlyph() {
  return (
    <>
      {/* Subtitle bars, teal / amber */}
      <rect x="6" y="11" width="20" height="4" rx="2" fill="#2f9d8d" />
      <rect x="8" y="18" width="16" height="4" rx="2" fill="#e8b04b" />
      {/* Corner accent dots, coral */}
      <rect x="4" y="4" width="4" height="4" rx="1" fill="#d9594c" />
      <rect x="24" y="4" width="4" height="4" rx="1" fill="#d9594c" />
      <rect x="4" y="24" width="4" height="4" rx="1" fill="#d9594c" />
      <rect x="24" y="24" width="4" height="4" rx="1" fill="#d9594c" />
    </>
  );
}

export function App() {
  const cues = useSubsStore((s) => s.cues);
  const loaded = cues.length > 0;

  return (
    <div className="app-root">
      <Header
        title="Subs"
        subtitle="Edit, shift &amp; convert .srt / .vtt subtitles"
        brandMark={
          <BrandMark>
            <SubsBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {!loaded && <DropZone />}
        {loaded && (
          <>
            <Toolbar />
            <CueList />
          </>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser, no data leaves your device" />
    </div>
  );
}
