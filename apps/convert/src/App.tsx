import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { Slider } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildZip, formatBytes } from "./convert";
import type { OutputFormat } from "./convert";
import { processFile } from "./processor";
import { useConverterStore } from "./store";
import type { ConvertFile } from "./store";

const FORMATS: OutputFormat[] = ["jpg", "png", "webp", "avif"];
const ACCEPTED = ".jpg,.jpeg,.png,.webp,.heic,.heif,.avif,image/*";

interface BatchSummary {
  fileCount: number;
  inputBytes: number;
  outputBytes: number;
}

export function App() {
  const {
    files,
    format,
    quality,
    maxDimension,
    exactWidth,
    exactHeight,
    scalePct,
    resizeMode,
    addFiles,
    removeFile,
    clearAll,
    setFormat,
    setQuality,
    setMaxDimension,
    setExactWidth,
    setExactHeight,
    setScalePct,
    setResizeMode,
    updateFile,
  } = useConverterStore();

  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Stable ref so the keyboard handler always calls the latest convertAll without re-subscribing
  const convertAllRef = useRef<() => void>(() => {});

  // Local string state for the exact dimension inputs to allow partial edits
  const [wInput, setWInput] = useState(exactWidth > 0 ? String(exactWidth) : "");
  const [hInput, setHInput] = useState(exactHeight > 0 ? String(exactHeight) : "");
  const [scaleInput, setScaleInput] = useState(scalePct > 0 ? String(scalePct) : "");

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      addFiles(Array.from(incoming));
    },
    [addFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const buildOpts = useCallback(() => {
    return {
      format,
      quality,
      maxDimension: resizeMode === "max" ? maxDimension : 0,
      exactWidth: resizeMode === "exact" ? exactWidth : 0,
      exactHeight: resizeMode === "exact" ? exactHeight : 0,
      scalePct: resizeMode === "scale" ? scalePct : 0,
    };
  }, [format, quality, maxDimension, exactWidth, exactHeight, scalePct, resizeMode]);

  const convertAll = useCallback(async () => {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;
    setConverting(true);
    setBatchSummary(null);

    const opts = buildOpts();
    for (const entry of pending) {
      updateFile(entry.id, { status: "processing", progressPct: 0 });
      try {
        const result = await processFile(entry.file, opts, (pct) =>
          updateFile(entry.id, { progressPct: pct })
        );
        updateFile(entry.id, {
          status: "done",
          progressPct: null,
          outputUrl: result.url,
          outputName: result.name,
          outputSize: result.size,
          outputBlob: result.blob,
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Conversion failed";
        // Surface a friendlier message for the most common failures
        const msg = raw.includes("AVIF encode failed")
          ? "AVIF not supported in this browser -- try Chrome 94+ or Firefox 113+"
          : raw.includes("Could not decode")
            ? "Cannot read this image -- file may be corrupt"
            : raw;
        updateFile(entry.id, { status: "error", progressPct: null, errorMsg: msg });
      }
    }

    setConverting(false);
  }, [files, buildOpts, updateFile]);

  // Keep the ref in sync so the keyboard handler always has the latest version
  convertAllRef.current = convertAll;

  // Build the batch summary after converting finishes
  useEffect(() => {
    if (converting) return;
    const done = files.filter((f) => f.status === "done" && f.outputSize != null);
    if (done.length === 0) {
      setBatchSummary(null);
      return;
    }
    const inputBytes = done.reduce((s, f) => s + f.file.size, 0);
    const outputBytes = done.reduce((s, f) => s + (f.outputSize ?? 0), 0);
    setBatchSummary({ fileCount: done.length, inputBytes, outputBytes });
  }, [converting, files]);

  const downloadAllZip = async () => {
    const done = files.filter((f) => f.status === "done" && f.outputBlob && f.outputName);
    if (done.length === 0) return;
    setZipping(true);
    try {
      const zip = await buildZip(
        done.map((f) => ({ name: f.outputName as string, blob: f.outputBlob as Blob }))
      );
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted-images.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  // Cmd/Ctrl+Enter triggers convert — registered once, calls ref to avoid re-subscribing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        convertAllRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const totalCount = files.length;
  const progress =
    totalCount > 0
      ? ((doneCount + files.filter((f) => f.status === "error").length) / totalCount) * 100
      : 0;

  const savingPct =
    batchSummary && batchSummary.inputBytes > 0
      ? Math.round((1 - batchSummary.outputBytes / batchSummary.inputBytes) * 100)
      : 0;

  return (
    <div className="app-root">
      <Header
        title="Convert"
        subtitle="convert & compress images · heic jpg webp avif png · no upload"
        brandMark={<BrandMark />}
      />

      <main className="site-main">
        {/* Drop zone, label wraps the hidden input for semantic correctness */}
        <label
          className={`drop-zone${dragging ? " drop-zone--active" : ""}`}
          aria-label="Drop images here or click to select files"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <UploadIcon />
          <span className="drop-zone-title">Drop images here or click to select</span>
          <span className="drop-zone-sub">
            HEIC · JPG · PNG · WebP · AVIF · batch supported · runs in your browser
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            onChange={onInputChange}
            style={{ display: "none" }}
          />
        </label>

        {/* Controls */}
        <div className="card">
          <div className="controls-grid">
            <div className="control-group">
              <span className="mono-label">Output format</span>
              <fieldset
                className="format-toggle"
                aria-label="Output format"
                style={{ border: "none", padding: 0, margin: 0 }}
              >
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`format-btn${format === f ? " format-btn--active" : ""}`}
                    onClick={() => setFormat(f)}
                    aria-pressed={format === f}
                  >
                    {f === "jpg" ? "JPG" : f.toUpperCase()}
                  </button>
                ))}
              </fieldset>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="quality-slider">
                Quality
                <span className="control-value">{quality}%</span>
              </label>
              <div className="slider-wrap">
                <Slider
                  id="quality-slider"
                  min={10}
                  max={100}
                  step={5}
                  value={quality}
                  onChange={setQuality}
                  aria-label="Output quality"
                />
              </div>
            </div>

            {/* Resize controls */}
            <div className="control-group" style={{ gridColumn: "1 / -1" }}>
              <span className="mono-label">Resize</span>
              <div className="resize-mode-row">
                <fieldset
                  className="format-toggle"
                  aria-label="Resize mode"
                  style={{ border: "none", padding: 0, margin: 0 }}
                >
                  {(["max", "exact", "scale"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`format-btn${resizeMode === m ? " format-btn--active" : ""}`}
                      onClick={() => setResizeMode(m)}
                      aria-pressed={resizeMode === m}
                    >
                      {m === "max" ? "Max dimension" : m === "exact" ? "Exact px" : "Scale %"}
                    </button>
                  ))}
                </fieldset>

                {resizeMode === "max" && (
                  <div className="resize-inline">
                    <div className="slider-wrap" style={{ flex: 1 }}>
                      <Slider
                        id="size-slider"
                        min={0}
                        max={4096}
                        step={64}
                        value={maxDimension}
                        onChange={setMaxDimension}
                        aria-label="Max output dimension"
                        marks={[
                          { value: 0, label: "" },
                          { value: 1920, label: "" },
                          { value: 4096, label: "" },
                        ]}
                      />
                    </div>
                    <span className="control-value resize-value">
                      {maxDimension === 0 ? "original" : `${maxDimension}px`}
                    </span>
                  </div>
                )}

                {resizeMode === "exact" && (
                  <div className="resize-exact-row">
                    <label className="resize-field-label" htmlFor="exact-w">
                      W
                    </label>
                    <input
                      id="exact-w"
                      className="resize-num-input"
                      type="number"
                      min={1}
                      max={8192}
                      placeholder="width"
                      value={wInput}
                      onChange={(e) => {
                        setWInput(e.target.value);
                        const n = Number.parseInt(e.target.value, 10);
                        setExactWidth(Number.isFinite(n) && n > 0 ? n : 0);
                      }}
                    />
                    <span className="resize-field-sep">x</span>
                    <label className="resize-field-label" htmlFor="exact-h">
                      H
                    </label>
                    <input
                      id="exact-h"
                      className="resize-num-input"
                      type="number"
                      min={1}
                      max={8192}
                      placeholder="height"
                      value={hInput}
                      onChange={(e) => {
                        setHInput(e.target.value);
                        const n = Number.parseInt(e.target.value, 10);
                        setExactHeight(Number.isFinite(n) && n > 0 ? n : 0);
                      }}
                    />
                    <span className="resize-hint">leave one blank to preserve aspect ratio</span>
                  </div>
                )}

                {resizeMode === "scale" && (
                  <div className="resize-scale-row">
                    <input
                      className="resize-num-input"
                      type="number"
                      min={1}
                      max={200}
                      placeholder="100"
                      aria-label="Scale percentage"
                      value={scaleInput}
                      onChange={(e) => {
                        setScaleInput(e.target.value);
                        const n = Number.parseInt(e.target.value, 10);
                        setScalePct(Number.isFinite(n) && n > 0 ? n : 0);
                      }}
                    />
                    <span className="resize-pct-label">%</span>
                    <span className="resize-hint">of original (1 to 200)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Batch summary payoff banner */}
        {batchSummary && (
          <output className="batch-summary" aria-live="polite">
            <span className="batch-summary-files">
              {batchSummary.fileCount} {batchSummary.fileCount === 1 ? "file" : "files"}
            </span>
            <span className="batch-summary-sep">·</span>
            <span className="batch-summary-size">
              {formatBytes(batchSummary.inputBytes)} converted
            </span>
            <span className="batch-summary-sep">·</span>
            {savingPct > 0 ? (
              <span className="batch-summary-saving">
                {formatBytes(batchSummary.outputBytes)} output &nbsp;
                <strong>saved {savingPct}%</strong>
              </span>
            ) : (
              <span className="batch-summary-saving">
                {formatBytes(batchSummary.outputBytes)} output
              </span>
            )}
          </output>
        )}

        {/* File queue */}
        {files.length > 0 && (
          <div className="card">
            {totalCount > 0 && converting && (
              <div className="progress-bar-wrap" style={{ marginBottom: "1rem" }}>
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            )}

            <div className="file-queue" aria-label="File queue" aria-live="polite">
              {files.map((entry) => (
                <FileRow key={entry.id} entry={entry} onRemove={() => removeFile(entry.id)} />
              ))}
            </div>

            <div className="action-bar" style={{ marginTop: "1.25rem" }}>
              <button
                type="button"
                className="btn-accent"
                onClick={convertAll}
                disabled={converting || pendingCount === 0}
                aria-busy={converting}
                title="Convert (Cmd+Enter)"
              >
                {converting
                  ? "Converting..."
                  : `Convert ${pendingCount > 0 ? pendingCount : ""} file${pendingCount !== 1 ? "s" : ""}`}
              </button>

              {doneCount > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={downloadAllZip}
                  disabled={zipping}
                  aria-busy={zipping}
                >
                  {zipping ? "Zipping…" : `Download all as zip (${doneCount})`}
                </button>
              )}

              <div className="action-bar-right">
                <button type="button" className="btn-secondary" onClick={clearAll}>
                  Clear all
                </button>
              </div>
            </div>
          </div>
        )}

        {files.length === 0 && (
          <p className="empty-hint">
            Your files are processed entirely in your browser, nothing is uploaded.
          </p>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. No upload, no account." />
    </div>
  );
}

function FileRow({ entry, onRemove }: { entry: ConvertFile; onRemove: () => void }) {
  const isInvalid = entry.status === "invalid";
  return (
    <div
      className={`file-row${entry.status === "done" ? " file-row--done" : ""}${entry.status === "error" || isInvalid ? " file-row--error" : ""}`}
    >
      {entry.previewUrl ? (
        <img src={entry.previewUrl} alt="" className="file-thumb" aria-hidden="true" />
      ) : (
        <div className="file-thumb-placeholder" aria-hidden="true">
          <ImageIcon />
        </div>
      )}

      <div className="file-info">
        <div className="file-name" title={entry.file.name}>
          {entry.file.name}
        </div>
        <div className="file-meta">
          {formatBytes(entry.file.size)}
          {entry.status === "done" && entry.outputSize != null && (
            <>
              {" "}
              &rarr; {formatBytes(entry.outputSize)}
              {entry.outputSize < entry.file.size && (
                <span style={{ color: "var(--accent)", marginLeft: "0.35em" }}>
                  -{Math.round((1 - entry.outputSize / entry.file.size) * 100)}%
                </span>
              )}
            </>
          )}
          {(entry.status === "error" || isInvalid) && entry.errorMsg && (
            <span style={{ color: "#d9594c", marginLeft: "0.35em" }}>{entry.errorMsg}</span>
          )}
        </div>
      </div>

      {entry.status === "processing" && entry.progressPct != null ? (
        <span
          className="file-status file-status--processing"
          aria-label={`Converting: ${entry.progressPct}%`}
          title={`${entry.progressPct}%`}
        >
          {entry.progressPct}%
        </span>
      ) : (
        <span
          className={`file-status file-status--${entry.status}`}
          aria-label={`Status: ${entry.status}`}
        >
          {entry.status === "processing" ? "..." : entry.status}
        </span>
      )}

      {entry.status === "done" && entry.outputUrl && entry.outputName && (
        <a
          href={entry.outputUrl}
          download={entry.outputName}
          className="file-download-btn"
          aria-label={`Download ${entry.outputName}`}
        >
          <DownloadIcon />
          Save
        </a>
      )}

      <button
        type="button"
        className="file-remove-btn"
        onClick={onRemove}
        aria-label={`Remove ${entry.file.name}`}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      className="drop-zone-icon"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
