import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  checkImageSize,
  deviceMemoryBudgetMB,
  formatBytes,
  formatDimensions,
  formatProgress,
  isConstrainedDevice,
  isSupportedImage,
  outputFilename,
  resizeImageFile,
} from "./lib/imageHelpers";
import type { OutputFormat } from "./lib/imageHelpers";
import { MODEL_SIZE_MB, revokeResult } from "./lib/upscale";
import type { ScaleFactor } from "./lib/upscale";
import { useWorkerTask } from "./lib/workerTask";

/** Shape returned by infer.worker.ts for upscale. */
type UpscaleWorkerResult = {
  imageBytes: ArrayBuffer;
  width: number;
  height: number;
  resultSize: number;
  format: OutputFormat;
};
import { useUpscaleStore } from "./store/upscaleStore";
import "./styles/upscale.css";
import { MobileWarning } from "./components/MobileWarning";

// ── Brand mark glyph ──────────────────────────────────────────────────────────
// Outer teal frame (upscaled), inner coral frame (original), amber corner
// arrows radiating outward -- the "expand/upscale" gesture.

function UpscaleBrandGlyph() {
  return (
    <>
      {/* Outer frame: upscaled image (teal) */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="3"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Inner frame: original size (coral) */}
      <rect
        x="9"
        y="9"
        width="14"
        height="14"
        rx="2"
        stroke="#d9594c"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Four corner outward arrows: upscale gesture (amber) */}
      <polyline
        points="6,10 6,6 10,6"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="22,6 26,6 26,10"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="10,26 6,26 6,22"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="26,22 26,26 22,26"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

// ── Scale factor picker ───────────────────────────────────────────────────────

interface ScalePickerProps {
  value: ScaleFactor;
  onChange: (v: ScaleFactor) => void;
  disabled: boolean;
}

function ScalePicker({ value, onChange, disabled }: ScalePickerProps) {
  return (
    <div className="up-scale-picker">
      <span className="up-scale-label">Scale</span>
      <div className="space-toggle" aria-label="Upscale factor">
        {([2, 4] as ScaleFactor[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`space-btn up-scale-btn${value === s ? " space-btn--active" : ""}`}
            onClick={() => onChange(s)}
            aria-pressed={value === s}
            disabled={disabled}
            title={s === 4 ? "4x (two passes, best for small images up to ~1400px)" : "2x upscale"}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Output format picker ──────────────────────────────────────────────────────

interface FormatPickerProps {
  value: OutputFormat;
  onChange: (v: OutputFormat) => void;
  disabled: boolean;
}

function FormatPicker({ value, onChange, disabled }: FormatPickerProps) {
  const formats: { id: OutputFormat; label: string; title: string }[] = [
    { id: "png", label: "PNG", title: "Lossless, largest file" },
    { id: "jpeg", label: "JPG", title: "Lossy, smallest file (good for photos)" },
    { id: "webp", label: "WebP", title: "Lossy, small file, modern browsers" },
  ];
  return (
    <div className="up-scale-picker">
      <span className="up-scale-label">Format</span>
      <div className="space-toggle" aria-label="Output format">
        {formats.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`space-btn up-scale-btn${value === f.id ? " space-btn--active" : ""}`}
            onClick={() => onChange(f.id)}
            aria-pressed={value === f.id}
            disabled={disabled}
            title={f.title}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled: boolean;
  compact?: boolean;
}

function DropZone({ onFile, disabled, compact = false }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      onFile(file);
    },
    [onFile]
  );

  return (
    <button
      type="button"
      className={`up-dropzone${dragging ? " up-dropzone--drag" : ""}${disabled ? " up-dropzone--disabled" : ""}${compact ? " up-dropzone--compact" : ""}`}
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
        accept="image/png,image/jpeg,image/webp"
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
      {!compact && (
        <>
          <span className="up-dropzone-label">Drop an image here, or click to upload</span>
          <span className="up-dropzone-hint">
            PNG, JPG, WebP &nbsp;|&nbsp; max ~10 MB recommended &nbsp;|&nbsp; or paste (Ctrl+V)
          </span>
        </>
      )}
      {compact && (
        <span className="up-dropzone-label" style={{ fontSize: "0.8rem" }}>
          Try another image
        </span>
      )}
    </button>
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
      className="up-progress-wrap"
      role="progressbar"
      tabIndex={0}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="up-progress-track">
        <div className="up-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="up-progress-label">
        {label}, {formatProgress(loaded, total)}
      </span>
    </div>
  );
}

// ── Copy image button ─────────────────────────────────────────────────────────

interface CopyImageButtonProps {
  resultUrl: string;
}

function CopyImageButton({ resultUrl }: CopyImageButtonProps) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">("idle");

  const handleCopy = useCallback(async () => {
    if (state === "copying") return;
    setState("copying");
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      // Ensure it is a PNG blob for ClipboardItem
      const pngBlob =
        blob.type === "image/png"
          ? blob
          : await new Promise<Blob>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("canvas 2d unavailable"));
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(
                  (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
                  "image/png"
                );
              };
              img.onerror = reject;
              img.src = URL.createObjectURL(blob);
            });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [resultUrl, state]);

  const label =
    state === "copying"
      ? "Copying..."
      : state === "copied"
        ? "Copied!"
        : state === "error"
          ? "Copy failed"
          : "Copy image";

  return (
    <button
      type="button"
      className={`btn-secondary up-copy-btn${state === "copied" ? " up-copy-btn--ok" : ""}${state === "error" ? " up-copy-btn--err" : ""}`}
      onClick={handleCopy}
      disabled={state === "copying"}
      aria-live="polite"
      aria-label={label}
    >
      {label}
    </button>
  );
}

// ── Before / after split slider ───────────────────────────────────────────────

interface SplitSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
}

function SplitSlider({ beforeUrl, afterUrl, beforeLabel, afterLabel }: SplitSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50); // 0-100
  const dragging = useRef(false);

  const applyPosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      applyPosition(e.clientX);
    },
    [applyPosition]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) applyPosition(e.clientX);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [applyPosition]);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      applyPosition(e.touches[0].clientX);
    },
    [applyPosition]
  );

  return (
    <div
      ref={containerRef}
      className="up-split-slider"
      onMouseDown={onMouseDown}
      onTouchStart={(e) => applyPosition(e.touches[0].clientX)}
      onTouchMove={onTouchMove}
      role="slider"
      aria-label="Before/after comparison slider"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 2));
        if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 2));
      }}
    >
      {/* After image (full width, behind) */}
      <img
        src={afterUrl}
        alt="Upscaled"
        className="up-split-img up-split-img--after"
        draggable={false}
      />
      {/* Before image (clipped to left portion via clip-path) */}
      <div className="up-split-before-clip" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img
          src={beforeUrl}
          alt="Original"
          className="up-split-img up-split-img--before"
          draggable={false}
        />
      </div>
      {/* Divider handle */}
      <div className="up-split-handle" style={{ left: `${position}%` }}>
        <div className="up-split-line" />
        <div className="up-split-grip">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle
              cx="9"
              cy="9"
              r="8"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
            <path
              d="M6 9l-2 0M6 9l-1.5-1.5M6 9l-1.5 1.5"
              stroke="var(--accent)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M12 9l2 0M12 9l1.5-1.5M12 9l1.5 1.5"
              stroke="var(--accent)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      {/* Labels */}
      <span className="up-split-label up-split-label--before mono-label">{beforeLabel}</span>
      <span className="up-split-label up-split-label--after mono-label">{afterLabel}</span>
    </div>
  );
}

// ── Large image warning banner ────────────────────────────────────────────────

interface LargeImageWarningProps {
  inputW: number;
  inputH: number;
  scale: ScaleFactor;
  clampedW: number;
  clampedH: number;
  /** When true, this device cannot safely upscale full-size -- hide "proceed anyway". */
  constrainedByMemory: boolean;
  onProceedClamped: () => void;
  onProceedFull: () => void;
  onCancel: () => void;
}

function LargeImageWarning({
  inputW,
  inputH,
  scale,
  clampedW,
  clampedH,
  constrainedByMemory,
  onProceedClamped,
  onProceedFull,
  onCancel,
}: LargeImageWarningProps) {
  const outW = inputW * scale;
  const outH = inputH * scale;
  return (
    <div className="up-warning-wrap">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="up-warning-msg">
        <strong>Large image detected:</strong> {formatDimensions(inputW, inputH)} at {scale}x would
        produce {formatDimensions(outW, outH)},{" "}
        {constrainedByMemory
          ? "which would exceed this device's memory limit and crash the browser tab."
          : "which may freeze your tab or run out of memory."}
      </p>
      <p className="up-warning-sub">
        {constrainedByMemory
          ? `This device has limited memory. The image will be automatically resized to ${formatDimensions(clampedW, clampedH)} before upscaling.`
          : `Recommended: resize to ${formatDimensions(clampedW, clampedH)} before upscaling.`}
      </p>
      <div className="up-warning-actions">
        <button type="button" className="btn-primary" onClick={onProceedClamped}>
          {constrainedByMemory
            ? `Resize to ${formatDimensions(clampedW, clampedH)} and upscale`
            : `Resize to ${formatDimensions(clampedW, clampedH)} then upscale`}
        </button>
        {!constrainedByMemory && (
          <button type="button" className="btn-secondary" onClick={onProceedFull}>
            Upscale full size anyway
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Sample image demo ─────────────────────────────────────────────────────────
// A tiny synthetic 32x32 PNG encoded as base64 that demonstrates before/after.
// Dimensions are intentionally small so there is no network request; the user
// can see the upscaler running immediately on the sample.

// 32x32 checker-pattern PNG (8 shades, generated offline, no external fetch)
const SAMPLE_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAMklEQVR42mNk" +
  "YGD4z8BAAIxpIAAA//8i8r+AAGMaCAAAIB8AAP//Io7/AACgjQAAIB8GgAAA" +
  "AAAASUVORK5CYII=";

function sampleFile(): File {
  const byteString = atob(SAMPLE_PNG_B64);
  const ab = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) ab[i] = byteString.charCodeAt(i);
  return new File([ab], "sample.png", { type: "image/png" });
}

// ── Pending large image state (stored in component, not zustand) ──────────────

interface PendingLargeImage {
  file: File;
  width: number;
  height: number;
  clampedWidth: number;
  clampedHeight: number;
  /** True when the limit came from device memory (not desktop default). Hide "proceed anyway" on mobile. */
  constrainedByMemory: boolean;
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    scale,
    outputFormat,
    inputFile,
    inputUrl,
    inputWidth,
    inputHeight,
    resultUrl,
    resultWidth,
    resultHeight,
    resultSize,
    errorMsg,
    modelProgress,
    setInputFile,
    setInputDimensions,
    setScale,
    setOutputFormat,
    setPhase,
    setModelProgress,
    setResult,
    setError,
    reset,
  } = useUpscaleStore();

  const busy = phase === "model-loading" || phase === "processing";

  // Large image interstitial: stored locally so it doesn't persist
  const [pendingLarge, setPendingLarge] = useState<PendingLargeImage | null>(null);

  const { run: runWorker, cancel: cancelWorker } = useWorkerTask<
    { file: File; scale: ScaleFactor; format: OutputFormat; quality: number },
    UpscaleWorkerResult
  >();

  const handleCancel = useCallback(() => {
    cancelWorker();
    setPhase("idle");
  }, [cancelWorker, setPhase]);

  const runUpscale = useCallback(
    async (file: File) => {
      setPhase("model-loading");
      await runWorker(
        new URL("./infer.worker.ts", import.meta.url),
        { file, scale, format: outputFormat, quality: 0.88 },
        {
          onProgress: (loaded, total, status) => {
            setModelProgress(loaded, total, status);
            if (status === "done") {
              setPhase("processing");
            } else {
              setPhase("model-loading");
            }
          },
          onResult: ({ imageBytes, width, height, resultSize: size, format }) => {
            const blob = new Blob([imageBytes], {
              type: format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp",
            });
            const outUrl = URL.createObjectURL(blob);
            setResult(outUrl, width, height, size);
          },
          onError: (message) => {
            setError(message);
          },
        }
      );
    },
    [scale, outputFormat, setPhase, setModelProgress, setResult, setError, runWorker]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedImage(file)) {
        setError(`Unsupported file type "${file.type}". Please upload a PNG, JPG, or WebP image.`);
        return;
      }
      const url = URL.createObjectURL(file);
      setInputFile(file, url);

      try {
        const budgetMB = deviceMemoryBudgetMB();
        const sizeCheck = await checkImageSize(file, scale, budgetMB);
        setInputDimensions(sizeCheck.width, sizeCheck.height);

        if (sizeCheck.tooLarge && sizeCheck.clampedWidth && sizeCheck.clampedHeight) {
          // Show warning interstitial rather than silently hanging.
          // On constrained devices (constrainedByMemory=true) we hide the
          // "proceed full size anyway" button since it would crash the tab.
          setPendingLarge({
            file,
            width: sizeCheck.width,
            height: sizeCheck.height,
            clampedWidth: sizeCheck.clampedWidth,
            clampedHeight: sizeCheck.clampedHeight,
            constrainedByMemory: sizeCheck.constrainedByMemory,
          });
          return;
        }

        await runUpscale(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error checking image.";
        setError(msg);
      }
    },
    [scale, setInputFile, setInputDimensions, setError, runUpscale]
  );

  const handleProceedClamped = useCallback(async () => {
    if (!pendingLarge) return;
    setPendingLarge(null);
    try {
      const resized = await resizeImageFile(
        pendingLarge.file,
        pendingLarge.clampedWidth,
        pendingLarge.clampedHeight
      );
      // Update input URL to show resized preview
      const url = URL.createObjectURL(resized);
      setInputFile(resized, url);
      setInputDimensions(pendingLarge.clampedWidth, pendingLarge.clampedHeight);
      await runUpscale(resized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resize failed.";
      setError(msg);
    }
  }, [pendingLarge, setInputFile, setInputDimensions, setError, runUpscale]);

  const handleProceedFull = useCallback(async () => {
    if (!pendingLarge) return;
    const file = pendingLarge.file;
    setPendingLarge(null);
    await runUpscale(file);
  }, [pendingLarge, runUpscale]);

  const handleCancelPending = useCallback(() => {
    setPendingLarge(null);
    reset();
  }, [reset]);

  const handleDownload = useCallback(() => {
    if (!resultUrl || !inputFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = outputFilename(inputFile.name, scale, outputFormat);
    a.click();
  }, [resultUrl, inputFile, scale, outputFormat]);

  const handleReset = useCallback(() => {
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    if (resultUrl) revokeResult(resultUrl);
    setPendingLarge(null);
    reset();
  }, [inputUrl, resultUrl, reset]);

  // Cmd/Ctrl+Enter: trigger primary action (upload dialog when idle)
  useEffect(() => {
    if (busy || pendingLarge) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (phase === "idle") {
          // Open the file picker via the hidden input -- find it in the DOM
          const input = document.querySelector<HTMLInputElement>(".up-dropzone input[type=file]");
          input?.click();
        } else if (phase === "done" || phase === "error") {
          handleReset();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, phase, pendingLarge, handleReset]);

  // Global paste handler: accept pasted images
  useEffect(() => {
    if (busy) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void handleFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, handleFile]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      if (resultUrl) revokeResult(resultUrl);
    };
  }, [inputUrl, resultUrl]);

  const headerControls = (
    <div className="up-header-controls">
      <ScalePicker value={scale} onChange={setScale} disabled={busy} />
      <FormatPicker value={outputFormat} onChange={setOutputFormat} disabled={busy} />
    </div>
  );

  return (
    <div className="app-root">
      <Header
        title="Image Upscaler"
        subtitle="AI super-resolution 2x and 4x, free, private, runs in your browser"
        brandMark={
          <BrandMark label="Image Upscaler">
            <UpscaleBrandGlyph />
          </BrandMark>
        }
        controls={headerControls}
      />

      <main className="site-main">
        <MobileWarning />
        <p className="up-beta-note">
          <strong>First run downloads the model (~{MODEL_SIZE_MB} MB)</strong>, then it runs
          offline. Processing a typical photo takes 5-30 seconds. Your images never leave your
          device.
        </p>
        {isConstrainedDevice() && (
          <p className="up-beta-note up-mobile-cap-note">
            <strong>Mobile / limited memory detected.</strong> Large images will be automatically
            downscaled before upscaling to prevent the browser tab from crashing.
            {scale === 4 ? " 4x on this device is limited to smaller inputs." : ""}
          </p>
        )}

        <div className="card">
          {/* Upload zone */}
          {phase === "idle" && !pendingLarge && (
            <>
              <DropZone onFile={handleFile} disabled={false} />
              <div className="up-sample-row">
                <button
                  type="button"
                  className="btn-secondary up-sample-btn"
                  onClick={() => void handleFile(sampleFile())}
                >
                  Try a sample image
                </button>
              </div>
            </>
          )}

          {/* Large image warning interstitial */}
          {pendingLarge && (
            <LargeImageWarning
              inputW={pendingLarge.width}
              inputH={pendingLarge.height}
              scale={scale}
              clampedW={pendingLarge.clampedWidth}
              clampedH={pendingLarge.clampedHeight}
              constrainedByMemory={pendingLarge.constrainedByMemory}
              onProceedClamped={() => void handleProceedClamped()}
              onProceedFull={() => void handleProceedFull()}
              onCancel={handleCancelPending}
            />
          )}

          {/* Model loading */}
          {phase === "model-loading" && (
            <div className="up-status-wrap">
              <ProgressBar
                loaded={modelProgress.loaded}
                total={modelProgress.total}
                label="Downloading model"
              />
              <p className="up-status-sub">
                One-time download (~{MODEL_SIZE_MB} MB). Saved in your browser cache.
              </p>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Processing */}
          {phase === "processing" && (
            <div className="up-status-wrap">
              <div className="up-spinner" aria-label="Processing..." />
              <p className="up-status-label">
                Upscaling {scale}x{scale === 4 ? " (two passes -- keep the tab open)" : ""}...
              </p>
              {inputUrl && (
                <div className="up-processing-meta">
                  <img src={inputUrl} alt="Source" className="up-thumb-preview" />
                  {inputWidth != null && inputHeight != null && (
                    <span className="up-dims-badge">
                      {formatDimensions(inputWidth, inputHeight)} to{" "}
                      <strong>{formatDimensions(inputWidth * scale, inputHeight * scale)}</strong>
                    </span>
                  )}
                </div>
              )}
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Result */}
          {phase === "done" && resultUrl && inputUrl && (
            <div className="up-result-wrap">
              {/* Split slider compare */}
              <SplitSlider
                beforeUrl={inputUrl}
                afterUrl={resultUrl}
                beforeLabel="Original"
                afterLabel={`${scale}x`}
              />

              <div className="up-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownload}
                  aria-label={`Download upscaled image as ${inputFile ? outputFilename(inputFile.name, scale, outputFormat) : `upscaled.${outputFormat}`}`}
                >
                  Download {scale}x {outputFormat.toUpperCase()}
                  {resultSize != null && (
                    <span className="up-btn-size"> ({formatBytes(resultSize)})</span>
                  )}
                </button>
                <CopyImageButton resultUrl={resultUrl} />
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Try another image
                </button>
              </div>

              {/* Metadata row */}
              {inputFile && (
                <p className="up-file-meta mono-label">
                  {inputFile.name}
                  {inputWidth != null && inputHeight != null && (
                    <> &middot; {formatDimensions(inputWidth, inputHeight)}</>
                  )}
                  <> &middot; {formatBytes(inputFile.size)}</>
                  {resultWidth != null && resultHeight != null && (
                    <>
                      {" "}
                      &rarr; {formatDimensions(resultWidth, resultHeight)}
                      {resultSize != null && <> ({formatBytes(resultSize)})</>}
                    </>
                  )}
                </p>
              )}

              {/* Format note for JPEG/WebP (lossless quality info) */}
              {outputFormat !== "png" && (
                <p className="up-format-note mono-label">
                  Saved as {outputFormat.toUpperCase()} at 88% quality. Choose PNG above for
                  lossless output.
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="up-error-wrap">
              <svg
                width="24"
                height="24"
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
              <p className="up-error-msg">{errorMsg}</p>
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Upload a new image when done / errored */}
        {(phase === "done" || phase === "error") && (
          <div className="card">
            <DropZone onFile={handleFile} disabled={busy} compact />
          </div>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. Your files never leave your device." />
    </div>
  );
}
