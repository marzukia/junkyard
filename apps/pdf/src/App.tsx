import { BrandMark } from "./components/BrandMark";
import { CompressTool } from "./components/CompressTool";
import { ExtractTool } from "./components/ExtractTool";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Img2PdfTool } from "./components/Img2PdfTool";
import { MergeTool } from "./components/MergeTool";
import { PageNumbersTool } from "./components/PageNumbersTool";
import { Pdf2ImgTool } from "./components/Pdf2ImgTool";
import { ReorderTool } from "./components/ReorderTool";
import { RotateTool } from "./components/RotateTool";
import { SplitTool } from "./components/SplitTool";
import { WatermarkTool } from "./components/WatermarkTool";
import { type Tool, usePdfStore } from "./store/usePdfStore";

// PDF document glyph, folded-corner document in brand palette.
// Transparent background: only the brand-colour shapes exist (no solid backing).
// Same flat geometric family as colours' 3-square favicon.
function PdfBrandMark() {
  return (
    <BrandMark label="PDF Toolkit">
      {/* Document outline, teal stroke, transparent fill */}
      <path
        d="M6 3 L19 3 L26 10 L26 29 L6 29 Z"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Folded corner crease */}
      <path
        d="M19 3 L19 10 L26 10"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Amber fold triangle */}
      <path d="M19 3 L19 10 L26 10 Z" fill="#e8b04b" />
      {/* Coral accent bar */}
      <rect x="10" y="21" width="12" height="2.5" rx="1.25" fill="#d9594c" />
      {/* Teal text line */}
      <rect x="10" y="14" width="12" height="2" rx="1" fill="#2f9d8d" opacity="0.5" />
      {/* Teal short line */}
      <rect x="10" y="17.5" width="7" height="2" rx="1" fill="#2f9d8d" opacity="0.35" />
    </BrandMark>
  );
}

const TOOLS: { id: Tool; label: string; desc: string }[] = [
  { id: "merge", label: "Merge", desc: "Combine multiple PDFs into one" },
  { id: "split", label: "Split", desc: "Split a PDF into individual pages" },
  { id: "extract", label: "Extract", desc: "Extract specific pages from a PDF" },
  { id: "reorder", label: "Reorder", desc: "Drag-and-drop page reordering" },
  { id: "rotate", label: "Rotate", desc: "Rotate all pages by 90, 180, or 270 degrees" },
  { id: "compress", label: "Compress", desc: "Reduce PDF file size" },
  { id: "pagenumbers", label: "Page Numbers", desc: "Add page numbers to every page" },
  { id: "watermark", label: "Watermark", desc: "Add a diagonal text watermark to every page" },
  { id: "img2pdf", label: "Images to PDF", desc: "Convert PNG/JPEG images to a PDF" },
  { id: "pdf2img", label: "PDF to Images", desc: "Export each PDF page as a PNG" },
];

function ToolNav() {
  const { activeTool, setActiveTool } = usePdfStore();
  return (
    <nav className="tool-nav" aria-label="PDF tools">
      <div className="space-toggle tool-nav-toggle">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`space-btn${activeTool === t.id ? " space-btn--active" : ""}`}
            onClick={() => setActiveTool(t.id)}
            aria-pressed={activeTool === t.id}
            title={t.desc}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function ActiveTool() {
  const { activeTool } = usePdfStore();
  const tool = TOOLS.find((t) => t.id === activeTool);
  return (
    <section className="card active-tool-card" aria-labelledby="active-tool-heading">
      <div className="active-tool-header">
        <h2 id="active-tool-heading" className="active-tool-title">
          {tool?.label}
        </h2>
        <p className="active-tool-desc">{tool?.desc}</p>
      </div>
      {activeTool === "merge" && <MergeTool />}
      {activeTool === "split" && <SplitTool />}
      {activeTool === "extract" && <ExtractTool />}
      {activeTool === "reorder" && <ReorderTool />}
      {activeTool === "rotate" && <RotateTool />}
      {activeTool === "compress" && <CompressTool />}
      {activeTool === "pagenumbers" && <PageNumbersTool />}
      {activeTool === "watermark" && <WatermarkTool />}
      {activeTool === "img2pdf" && <Img2PdfTool />}
      {activeTool === "pdf2img" && <Pdf2ImgTool />}
    </section>
  );
}

export function App() {
  return (
    <div className="app-root">
      <Header
        title="PDF Toolkit"
        subtitle="Merge · Split · Compress · Convert"
        brandMark={<PdfBrandMark />}
      />
      <main className="site-main">
        <div className="privacy-banner card">
          <span className="privacy-icon" aria-hidden="true">
            🔒
          </span>
          <span>
            <strong>100% private.</strong> All processing happens in your browser, no files are
            uploaded to any server.
          </span>
        </div>
        <ToolNav />
        <ActiveTool />
      </main>
      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
