import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TextAnnotation,
  embedSignatureInPdf,
  embedSignatureOnPages,
  imageFileToDataUrl,
  textToPngDataUrl,
} from "../lib/signPdf";
import { SCRIPT_FONTS, todayISO, useSignStore } from "../store/useSignStore";
import { DrawCanvas } from "./DrawCanvas";
import { DropZone } from "./DropZone";
import { PdfViewer, type SigOverlayState } from "./PdfViewer";

const INK_COLORS = [
  { color: "#1a2530", label: "Dark ink" },
  { color: "#1a3a8f", label: "Blue ink" },
  { color: "#1a6b3a", label: "Green ink" },
  { color: "#8b0000", label: "Red ink" },
];

const DEFAULT_SIG_W = 180;
const DEFAULT_SIG_H = 70;

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SignTool() {
  const {
    pdfBytes,
    pdfFileName,
    pageCount,
    currentPage,
    sigDataUrl,
    sigMode,
    typedText,
    typedFont,
    inkColor,
    applyToAllPages,
    dateStampEnabled,
    dateStampText,
    savedSigDataUrl,
    savedSigMode,
    setPdfBytes,
    setCurrentPage,
    setSigDataUrl,
    setSigMode,
    setTypedText,
    setTypedFont,
    setInkColor,
    setApplyToAllPages,
    setDateStampEnabled,
    setDateStampText,
    saveSignature,
    clearSavedSignature,
    reset,
  } = useSignStore();

  const [overlay, setOverlay] = useState<SigOverlayState>({
    x: 60,
    y: 60,
    w: DEFAULT_SIG_W,
    h: DEFAULT_SIG_H,
  });

  // Undo stack: keep last 10 overlay positions
  const [overlayHistory, setOverlayHistory] = useState<SigOverlayState[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSigFlash, setSaveSigFlash] = useState(false);
  const [usedSavedFlash, setUsedSavedFlash] = useState(false);

  // Date stamp position (separate draggable overlay, placed below sig by default)
  const [dateOverlay, setDateOverlay] = useState<SigOverlayState>({
    x: 60,
    y: 140,
    w: 160,
    h: 24,
  });

  const pdfViewerContainerRef = useRef<HTMLDivElement>(null);

  // Wrap setOverlay to track undo history
  const updateOverlay = useCallback(
    (next: SigOverlayState | ((prev: SigOverlayState) => SigOverlayState)) => {
      setOverlay((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        setOverlayHistory((h) => [...h.slice(-9), prev]);
        return resolved;
      });
    },
    []
  );

  const undoOverlay = useCallback(() => {
    setOverlayHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      if (prev) setOverlay(prev);
      return h.slice(0, -1);
    });
  }, []);

  const handlePdfFile = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const bytes = await file.arrayBuffer();

      let count = 1;
      try {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(bytes);
        count = doc.getPageCount();
      } catch {
        // fallback to 1
      }

      setPdfBytes(bytes, file.name, count);
      // Reset overlay to default when a new PDF is loaded
      setOverlay({ x: 60, y: 60, w: DEFAULT_SIG_W, h: DEFAULT_SIG_H });
      setDateOverlay({ x: 60, y: 140, w: 160, h: 24 });
      setOverlayHistory([]);
    },
    [setPdfBytes]
  );

  const handleSample = async () => {
    setLoadingSample(true);
    try {
      const { generateSamplePdf } = await import("../lib/samplePdf");
      const bytes = await generateSamplePdf();
      setPdfBytes(bytes, "sample-agreement.pdf", 1);
      setOverlay({ x: 60, y: 60, w: DEFAULT_SIG_W, h: DEFAULT_SIG_H });
      setDateOverlay({ x: 60, y: 140, w: 160, h: 24 });
      setOverlayHistory([]);
    } finally {
      setLoadingSample(false);
    }
  };

  // Sync typed text to sigDataUrl
  useEffect(() => {
    if (sigMode !== "type") return;
    const url = textToPngDataUrl(typedText, inkColor, 72, typedFont);
    setSigDataUrl(url);
  }, [typedText, inkColor, typedFont, sigMode, setSigDataUrl]);

  const handleUploadSigFile = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploadError(null);
      try {
        const dataUrl = await imageFileToDataUrl(file);
        setSigDataUrl(dataUrl);
      } catch (err) {
        setUploadError(String(err));
      }
    },
    [setSigDataUrl]
  );

  const handleUseSaved = () => {
    if (!savedSigDataUrl) return;
    setSigDataUrl(savedSigDataUrl);
    if (savedSigMode && savedSigMode !== sigMode) {
      setSigMode(savedSigMode);
      // Re-set after mode change cleared it
      setTimeout(() => setSigDataUrl(savedSigDataUrl), 0);
    }
    setUsedSavedFlash(true);
    setTimeout(() => setUsedSavedFlash(false), 1800);
  };

  const handleSaveSignature = () => {
    saveSignature();
    setSaveSigFlash(true);
    setTimeout(() => setSaveSigFlash(false), 1800);
  };

  const handleDownload = useCallback(async () => {
    if (!pdfBytes || !sigDataUrl) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const canvas = pdfViewerContainerRef.current?.querySelector("canvas");
      const cw = canvas?.width ?? 700;
      const ch = canvas?.height ?? 900;

      const placement = {
        dataUrl: sigDataUrl,
        pageIndex: currentPage,
        xFrac: overlay.x / cw,
        yFrac: overlay.y / ch,
        wFrac: overlay.w / cw,
        hFrac: overlay.h / ch,
        canvasWidth: cw,
        canvasHeight: ch,
      };

      const annotations: TextAnnotation[] = [];
      if (dateStampEnabled && dateStampText.trim()) {
        annotations.push({
          text: dateStampText.trim(),
          xFrac: dateOverlay.x / cw,
          yFrac: dateOverlay.y / ch,
          canvasWidth: cw,
          canvasHeight: ch,
          fontSize: 11,
          color: inkColor,
        });
      }

      let result: Uint8Array;
      if (applyToAllPages && pageCount > 1) {
        const allPageIndices = Array.from({ length: pageCount }, (_, i) => i);
        result = await embedSignatureOnPages(pdfBytes, placement, allPageIndices, annotations);
      } else {
        result = await embedSignatureInPdf(pdfBytes, placement, annotations);
      }

      // pdf-lib's Uint8Array may carry ArrayBufferLike; copy to a fresh plain ArrayBuffer
      const plainBuf: ArrayBuffer = result.buffer.slice(
        result.byteOffset,
        result.byteOffset + result.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([plainBuf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stem = pdfFileName.replace(/\.pdf$/i, "");
      a.download = `${stem}-signed.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setDownloadError(String(err));
    } finally {
      setDownloading(false);
    }
  }, [
    pdfBytes,
    sigDataUrl,
    currentPage,
    overlay,
    dateStampEnabled,
    dateStampText,
    dateOverlay,
    inkColor,
    applyToAllPages,
    pageCount,
    pdfFileName,
  ]);

  // Keyboard shortcut: Ctrl+Z / Cmd+Z to undo placement
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && overlayHistory.length > 0) {
        e.preventDefault();
        undoOverlay();
      }
      // Cmd/Ctrl+Enter: download if ready
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && pdfBytes && sigDataUrl && !downloading) {
        e.preventDefault();
        handleDownload();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlayHistory, undoOverlay, pdfBytes, sigDataUrl, downloading, handleDownload]);

  const hasSig = sigDataUrl !== null;
  const hasPdf = pdfBytes !== null;
  const step2Active = hasPdf;
  const step3Active = hasPdf && hasSig;

  return (
    <div className="sign-steps">
      {/* Step 1: Upload PDF */}
      <section className="card sign-step" aria-labelledby="step1-heading">
        <div className="sign-step-header">
          <span className="sign-step-number">1</span>
          <h2 id="step1-heading" className="sign-step-title">
            Upload your PDF
          </h2>
        </div>

        {!hasPdf ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <DropZone
              accept=".pdf,application/pdf"
              onFiles={handlePdfFile}
              label="Drop a PDF here, or click to browse"
              sublabel="PDF only. Nothing is uploaded - your file stays in your browser."
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="mono-label" style={{ opacity: 0.6 }}>
                or
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSample}
                disabled={loadingSample}
                aria-label="Load a sample PDF to try the signing flow"
              >
                {loadingSample ? "Loading..." : "Try with a sample PDF"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="file-single" style={{ flex: 1, minWidth: 0 }}>
              <PdfIcon />
              <span className="file-single-name">{pdfFileName}</span>
              <span className="file-single-size">{fmt(pdfBytes.byteLength)}</span>
              <span className="file-single-size mono-label">
                {pageCount} page{pageCount !== 1 ? "s" : ""}
              </span>
            </div>
            <button type="button" className="btn-secondary" onClick={reset}>
              Change file
            </button>
          </div>
        )}
      </section>

      {/* Step 2: Create signature */}
      <section className="card sign-step" aria-labelledby="step2-heading">
        <div className="sign-step-header">
          <span className={`sign-step-number${step2Active ? "" : " sign-step-number--inactive"}`}>
            2
          </span>
          <h2
            id="step2-heading"
            className={`sign-step-title${step2Active ? "" : " sign-step-title--inactive"}`}
          >
            Create your signature
          </h2>
        </div>

        {step2Active ? (
          <>
            {/* Saved signature shortcut */}
            {savedSigDataUrl && (
              <div className="saved-sig-row">
                <div className="saved-sig-preview-wrap">
                  <img
                    src={savedSigDataUrl}
                    alt="Saved signature"
                    className="saved-sig-preview-img"
                  />
                </div>
                <div
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}
                >
                  <button type="button" className="btn-secondary" onClick={handleUseSaved}>
                    {usedSavedFlash ? "Applied!" : "Use saved signature"}
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={clearSavedSignature}
                    aria-label="Delete saved signature"
                    title="Delete saved signature"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            )}

            {/* Mode tabs */}
            <div className="sig-tabs" role="tablist" aria-label="Signature input method">
              <button
                role="tab"
                aria-selected={sigMode === "draw"}
                type="button"
                className={`sig-tab${sigMode === "draw" ? " sig-tab--active" : ""}`}
                onClick={() => setSigMode("draw")}
              >
                Draw
              </button>
              <button
                role="tab"
                aria-selected={sigMode === "type"}
                type="button"
                className={`sig-tab${sigMode === "type" ? " sig-tab--active" : ""}`}
                onClick={() => setSigMode("type")}
              >
                Type
              </button>
              <button
                role="tab"
                aria-selected={sigMode === "upload"}
                type="button"
                className={`sig-tab${sigMode === "upload" ? " sig-tab--active" : ""}`}
                onClick={() => setSigMode("upload")}
              >
                Upload image
              </button>
            </div>

            {/* Ink colour (draw + type only) */}
            {sigMode !== "upload" && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}
              >
                <span className="mono-label">Ink colour</span>
                <div className="ink-swatches" role="group" aria-label="Ink colour">
                  {INK_COLORS.map(({ color, label }) => (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={inkColor === color}
                      aria-label={label}
                      className={`ink-swatch${inkColor === color ? " ink-swatch--active" : ""}`}
                      style={{ background: color }}
                      onClick={() => setInkColor(color)}
                    />
                  ))}
                </div>
              </div>
            )}

            {sigMode === "draw" && <DrawCanvas inkColor={inkColor} onSignature={setSigDataUrl} />}

            {sigMode === "type" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Font selector */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="mono-label">Font style</span>
                  <div className="font-picker" aria-label="Signature font style">
                    {SCRIPT_FONTS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        aria-pressed={typedFont === f.value}
                        className={`font-pick-btn${typedFont === f.value ? " font-pick-btn--active" : ""}`}
                        style={{ fontFamily: f.family }}
                        onClick={() => setTypedFont(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  className="type-sig-input"
                  placeholder="Type your name"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  aria-label="Type your signature"
                  style={{ color: inkColor }}
                />
                {typedText && (
                  <div
                    className="type-sig-preview"
                    style={{
                      color: inkColor,
                      font: typedFont,
                    }}
                    aria-label="Signature preview"
                  >
                    {typedText}
                  </div>
                )}
              </div>
            )}

            {sigMode === "upload" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <DropZone
                  accept=".png,.jpg,.jpeg,.gif,.webp,image/*"
                  onFiles={handleUploadSigFile}
                  label="Drop a signature image, or click to browse"
                  sublabel="PNG, JPG, GIF, or WebP. Use a transparent-background PNG for best results."
                />
                {uploadError && (
                  <div className="tool-error" role="alert">
                    {uploadError}
                  </div>
                )}
                {sigDataUrl && (
                  <div className="uploaded-sig-preview">
                    <img
                      src={sigDataUrl}
                      alt="Uploaded signature preview"
                      className="uploaded-sig-img"
                    />
                  </div>
                )}
              </div>
            )}

            {hasSig && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}
              >
                <output className="tool-success" aria-live="polite" style={{ flex: 1 }}>
                  Signature ready. Place it on the document in step 3.
                </output>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSaveSignature}
                  title="Save this signature for quick reuse next time"
                >
                  {saveSigFlash ? "Saved!" : "Save for reuse"}
                </button>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: "var(--ink-faint)", fontSize: "0.83rem" }}>
            Upload a PDF in step 1 first.
          </p>
        )}
      </section>

      {/* Step 3: Place and download */}
      <section className="card sign-step" aria-labelledby="step3-heading">
        <div className="sign-step-header">
          <span className={`sign-step-number${step3Active ? "" : " sign-step-number--inactive"}`}>
            3
          </span>
          <h2
            id="step3-heading"
            className={`sign-step-title${step3Active ? "" : " sign-step-title--inactive"}`}
          >
            Place signature and download
          </h2>
        </div>

        {step3Active ? (
          <>
            <p style={{ fontSize: "0.82rem", color: "var(--ink-mid)" }}>
              Drag your signature to the right position. Use the resize handle (bottom-right corner)
              to adjust size. Arrow keys give fine control.
            </p>

            {/* Date stamp option */}
            <div className="date-stamp-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={dateStampEnabled}
                  onChange={(e) => setDateStampEnabled(e.target.checked)}
                  className="checkbox-input"
                />
                <span>Add date stamp</span>
              </label>
              {dateStampEnabled && (
                <input
                  type="text"
                  className="date-stamp-input"
                  value={dateStampText}
                  onChange={(e) => setDateStampText(e.target.value)}
                  placeholder={todayISO()}
                  aria-label="Date stamp text"
                />
              )}
            </div>

            {pageCount > 1 && (
              <div className="pdf-preview-controls">
                <div className="pdf-page-nav" aria-label="Page navigation">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <span>
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setCurrentPage(Math.min(pageCount - 1, currentPage + 1))}
                    disabled={currentPage === pageCount - 1}
                    aria-label="Next page"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
                {/* Apply to all pages toggle */}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={applyToAllPages}
                    onChange={(e) => setApplyToAllPages(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span>Apply to all {pageCount} pages</span>
                </label>
              </div>
            )}

            <div ref={pdfViewerContainerRef} style={{ minWidth: 0, overflowX: "auto" }}>
              <PdfViewer
                pdfBytes={pdfBytes ?? new ArrayBuffer(0)}
                pageIndex={currentPage}
                sigDataUrl={sigDataUrl}
                overlay={overlay}
                onOverlayChange={updateOverlay}
                dateOverlay={dateStampEnabled ? dateOverlay : null}
                onDateOverlayChange={setDateOverlay}
                dateStampText={dateStampEnabled ? dateStampText : null}
              />
            </div>

            <div className="sig-size-row">
              <span className="mono-label">Signature size</span>
              <input
                type="range"
                className="sig-size-slider"
                min={40}
                max={500}
                step={4}
                value={overlay.w}
                onChange={(e) => {
                  const w = Number(e.target.value);
                  const ratio = overlay.h / overlay.w;
                  updateOverlay((ov) => ({ ...ov, w, h: Math.round(w * ratio) }));
                }}
                aria-label="Signature width"
              />
              <span className="mono-label">{overlay.w}px wide</span>
            </div>

            {downloadError && (
              <div className="tool-error" role="alert">
                {downloadError}
              </div>
            )}

            <div className="tool-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownload}
                disabled={downloading}
                title="Download signed PDF (Ctrl+Enter / Cmd+Enter)"
              >
                {downloading ? "Preparing..." : "Download signed PDF"}
              </button>
              {overlayHistory.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={undoOverlay}
                  title="Undo last placement move (Ctrl+Z)"
                >
                  Undo move
                </button>
              )}
              {applyToAllPages && pageCount > 1 && (
                <span className="mono-label" style={{ alignSelf: "center" }}>
                  Will sign all {pageCount} pages
                </span>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: "var(--ink-faint)", fontSize: "0.83rem" }}>
            {!hasPdf
              ? "Upload a PDF and create a signature first."
              : "Create a signature in step 2 first."}
          </p>
        )}
      </section>
    </div>
  );
}

function PdfIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2f9d8d"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}
