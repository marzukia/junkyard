import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { captionImage, fetchImageFromUrl, isModelLoaded, loadModel } from "./lib/captioner";
import type { CaptionResult } from "./lib/captioner";
import { useWorkerTask } from "./lib/workerTask";
import {
  type BatchCaptionRow,
  batchToCsv,
  batchToJson,
  downloadText,
  formatBytes,
  formatCaption,
  formatProgress,
  isSupportedImage,
} from "./lib/imageHelpers";
import { useCaptionStore } from "./store/captionStore";
import "./styles/caption.css";
import { MobileWarning } from "./components/MobileWarning";

// ── Brand mark glyph ──────────────────────────────────────────────────────────
// Speech bubble with an eye inside, "describe what you see"

function CaptionBrandGlyph() {
  return (
    <>
      {/* Speech bubble outline (teal) */}
      <path
        d="M4 6a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10l-6 4v-4a2 2 0 0 1-2-2V6z"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Eye shape (amber) */}
      <path
        d="M10 13c1.5-2 4.5-3 6-3s4.5 1 6 3c-1.5 2-4.5 3-6 3s-4.5-1-6-3z"
        stroke="#e8b04b"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Pupil (coral) */}
      <circle cx="16" cy="13" r="1.5" fill="#d9594c" />
    </>
  );
}

// ── Upload drop zone ─────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  onFiles?: (files: File[]) => void;
  disabled: boolean;
  showSample?: boolean;
  onSample?: () => void;
  multipleAllowed?: boolean;
}

function DropZone({
  onFile,
  onFiles,
  disabled,
  showSample,
  onSample,
  multipleAllowed,
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      if (multipleAllowed && onFiles && fileList.length > 1) {
        onFiles(Array.from(fileList));
      } else {
        onFile(fileList[0]);
      }
    },
    [onFile, onFiles, multipleAllowed]
  );

  return (
    <div className="cap-dropzone-outer">
      <button
        type="button"
        className={`cap-dropzone${dragging ? " cap-dropzone--drag" : ""}${disabled ? " cap-dropzone--disabled" : ""}`}
        disabled={disabled}
        aria-label="Upload image, click or drag and drop"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple={multipleAllowed}
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
          aria-hidden="true"
          tabIndex={-1}
        />
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="cap-dropzone-label">
          {multipleAllowed
            ? "Drop images here, or click to upload"
            : "Drop an image here, or click to upload"}
        </span>
        <span className="cap-dropzone-hint">
          PNG, JPG, WebP, GIF{multipleAllowed ? " · multiple files" : ""}
        </span>
        <span className="cap-dropzone-timing">
          First run downloads the model (~90 MB), then captions appear in 2-5 s.
        </span>
      </button>
      {showSample && onSample && (
        <div className="cap-sample-row">
          <button type="button" className="cap-sample-btn" onClick={onSample} disabled={disabled}>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Try a sample image
          </button>
        </div>
      )}
    </div>
  );
}

// ── URL input ─────────────────────────────────────────────────────────────────

interface UrlInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

function UrlInput({ value, onChange, onSubmit, disabled }: UrlInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }
    },
    [onSubmit, disabled, value]
  );

  return (
    <div className="cap-url-wrap">
      <div className="cap-url-row">
        <input
          type="url"
          className="cap-url-input"
          placeholder="https://example.com/image.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Image URL"
        />
        <button
          type="button"
          className="btn-primary cap-url-btn"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Load image from URL"
        >
          Load
        </button>
      </div>
      <p className="cap-url-hint">
        Paste a direct image URL. The browser fetches it directly. Works best with publicly
        accessible images (CORS must be open).
      </p>
      <div className="cap-url-paste-row">
        <button
          type="button"
          className="cap-sample-btn"
          disabled={disabled}
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text.trim()) onChange(text.trim());
            } catch {
              // Clipboard read denied, silently skip
            }
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          Paste from clipboard
        </button>
      </div>
    </div>
  );
}

// ── Input mode tabs ───────────────────────────────────────────────────────────

interface InputTabsProps {
  active: "file" | "url" | "batch";
  onChange: (mode: "file" | "url" | "batch") => void;
  disabled: boolean;
}

function InputTabs({ active, onChange, disabled }: InputTabsProps) {
  return (
    <div className="cap-input-tabs">
      {(["file", "url", "batch"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`cap-input-tab${active === tab ? " cap-input-tab--active" : ""}`}
          onClick={() => !disabled && onChange(tab)}
          disabled={disabled}
        >
          {tab === "file" && "Upload file"}
          {tab === "url" && "Load from URL"}
          {tab === "batch" && "Batch"}
        </button>
      ))}
    </div>
  );
}

// ── Detail level control ──────────────────────────────────────────────────────

interface DetailControlProps {
  numCaptions: number;
  onChange: (n: number) => void;
  disabled: boolean;
}

function DetailControl({ numCaptions, onChange, disabled }: DetailControlProps) {
  return (
    <div className="cap-detail-row">
      <span className="mono-label">Variations</span>
      <div className="space-toggle">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={`space-btn${numCaptions === n ? " space-btn--active" : ""}`}
            onClick={() => onChange(n)}
            disabled={disabled}
            aria-pressed={numCaptions === n}
            title={n === 1 ? "Single caption" : `Generate ${n} caption variations to pick from`}
          >
            {n === 1 ? "1" : `${n}`}
          </button>
        ))}
      </div>
      {numCaptions > 1 && (
        <span className="cap-detail-hint">Generates {numCaptions} variations (slower)</span>
      )}
    </div>
  );
}

// ── Candidate picker ──────────────────────────────────────────────────────────

interface CandidatePickerProps {
  primary: string;
  candidates: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}

function CandidatePicker({ primary, candidates, selectedIndex, onSelect }: CandidatePickerProps) {
  const all = [primary, ...candidates];
  if (all.length <= 1) return null;
  return (
    <div className="cap-candidates-wrap">
      <span className="mono-label">Choose a variation</span>
      <div className="cap-candidates-list">
        {all.map((text, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: stable fixed-length array
            key={i}
            type="button"
            className={`cap-candidate-btn${selectedIndex === i ? " cap-candidate-btn--active" : ""}`}
            onClick={() => onSelect(i)}
            aria-pressed={selectedIndex === i}
          >
            <span className="cap-candidate-num">{i + 1}</span>
            <span className="cap-candidate-text">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Batch panel ───────────────────────────────────────────────────────────────

interface BatchItem {
  file: File;
  status: "pending" | "processing" | "done" | "error";
  caption: string | null;
  error: string | null;
  previewUrl: string | null;
}

interface BatchPanelProps {
  onStart: (files: File[]) => void;
  disabled: boolean;
  onSample?: () => void;
}

function BatchPanel({ onStart, disabled, onSample }: BatchPanelProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<{ loaded: number; total: number } | null>(null);

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter(isSupportedImage);
    if (valid.length === 0) {
      const names = Array.from(files)
        .slice(0, 3)
        .map((f) => `"${f.name}"`)
        .join(", ");
      const suffix = files.length > 3 ? ` and ${files.length - 3} more` : "";
      setBatchError(
        `No supported images found (${names}${suffix}). Please upload PNG, JPG, WebP or GIF files.`
      );
      return;
    }
    setBatchError(null);
    setDone(false);
    setItems(
      valid.map((f) => ({
        file: f,
        status: "pending",
        caption: null,
        error: null,
        previewUrl: URL.createObjectURL(f),
      }))
    );
  }, []);

  const runBatch = useCallback(async () => {
    if (items.length === 0) return;
    cancelRef.current = false;
    setRunning(true);
    onStart(items.map((i) => i.file));

    for (let idx = 0; idx < items.length; idx++) {
      if (cancelRef.current) break;
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: "processing" } : it)));
      try {
        if (!isModelLoaded()) {
          await loadModel((loaded, total, status) => {
            if (status !== "done") {
              setBatchDownloadProgress({ loaded, total });
            } else {
              setBatchDownloadProgress(null);
            }
          });
          setBatchDownloadProgress(null);
        }
        const { caption } = await captionImage(items[idx].file, 1);
        const formatted = formatCaption(caption);
        setItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, status: "done", caption: formatted } : it))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed";
        setItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, status: "error", error: msg } : it))
        );
      }
    }
    setRunning(false);
    setDone(true);
  }, [items, onStart]);

  const exportRows: BatchCaptionRow[] = items
    .filter((it) => it.status === "done" && it.caption)
    .map((it) => ({ filename: it.file.name, caption: it.caption ?? "" }));

  // Cleanup preview URLs on items change
  useEffect(() => {
    return () => {
      for (const it of items) {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      }
    };
  }, [items]);

  return (
    <div className="cap-batch-wrap">
      {items.length === 0 ? (
        <>
          <DropZone
            onFile={(f) => handleFiles([f])}
            onFiles={handleFiles}
            disabled={disabled}
            multipleAllowed
            showSample={!!onSample}
            onSample={onSample}
          />
          {batchError && (
            <div className="cap-error-inline" role="alert">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d9594c"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="cap-error-msg">{batchError}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="cap-batch-list">
            {items.map((it, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable fixed-length array
              <div key={i} className={`cap-batch-item cap-batch-item--${it.status}`}>
                {it.previewUrl && (
                  <img src={it.previewUrl} alt="" aria-hidden="true" className="cap-batch-thumb" />
                )}
                <div className="cap-batch-info">
                  <span className="cap-batch-filename">{it.file.name}</span>
                  {it.status === "processing" && (
                    <span className="cap-batch-status">Processing...</span>
                  )}
                  {it.status === "pending" && <span className="cap-batch-status">Waiting</span>}
                  {it.status === "done" && <span className="cap-batch-caption">{it.caption}</span>}
                  {it.status === "error" && <span className="cap-batch-error">{it.error}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="cap-batch-actions">
            {!running && !done && (
              <button type="button" className="btn-primary" onClick={runBatch}>
                Generate captions ({items.length} images)
              </button>
            )}
            {running && batchDownloadProgress && (
              <span className="cap-status-label" aria-live="polite">
                Downloading model ({formatProgress(batchDownloadProgress.loaded, batchDownloadProgress.total)})...
              </span>
            )}
            {running && !batchDownloadProgress && (
              <span className="cap-status-label">
                <span className="cap-spinner-inline" aria-label="Processing" /> Captioning...
              </span>
            )}
            {done && exportRows.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => downloadText("captions.csv", batchToCsv(exportRows), "text/csv")}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    downloadText("captions.json", batchToJson(exportRows), "application/json")
                  }
                >
                  Export JSON
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                cancelRef.current = true;
                setItems([]);
                setRunning(false);
                setDone(false);
                setBatchError(null);
              }}
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  loaded: number;
  total: number;
  label: string;
}

function ProgressBar({ loaded, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div
      className="cap-progress-wrap"
      role="progressbar"
      tabIndex={0}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="cap-progress-track">
        <div className="cap-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="cap-progress-label">
        {label}, {formatProgress(loaded, total)}
      </span>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    inputFile,
    inputUrl,
    urlInput,
    caption,
    editedCaption,
    candidates,
    selectedIndex,
    errorMsg,
    modelProgress,
    copied,
    copiedAlt,
    numCaptions,
    setInputFile,
    setUrlInput,
    setPhase,
    setModelProgress,
    setCaption,
    setEditedCaption,
    selectCandidate,
    setError,
    setCopied,
    setCopiedAlt,
    setNumCaptions,
    reset,
  } = useCaptionStore();

  // "batch" is a local UI mode (not in Phase)
  const [uiMode, setUiMode] = useState<"file" | "url" | "batch">("file");
  // true while fetchImageFromUrl is in-flight (URL mode only); cleared once we have the File
  const [urlFetching, setUrlFetching] = useState(false);
  const busy = phase === "model-loading" || phase === "processing";

  const { run: runWorker, cancel: cancelWorker } = useWorkerTask<
    { file: File; numCaptions: number },
    CaptionResult
  >();

  const handleCancel = useCallback(() => {
    cancelWorker();
    setPhase("idle");
  }, [cancelWorker, setPhase]);

  const runCaptionPipeline = useCallback(
    async (file: File) => {
      setPhase("model-loading");
      await runWorker(
        new URL("./infer.worker.ts", import.meta.url),
        { file, numCaptions },
        {
          onProgress: (loaded, total, status) => {
            setModelProgress(loaded, total, status);
            setPhase("model-loading");
          },
          onResult: ({ caption: raw, candidates: rawCandidates }) => {
            setPhase("processing");
            setCaption(formatCaption(raw), rawCandidates.map(formatCaption));
          },
          onError: (message) => {
            setError(message);
          },
        }
      );
    },
    [setPhase, setModelProgress, setCaption, setError, numCaptions, runWorker]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedImage(file)) {
        setError(`Unsupported file type "${file.type}". Please upload a PNG, JPG, WebP or GIF.`);
        return;
      }
      const url = URL.createObjectURL(file);
      setInputFile(file, url);
      await runCaptionPipeline(file);
    },
    [setInputFile, runCaptionPipeline, setError]
  );

  const handleUrlLoad = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    try {
      setUrlFetching(true);
      setPhase("processing");
      const file = await fetchImageFromUrl(url);
      setUrlFetching(false);
      if (!isSupportedImage(file)) {
        setError(`The URL did not return a supported image type. Got: ${file.type}`);
        return;
      }
      const blobUrl = URL.createObjectURL(file);
      setInputFile(file, blobUrl);
      await runCaptionPipeline(file);
    } catch (err) {
      setUrlFetching(false);
      const msg = err instanceof Error ? err.message : "Could not load image from URL.";
      setError(msg);
    }
  }, [urlInput, setPhase, setInputFile, runCaptionPipeline, setError]);

  const handleCopy = useCallback(async () => {
    const text = editedCaption ?? caption;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied
    }
  }, [caption, editedCaption, setCopied]);

  const handleCopyAlt = useCallback(async () => {
    const text = editedCaption ?? caption;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(`alt="${text}"`);
      setCopiedAlt(true);
      setTimeout(() => setCopiedAlt(false), 2000);
    } catch {
      // Clipboard access denied
    }
  }, [caption, editedCaption, setCopiedAlt]);

  const handleReset = useCallback(() => {
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    reset();
    setUiMode("file");
  }, [inputUrl, reset]);

  const handleSample = useCallback(async () => {
    try {
      const res = await fetch("/sample.png");
      const blob = await res.blob();
      const file = new File([blob], "sample.png", { type: "image/png" });
      handleFile(file);
    } catch {
      setError("Could not load sample image.");
    }
  }, [handleFile, setError]);

  // Cmd/Ctrl+Enter triggers the primary action
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      if (busy) return;
      const target = e.target as HTMLElement;
      // If focus is inside the URL input row, let the row's own keydown handle it
      if (target.closest(".cap-url-wrap")) return;
      if (phase === "idle" || phase === "error") {
        if (uiMode === "url" && urlInput.trim()) {
          handleUrlLoad();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [busy, phase, uiMode, urlInput, handleUrlLoad]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
    };
  }, [inputUrl]);

  const showResult = phase === "done" && caption;

  return (
    <div className="app-root">
      <Header
        title="Image Captioner"
        subtitle="describe any image with AI, free, private, runs in your browser"
        brandMark={
          <BrandMark label="Image Captioner">
            <CaptionBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <MobileWarning />
        <p className="cap-beta-note">
          <strong>Beta</strong>, first run downloads the model (~90 MB), then it is instant &amp;
          offline. Your images never leave your device.
        </p>

        {/* Input card */}
        {(phase === "idle" || phase === "error") && (
          <div className="card">
            <div className="cap-card-header">
              <InputTabs active={uiMode} onChange={setUiMode} disabled={busy} />
              <DetailControl numCaptions={numCaptions} onChange={setNumCaptions} disabled={busy} />
            </div>

            {uiMode === "file" && (
              <DropZone onFile={handleFile} disabled={busy} showSample onSample={handleSample} />
            )}
            {uiMode === "url" && (
              <UrlInput
                value={urlInput}
                onChange={setUrlInput}
                onSubmit={handleUrlLoad}
                disabled={busy}
              />
            )}
            {uiMode === "batch" && (
              <BatchPanel onStart={() => {}} disabled={busy} onSample={handleSample} />
            )}

            {phase === "error" && (
              <div className="cap-error-inline" role="alert" aria-live="assertive">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#d9594c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="cap-error-msg">{errorMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* Model loading */}
        {phase === "model-loading" && (
          <div className="card">
            <div className="cap-status-wrap" role="status" aria-live="polite">
              <ProgressBar
                loaded={modelProgress.loaded}
                total={modelProgress.total}
                label="Downloading model"
              />
              <p className="cap-status-sub">
                One-time download (~90 MB). Saved in your browser cache.
              </p>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {phase === "processing" && (
          <div className="card">
            <div className="cap-status-wrap" role="status" aria-live="polite">
              <div className="cap-spinner" aria-label={urlFetching ? "Fetching image..." : "Generating caption..."} />
              <p className="cap-status-label">{urlFetching ? "Fetching image..." : "Generating caption..."}</p>
              {inputUrl && (
                <img
                  src={inputUrl}
                  alt="Preview of the file being captioned"
                  className="cap-thumb-preview"
                />
              )}
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {showResult && (
          <div className="card">
            <div className="cap-result-wrap">
              {inputUrl && (
                <div className="cap-result-image-wrap">
                  <img src={inputUrl} alt={editedCaption ?? caption} className="cap-result-image" />
                </div>
              )}

              {/* Candidate picker (only visible when multiple generated) */}
              {candidates.length > 0 && caption && (
                <CandidatePicker
                  primary={caption}
                  candidates={candidates}
                  selectedIndex={selectedIndex}
                  onSelect={selectCandidate}
                />
              )}

              {/* Editable alt-text area */}
              <div className="cap-result-section">
                <div className="cap-result-label">
                  <span className="mono-label">Alt text</span>
                  <span
                    className="cap-uncertainty-badge"
                    title="AI-generated descriptions can be inaccurate for abstract, artistic, or ambiguous images"
                  >
                    AI generated - verify for accuracy
                  </span>
                </div>
                <textarea
                  className="cap-alttext-area"
                  value={editedCaption ?? ""}
                  onChange={(e) => setEditedCaption(e.target.value)}
                  rows={3}
                  aria-label="Editable alt text"
                  spellCheck
                />
              </div>

              <div className="cap-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCopy}
                  aria-label="Copy caption text"
                >
                  {copied ? "Copied!" : "Copy caption"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCopyAlt}
                  aria-label="Copy as HTML alt attribute"
                >
                  {copiedAlt ? "Copied!" : 'Copy as alt="..."'}
                </button>
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Caption another
                </button>
              </div>

              {inputFile && (
                <p className="cap-file-meta">
                  {inputFile.name} · {formatBytes(inputFile.size)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Upload another when done */}
        {phase === "done" && (
          <div className="card">
            <div className="cap-card-header">
              <InputTabs active={uiMode} onChange={setUiMode} disabled={busy} />
              <DetailControl numCaptions={numCaptions} onChange={setNumCaptions} disabled={busy} />
            </div>
            {uiMode === "file" && (
              <DropZone onFile={handleFile} disabled={busy} showSample onSample={handleSample} />
            )}
            {uiMode === "url" && (
              <UrlInput
                value={urlInput}
                onChange={setUrlInput}
                onSubmit={handleUrlLoad}
                disabled={busy}
              />
            )}
            {uiMode === "batch" && (
              <BatchPanel onStart={() => {}} disabled={busy} onSample={handleSample} />
            )}
          </div>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. Your images never leave your device." />
    </div>
  );
}
