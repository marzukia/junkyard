import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { ExportButton } from "./components/ExportButton";
import { ImportButton } from "./components/ImportButton";
import { LoadSampleButton } from "./components/LoadSampleButton";
import { ResumeForm } from "./components/ResumeForm";
import { ResumePreview } from "./components/ResumePreview";
import { SaveIndicator } from "./components/SaveIndicator";
import { TemplatePicker } from "./components/TemplatePicker";

function ResumeBrandMark() {
  return (
    <BrandMark label="Resume Builder">
      {/* Document outline - teal */}
      <path
        d="M6 3 L22 3 L26 7 L26 29 L6 29 Z"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Fold crease */}
      <path
        d="M22 3 L22 7 L26 7"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Person head - amber */}
      <circle cx="13" cy="11" r="2.5" stroke="#e8b04b" strokeWidth="1.8" fill="none" />
      {/* Shoulders arc - amber */}
      <path
        d="M8.5 17.5 C8.5 14.5 17.5 14.5 17.5 17.5"
        stroke="#e8b04b"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Text lines - coral accent */}
      <line
        x1="20"
        y1="11"
        x2="23.5"
        y2="11"
        stroke="#d9594c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="14"
        x2="23.5"
        y2="14"
        stroke="#d9594c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Body lines - faint teal */}
      <line
        x1="9"
        y1="21"
        x2="23"
        y2="21"
        stroke="#2f9d8d"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
      />
      <line
        x1="9"
        y1="24"
        x2="20"
        y2="24"
        stroke="#2f9d8d"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </BrandMark>
  );
}

export function App() {
  return (
    <div className="app-root">
      <Header
        title="Resume Builder"
        subtitle="Free. No signup. Runs in your browser."
        brandMark={<ResumeBrandMark />}
        controls={
          <>
            <TemplatePicker />
            <ImportButton />
            <LoadSampleButton />
            <SaveIndicator />
            <ExportButton />
          </>
        }
      />
      <main className="site-main">
        <div className="resume-layout">
          <div className="card">
            <ResumeForm />
          </div>
          <ResumePreview />
        </div>
      </main>
      <Footer blurb="All data stays in your browser. Nothing is uploaded." />
    </div>
  );
}
