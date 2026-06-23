import { useCallback, useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { RegionSelector } from "./components/RegionSelector";
import { WordHighlightView } from "./components/WordHighlightView";
import { type OcrWord, buildMultiPageSearchablePdf, buildSearchablePdf } from "./ocrPdfUtils";
import {
  buildBatchFilename,
  buildCombinedText,
  buildFilename,
  confidenceLabel,
  createSampleImageFile,
  cropImageToFile,
  downloadText,
  extractLowConfidenceWords,
  getPdfPageCount,
  normaliseText,
  persistLanguage,
  renderPdfPageToFile,
} from "./ocrUtils";
import { useOcrStore } from "./store";

// ── OCR glyph: scan-frame mark (teal corner brackets + amber scan line + coral text hints)
function OcrGlyph() {
  return (
    <>
      <path
        d="M3 11 L3 3 L11 3"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3 L29 3 L29 11"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 21 L3 29 L11 29"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 29 L29 29 L29 21"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="8" y="15" width="16" height="2" rx="1" fill="#e8b04b" />
      <rect x="8" y="10" width="10" height="1.5" rx="0.75" fill="#d9594c" opacity="0.7" />
      <rect x="8" y="20.5" width="7" height="1.5" rx="0.75" fill="#d9594c" opacity="0.5" />
    </>
  );
}

const LANGUAGES = [
  { value: "eng", label: "English" },
  { value: "fra", label: "French" },
  { value: "deu", label: "German" },
  { value: "spa", label: "Spanish" },
  { value: "por", label: "Portuguese" },
  { value: "ita", label: "Italian" },
  { value: "nld", label: "Dutch" },
  { value: "pol", label: "Polish" },
  { value: "rus", label: "Russian" },
  { value: "jpn", label: "Japanese" },
  { value: "kor", label: "Korean" },
  { value: "chi_sim", label: "Chinese (Simplified)" },
  { value: "chi_tra", label: "Chinese (Traditional)" },
  { value: "ara", label: "Arabic" },
  { value: "hin", label: "Hindi" },
];

/** Maximum PDF pages to auto-queue (safety cap). */
const MAX_PDF_PAGES = 20;

export function App() {
  const store = useOcrStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRegionMode, setIsRegionMode] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Batch-mode: are we running all unprocessed items?
  const [batchRunning, setBatchRunning] = useState(false);

  const hasImage = store.imageFile !== null;
  const isRunning = store.status === "loading" || store.status === "running";
  const hasDone = store.status === "done";
  const hasQueue = store.queue.length > 1;

  // ── File ingestion ────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    async (files: File[]) => {
      const imageFiles: File[] = [];
      const pdfFiles: File[] = [];

      for (const f of files) {
        if (f.type === "application/pdf") {
          pdfFiles.push(f);
        } else if (f.type.startsWith("image/")) {
          imageFiles.push(f);
        }
      }

      // Expand PDFs into individual page image files
      if (pdfFiles.length > 0) {
        setPdfLoading(true);
        try {
          for (const pdf of pdfFiles) {
            const pageCount = await getPdfPageCount(pdf);
            if (pageCount === 0) continue;
            const limit = Math.min(pageCount, MAX_PDF_PAGES);
            const pageFiles: File[] = [];
            for (let i = 0; i < limit; i++) {
              const pageFile = await renderPdfPageToFile(pdf, i);
              if (pageFile) {
                // Rename to reflect PDF + page number
                const baseName = pdf.name.replace(/\.[^.]+$/, "");
                const renamedFile = new File([pageFile], `${baseName}_p${i + 1}.png`, {
                  type: "image/png",
                });
                pageFiles.push(renamedFile);
              }
            }
            imageFiles.push(...pageFiles);
          }
        } finally {
          setPdfLoading(false);
        }
      }

      if (imageFiles.length === 0) return;

      if (imageFiles.length === 1 && store.queue.length === 0) {
        store.setImage(imageFiles[0]);
      } else {
        store.addFiles(imageFiles);
      }
    },
    [store]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) handleFiles(files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
      if (item) {
        const file = item.getAsFile();
        if (file) handleFiles([file]);
      }
    },
    [handleFiles]
  );

  // ── OCR core ──────────────────────────────────────────────────────────────

  const runOcr = useCallback(async () => {
    if (!store.imageFile) return;
    store.setStatus("loading");
    store.setProgress(0, "Initialising...");
    store.setCropRect(null);
    setIsRegionMode(false);

    // Determine the source: cropped region or full image
    let sourceFile = store.imageFile;
    if (store.cropRect && store.imageUrl) {
      const cropped = await cropImageToFile(
        store.imageUrl,
        store.cropRect,
        buildFilename(store.imageFile.name, "png")
      );
      if (cropped) sourceFile = cropped;
    }

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      worker = await createWorker(store.language, 1, {
        logger: (m: { status: string; progress: number }) => {
          const pct = Math.round((m.progress ?? 0) * 100);
          const msg =
            m.status === "loading tesseract core"
              ? "Loading OCR engine..."
              : m.status === "initializing tesseract"
                ? "Initialising..."
                : m.status === "loading language traineddata"
                  ? "Loading language data..."
                  : m.status === "initializing api"
                    ? "Preparing..."
                    : m.status === "recognizing text"
                      ? `Scanning... ${pct}%`
                      : m.status;
          store.setStatus("running");
          store.setProgress(pct, msg);
        },
      });

      const result = await worker.recognize(sourceFile);
      const text = normaliseText(result.data.text);
      const conf = Math.round(result.data.confidence);
      const rawWords = result.data.words as
        | Array<{
            text: string;
            confidence: number;
            bbox: { x0: number; y0: number; x1: number; y1: number };
          }>
        | undefined;
      const lowConf = extractLowConfidenceWords(rawWords);
      const ocrWords: OcrWord[] = (rawWords ?? [])
        .filter((w) => w.text.trim().length > 0)
        .map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox }));
      store.setResult(text, conf, lowConf, ocrWords);
    } catch (err) {
      console.error(err);
      store.setStatus("error");
      store.setProgress(0, "OCR failed. Try a clearer image.");
    } finally {
      await worker?.terminate();
    }
  }, [store]);

  // ── Batch run (process all idle queue items) ──────────────────────────────

  const runBatch = useCallback(async () => {
    const idle = store.queue.filter((q) => q.status === "idle");
    if (idle.length === 0) return;
    setBatchRunning(true);
    for (const item of idle) {
      store.setActiveIndex(store.queue.findIndex((q) => q.id === item.id));

      let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
      try {
        store.setStatus("loading");
        store.setProgress(0, `Processing ${item.file.name}...`);
        worker = await createWorker(store.language, 1, {
          logger: (m: { status: string; progress: number }) => {
            const pct = Math.round((m.progress ?? 0) * 100);
            store.setStatus("running");
            store.setProgress(pct, `${item.file.name} - Scanning... ${pct}%`);
          },
        });
        const result = await worker.recognize(item.file);
        const text = normaliseText(result.data.text);
        const conf = Math.round(result.data.confidence);
        const rawWords = result.data.words as
          | Array<{
              text: string;
              confidence: number;
              bbox: { x0: number; y0: number; x1: number; y1: number };
            }>
          | undefined;
        const lowConf = extractLowConfidenceWords(rawWords);
        const ocrWords: OcrWord[] = (rawWords ?? [])
          .filter((w) => w.text.trim().length > 0)
          .map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox }));
        store.setQueueItemResult(item.id, text, conf, "", ocrWords);
        store.setResult(text, conf, lowConf, ocrWords);
      } catch {
        store.setQueueItemResult(item.id, "", 0, "OCR failed");
        store.setStatus("error");
        store.setProgress(0, `Failed to process ${item.file.name}`);
      } finally {
        await worker?.terminate();
      }
    }
    setBatchRunning(false);
  }, [store]);

  // ── Keyboard shortcut: Cmd/Ctrl + Enter ──────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (hasImage && !isRunning && !batchRunning) {
          if (hasQueue) {
            runBatch();
          } else {
            runOcr();
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasImage, isRunning, batchRunning, hasQueue, runOcr, runBatch]);

  // ── Misc handlers ─────────────────────────────────────────────────────────

  const handleSample = useCallback(() => {
    const file = createSampleImageFile();
    if (file) handleFiles([file]);
  }, [handleFiles]);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      store.setLanguage(lang);
      persistLanguage(lang);
    },
    [store]
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(store.editedText);
    store.setCopyDone(true);
    setTimeout(() => store.setCopyDone(false), 1800);
  }, [store]);

  const handleDownload = useCallback(() => {
    const name = store.imageFile?.name ?? "image";
    downloadText(store.editedText, buildFilename(name));
  }, [store]);

  const handleDownloadAll = useCallback(() => {
    const items = store.queue
      .filter((q) => q.status === "done" && q.text)
      .map((q, i) => ({ name: buildBatchFilename(q.file.name, i), text: q.text }));
    if (items.length === 0) return;
    downloadText(buildCombinedText(items), "ocr-all-pages.txt");
  }, [store]);

  const [pdfExporting, setPdfExporting] = useState(false);

  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (!store.imageUrl || !store.imageFile) return;
    setPdfExporting(true);
    setPdfError(null);
    try {
      const mimeType = store.imageFile.type === "image/jpeg" ? "image/jpeg" : "image/png";

      let pdfBytes: Uint8Array<ArrayBuffer>;
      if (hasQueue && store.queue.some((q) => q.status === "done" && q.previewUrl)) {
        // Multi-page: one PDF page per done queue item, using each item's own cached words.
        const pages = store.queue
          .filter((q) => q.status === "done" && q.previewUrl)
          .map((q) => ({
            imageUrl: q.previewUrl,
            words: q.words,
            fallbackText: q.text,
            mimeType: (q.file.type === "image/jpeg" ? "image/jpeg" : "image/png") as
              | "image/png"
              | "image/jpeg",
          }));
        pdfBytes = await buildMultiPageSearchablePdf(pages);
      } else {
        pdfBytes = await buildSearchablePdf(
          store.imageUrl,
          store.ocrWords,
          store.editedText,
          mimeType
        );
      }

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(store.imageFile.name, "pdf");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setPdfError(
        "PDF export currently supports Latin scripts - the text layer could not be embedded for this language."
      );
    } finally {
      setPdfExporting(false);
    }
  }, [store, hasQueue]);

  const handleRegionConfirm = useCallback(
    (rect: { x: number; y: number; w: number; h: number }) => {
      store.setCropRect(rect);
      setIsRegionMode(false);
    },
    [store]
  );

  const handleRegionCancel = useCallback(() => {
    setIsRegionMode(false);
  }, []);

  const clearRegion = useCallback(() => {
    store.setCropRect(null);
  }, [store]);

  return (
    <div className="app-root" onPaste={handlePaste}>
      <Header
        title="Image to Text"
        subtitle="OCR, free, private, runs in your browser"
        brandMark={
          <BrandMark label="OCR scan mark">
            <OcrGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* Drop zone */}
        <section className="card ocr-drop-section">
          {pdfLoading && (
            <div className="ocr-pdf-loading" aria-live="polite">
              Rendering PDF pages...
            </div>
          )}

          {/* Region selector overlays the preview when active */}
          {isRegionMode && store.imageUrl ? (
            <RegionSelector
              imageUrl={store.imageUrl}
              onConfirm={handleRegionConfirm}
              onCancel={handleRegionCancel}
            />
          ) : (
            <div
              className={`ocr-dropzone${isDragging ? " ocr-dropzone--over" : ""}${hasImage ? " ocr-dropzone--has-image" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !hasImage && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (!hasImage && (e.key === "Enter" || e.key === " "))
                  fileInputRef.current?.click();
              }}
              // biome-ignore lint/a11y/useSemanticElements: drop zone combines file-drop + keyboard + click; a native button cannot host the image preview child structure cleanly
              role="button"
              tabIndex={hasImage ? -1 : 0}
              aria-label="Drop image or PDF here or click to choose file"
            >
              {hasImage && store.imageUrl ? (
                <div className="ocr-preview-wrap">
                  <img src={store.imageUrl} alt="Selected for OCR" className="ocr-preview-img" />
                  {store.cropRect && (
                    <div
                      className="ocr-crop-indicator"
                      title="Region selected. OCR will scan only this area."
                    >
                      Region selected
                      <button
                        type="button"
                        className="ocr-crop-clear-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearRegion();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="ocr-clear-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.clearImage();
                      setIsRegionMode(false);
                    }}
                    aria-label="Remove image"
                  >
                    x
                  </button>
                </div>
              ) : (
                <div className="ocr-dropzone-inner">
                  <div className="ocr-dropzone-icon" aria-hidden="true">
                    {/* biome-ignore lint/a11y/noSvgWithoutTitle: parent div is aria-hidden */}
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M8 16 L8 6 L18 6"
                        stroke="var(--accent)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M30 6 L40 6 L40 16"
                        stroke="var(--accent)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 32 L8 42 L18 42"
                        stroke="var(--accent)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M30 42 L40 42 L40 32"
                        stroke="var(--accent)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <rect x="12" y="22" width="24" height="4" rx="2" fill="#e8b04b" />
                      <rect
                        x="12"
                        y="13"
                        width="16"
                        height="3"
                        rx="1.5"
                        fill="#d9594c"
                        opacity="0.6"
                      />
                      <rect
                        x="12"
                        y="31"
                        width="12"
                        height="3"
                        rx="1.5"
                        fill="#d9594c"
                        opacity="0.4"
                      />
                    </svg>
                  </div>
                  <p className="ocr-dropzone-label">Drop image or PDF here</p>
                  <p className="ocr-dropzone-hint">or click to browse · paste from clipboard</p>
                  <p className="ocr-dropzone-hint">PNG, JPG, WEBP, GIF, BMP, TIFF, PDF</p>
                  <button
                    type="button"
                    className="ocr-sample-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSample();
                    }}
                    aria-label="Load a sample image to try OCR"
                  >
                    Try a sample
                  </button>
                </div>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="ocr-file-input"
            onChange={handleFileInput}
            aria-label="Choose image or PDF file"
          />
        </section>

        {/* Batch queue strip */}
        {hasQueue && (
          <section className="card ocr-queue-section">
            <div className="ocr-queue-header">
              <span className="mono-label">Queue ({store.queue.length} files)</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Add more
              </button>
            </div>
            <ul className="ocr-queue-strip">
              {store.queue.map((item, i) => (
                <li
                  key={item.id}
                  className={`ocr-queue-thumb${i === store.activeIndex ? " ocr-queue-thumb--active" : ""} ocr-queue-thumb--${item.status}`}
                >
                  <button
                    type="button"
                    className="ocr-queue-select"
                    onClick={() => store.setActiveIndex(i)}
                    aria-label={`${item.file.name} - ${item.status}`}
                    aria-pressed={i === store.activeIndex}
                  >
                    <img src={item.previewUrl} alt="" className="ocr-queue-img" />
                    <div className="ocr-queue-status-dot" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="ocr-queue-remove"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      store.removeQueueItem(item.id);
                    }}
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Controls */}
        <section className="card ocr-controls-section">
          <div className="ocr-controls-row">
            <div className="ocr-lang-group">
              <label htmlFor="ocr-lang" className="mono-label">
                Language
              </label>
              <select
                id="ocr-lang"
                className="ocr-lang-select"
                value={store.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                disabled={isRunning || batchRunning}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ocr-run-group">
              {hasQueue ? (
                <>
                  <div className="ocr-btn-row">
                    <button
                      type="button"
                      className="btn-primary ocr-run-btn"
                      onClick={runOcr}
                      disabled={!hasImage || isRunning || batchRunning}
                      title="OCR current image (Cmd+Enter for all)"
                    >
                      {isRunning ? "Scanning..." : "This image"}
                    </button>
                    <button
                      type="button"
                      className="btn-primary ocr-run-btn"
                      onClick={runBatch}
                      disabled={!hasImage || isRunning || batchRunning}
                    >
                      {batchRunning ? "Processing..." : `All ${store.queue.length} images`}
                    </button>
                  </div>
                  <span className="ocr-run-hint">Cmd+Enter to scan all</span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-primary ocr-run-btn"
                    onClick={runOcr}
                    disabled={!hasImage || isRunning}
                    aria-describedby={!hasImage ? "ocr-run-hint" : undefined}
                    title="Extract text (Cmd+Enter)"
                  >
                    {isRunning ? "Scanning..." : "Extract Text"}
                  </button>
                  {!hasImage && !isRunning && (
                    <span id="ocr-run-hint" className="ocr-run-hint">
                      Add an image first
                    </span>
                  )}
                  {hasImage && !isRunning && <span className="ocr-run-hint">Cmd+Enter</span>}
                </>
              )}
            </div>

            {/* Region selection toggle */}
            {hasImage && !isRunning && !batchRunning && (
              <div className="ocr-region-group">
                <button
                  type="button"
                  className={`btn-secondary ocr-region-btn${isRegionMode ? " ocr-region-btn--active" : ""}`}
                  onClick={() => setIsRegionMode((v) => !v)}
                  title="Draw a box to OCR just that region"
                >
                  {store.cropRect
                    ? "Change region"
                    : isRegionMode
                      ? "Cancel region"
                      : "Select region"}
                </button>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {(isRunning || batchRunning) && (
            <div className="ocr-progress-wrap" aria-live="polite" aria-atomic="true">
              <div className="ocr-progress-bar">
                <div
                  className="ocr-progress-fill"
                  style={{ width: `${store.progress}%` }}
                  role="progressbar"
                  tabIndex={-1}
                  aria-label="OCR scan progress"
                  aria-valuenow={store.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className="ocr-progress-msg">{store.progressMessage}</span>
            </div>
          )}

          {store.status === "error" && (
            <p className="ocr-error-msg" role="alert">
              {store.progressMessage || "OCR failed. Try a clearer image."}
            </p>
          )}
        </section>

        {/* Result */}
        {hasDone && (
          <section className="card ocr-result-section">
            <div className="ocr-result-header">
              <div className="ocr-result-meta">
                <span className="mono-label">Extracted text</span>
                <span
                  className={`ocr-confidence-badge ocr-confidence--${confidenceLabel(store.confidence).toLowerCase()}`}
                >
                  {confidenceLabel(store.confidence)} confidence · {store.confidence}%
                </span>
                {store.lowConfWords.length > 0 && (
                  <button
                    type="button"
                    className={`ocr-highlight-toggle${store.showWordHighlights ? " ocr-highlight-toggle--on" : ""}`}
                    onClick={() => store.setShowWordHighlights(!store.showWordHighlights)}
                    title="Toggle low-confidence word highlights"
                  >
                    {store.showWordHighlights
                      ? "Hide highlights"
                      : `${store.lowConfWords.length} uncertain words`}
                  </button>
                )}
              </div>
              <div className="ocr-result-actions">
                <button type="button" className="btn-secondary" onClick={handleCopy}>
                  {store.copyDone ? "Copied!" : "Copy"}
                </button>
                <button type="button" className="btn-secondary" onClick={handleDownload}>
                  Download .txt
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadPdf}
                  disabled={pdfExporting}
                  title="Download a PDF with the image as background and invisible searchable text"
                >
                  {pdfExporting ? "Building PDF..." : "Download PDF"}
                </button>
                {pdfError && (
                  <p className="ocr-pdf-error" role="alert">
                    {pdfError}
                  </p>
                )}
                {hasQueue && store.queue.some((q) => q.status === "done" && q.text) && (
                  <button type="button" className="btn-secondary" onClick={handleDownloadAll}>
                    Download all
                  </button>
                )}
              </div>
            </div>

            {store.showWordHighlights && store.lowConfWords.length > 0 ? (
              <WordHighlightView text={store.editedText} lowConfWords={store.lowConfWords} />
            ) : (
              <textarea
                className="ocr-result-textarea"
                value={store.editedText}
                onChange={(e) => store.setEditedText(e.target.value)}
                aria-label="Extracted text (editable)"
                spellCheck={false}
              />
            )}

            {store.editedText.length === 0 && (
              <p className="ocr-empty-hint">
                No text detected. Try a higher-resolution image or a different language.
              </p>
            )}
          </section>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. No image leaves your device." />
    </div>
  );
}
