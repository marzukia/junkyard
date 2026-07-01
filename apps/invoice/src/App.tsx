import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { ExportButton } from "./components/ExportButton";
import { InvoiceForm } from "./components/InvoiceForm";
import { InvoicePreview } from "./components/InvoicePreview";

// Invoice glyph: document with a dollar sign, brand palette, line-art only
function InvoiceBrandMark() {
  return (
    <BrandMark label="Invoice Generator">
      {/* Document outline - teal stroke */}
      <path
        d="M5 2 L20 2 L27 9 L27 30 L5 30 Z"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Fold crease */}
      <path
        d="M20 2 L20 9 L27 9"
        fill="none"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Amber fold triangle */}
      <path d="M20 2 L20 9 L27 9 Z" fill="#e8b04b" />
      {/* Dollar sign - coral */}
      <text
        x="16"
        y="24"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#d9594c"
        fontFamily="sans-serif"
      >
        $
      </text>
      {/* Teal line hints */}
      <rect x="8" y="14" width="8" height="1.5" rx="0.75" fill="#2f9d8d" opacity="0.45" />
      <rect x="8" y="17" width="5" height="1.5" rx="0.75" fill="#2f9d8d" opacity="0.3" />
    </BrandMark>
  );
}

export function App() {
  return (
    <div className="app-root">
      <Header
        title="Invoice Generator"
        subtitle="Free. No signup. Runs in your browser."
        brandMark={<InvoiceBrandMark />}
        controls={<ExportButton />}
      />
      <main className="site-main">
        <div className="invoice-layout">
          <div className="card">
            <InvoiceForm />
          </div>
          <InvoicePreview />
        </div>
      </main>
      <Footer blurb="All data stays in your browser. Nothing is uploaded." />
    </div>
  );
}
