import { useEffect, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Controls } from "./components/Controls";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { MetaSnippet } from "./components/MetaSnippet";
import { OgCanvas, exportToPng } from "./components/OgCanvas";
import { useOgStore } from "./store";

type CopyState = "idle" | "copying" | "copied" | "error";
type DownloadState = "idle" | "downloading" | "error";

export function App() {
  const config = useOgStore((s) => s.config);
  const canvasWidth = useOgStore((s) => s.canvasWidth);
  const canvasHeight = useOgStore((s) => s.canvasHeight);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [showMeta, setShowMeta] = useState(false);

  const downloading = downloadState === "downloading";

  async function handleDownload() {
    if (downloadState !== "idle") return;
    setDownloadState("downloading");
    try {
      const blob = await exportToPng(config, canvasWidth, canvasHeight);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "og-image.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      // Reveal the meta snippet on first successful export
      setShowMeta(true);
      setDownloadState("idle");
    } catch (err) {
      console.error("Export failed", err);
      setDownloadState("error");
      setTimeout(() => setDownloadState("idle"), 2500);
    }
  }

  async function handleCopyImage() {
    if (copyState !== "idle") return;
    setCopyState("copying");
    try {
      const blob = await exportToPng(config, canvasWidth, canvasHeight);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      console.error("Copy failed", err);
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  // Cmd/Ctrl+Enter triggers the primary action (Download PNG)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!downloading) handleDownload();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const copyLabel =
    copyState === "copying"
      ? "Copying..."
      : copyState === "copied"
        ? "Copied!"
        : copyState === "error"
          ? "Copy failed"
          : "Copy image";

  const presetLabel = `${canvasWidth} x ${canvasHeight} px`;

  return (
    <div className="app-root">
      <Header title="OG" subtitle="Make social share images in seconds" brandMark={<BrandMark />} />

      <main className="site-main">
        <div className="og-layout">
          {/* Controls panel */}
          <div className="card og-controls-card">
            <Controls />
          </div>

          {/* Preview panel */}
          <div className="og-preview-panel">
            <div className="og-preview-label">Live preview &mdash; {presetLabel}</div>
            <div className="og-preview-frame">
              <OgCanvas config={config} width={canvasWidth} height={canvasHeight} />
            </div>
            <div className="og-preview-actions">
              <span className="og-preview-size">
                Output: {presetLabel} &middot; PNG &middot; browser-rendered
              </span>
              <div className="og-action-btns">
                <button
                  type="button"
                  className={`btn-secondary og-copy-btn${copyState === "copied" ? " og-copy-btn--ok" : ""}${copyState === "error" ? " og-copy-btn--err" : ""}`}
                  onClick={handleCopyImage}
                  disabled={copyState !== "idle"}
                  aria-live="polite"
                  aria-label={copyLabel}
                >
                  {copyLabel}
                </button>
                <button
                  type="button"
                  className={`btn-primary${downloadState === "error" ? " og-copy-btn--err" : ""}`}
                  onClick={handleDownload}
                  disabled={downloading}
                  aria-busy={downloading}
                  aria-live="polite"
                  title="Download PNG (Ctrl+Enter / Cmd+Enter)"
                >
                  {downloadState === "downloading"
                    ? "Generating..."
                    : downloadState === "error"
                      ? "Download failed"
                      : "Download PNG"}
                </button>
              </div>
            </div>

            {/* Meta snippet panel: revealed after first export */}
            {showMeta && (
              <MetaSnippet
                title={config.title}
                description={config.subtitle}
                width={canvasWidth}
                height={canvasHeight}
              />
            )}
            {!showMeta && (
              <button
                type="button"
                className="og-meta-reveal-btn"
                onClick={() => setShowMeta(true)}
              >
                Show meta tags
              </button>
            )}
          </div>
        </div>
      </main>

      <Footer blurb="Runs entirely in your browser. No upload, no signup." />
    </div>
  );
}
