import { Footer } from "@junkyardsh/ui";
import { Header } from "@junkyardsh/ui";
import { BrandMark } from "@junkyardsh/ui";
import { FaviconGenerator } from "./components/FaviconGenerator";

function FaviconBrandGlyph() {
  return (
    <>
      {/* Three squares: large/medium/small = multiple favicon sizes */}
      <rect x="2" y="2" width="17" height="17" rx="3" fill="#2f9d8d" />
      <rect x="13" y="13" width="13" height="13" rx="2.5" fill="#e8b04b" />
      {/* Coral pixel, top-right corner accent */}
      <rect x="24" y="2" width="6" height="6" rx="1.5" fill="#d9594c" />
    </>
  );
}

export function App() {
  return (
    <div className="app-root">
      <Header
        title="Favicon Generator"
        subtitle="PNG or SVG → full favicon set, in your browser"
        brandMark={
          <BrandMark>
            <FaviconBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <FaviconGenerator />
      </main>

      <Footer blurb="Runs entirely in your browser, no upload, no signup" />
    </div>
  );
}
