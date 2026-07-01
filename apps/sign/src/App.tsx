import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { SignTool } from "./components/SignTool";

function SignBrandMark() {
  return (
    <BrandMark label="PDF Sign">
      {/* Document outline: teal stroke */}
      <path
        d="M5 4 L19 4 L27 12 L27 28 L5 28 Z"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Fold crease */}
      <path
        d="M19 4 L19 12 L27 12"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Amber fold fill */}
      <path d="M19 4 L19 12 L27 12 Z" fill="#e8b04b" />
      {/* Coral signature stroke */}
      <path
        d="M9 22 Q11 18 13 21 Q15 24 17 20 Q19 16 21 19"
        fill="none"
        stroke="#d9594c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Amber underline dot */}
      <circle cx="22" cy="21" r="1.25" fill="#e8b04b" />
    </BrandMark>
  );
}

export function App() {
  return (
    <div className="app-root">
      <Header
        title="PDF Sign"
        subtitle="Free e-signature. Draw or type, place, download."
        brandMark={<SignBrandMark />}
      />
      <main className="site-main">
        <div className="privacy-banner card">
          <span className="privacy-icon" aria-hidden="true">
            🔒
          </span>
          <span>
            <strong>100% private.</strong> Your PDF never leaves your browser. No upload, no
            account, no DocuSign subscription needed.
          </span>
        </div>
        <SignTool />
      </main>
      <Footer blurb="Runs entirely in your browser. Nothing is uploaded." />
    </div>
  );
}
