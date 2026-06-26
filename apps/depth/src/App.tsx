import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  exportRaw16bit,
  renderDepthFromCache,
  revokeResult,
} from "./lib/depthEstimation";
import InferWorker from "./infer.worker.ts?worker";
import { useWorkerTask } from "./lib/workerTask";

type DepthWorkerResult = {
  imageBytes: ArrayBuffer;
  width: number;
  height: number;
  normalisedDepth: Float32Array;
};
import { formatBytes, formatProgress, isSupportedImage, outputFilename } from "./lib/imageHelpers";
import { useDepthStore } from "./store/depthStore";
import "./styles/depth.css";

// ── Brand mark glyph ──────────────────────────────────────────────────────────
// Layered depth contour lines evoking a depth map, closer = bold amber/coral,
// distant = faint teal. No heavy fill block.

function DepthBrandGlyph() {
  return (
    <>
      {/* Photo frame (teal) */}
      <rect
        x="2"
        y="4"
        width="28"
        height="24"
        rx="2.5"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Far contour, faint teal */}
      <path
        d="M7 20 Q16 14 25 20"
        stroke="#2f9d8d"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Mid contour */}
      <path
        d="M7 17 Q16 11 25 17"
        stroke="#2f9d8d"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* Near contour, amber */}
      <path d="M7 14 Q16 8 25 14" stroke="#e8b04b" strokeWidth="1.9" strokeLinecap="round" />
      {/* Focal point (closest), coral */}
      <circle cx="16" cy="9.5" r="2" fill="#d9594c" />
    </>
  );
}

// ── Colourmap toggle ──────────────────────────────────────────────────────────

import type { ColourMap } from "./lib/depthEstimation";
import { MobileWarning } from "./components/MobileWarning";
import { useCmdEnter } from "./components/useCmdEnter";

const COLOURMAPS: { value: ColourMap; label: string; title: string }[] = [
  { value: "viridis", label: "Viridis", title: "Viridis: yellow = close, purple = far" },
  { value: "magma", label: "Magma", title: "Magma: white = close, black = far" },
  { value: "turbo", label: "Turbo", title: "Turbo: red = close, blue = far" },
  { value: "plasma", label: "Plasma", title: "Plasma: yellow = close, blue = far" },
  { value: "greyscale", label: "Grey", title: "Greyscale: white = close, black = far" },
];

interface ColourMapToggleProps {
  value: ColourMap;
  onChange: (v: ColourMap) => void;
  disabled: boolean;
}

function ColourMapToggle({ value, onChange, disabled }: ColourMapToggleProps) {
  return (
    <div className="depth-map-toggle">
      <span className="depth-map-label">Colourmap</span>
      <div className="space-toggle" aria-label="Depth colourmap">
        {COLOURMAPS.map(({ value: v, label, title }) => (
          <button
            key={v}
            type="button"
            className={`space-btn${value === v ? " space-btn--active" : ""}`}
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            disabled={disabled}
            title={title}
          >
            {label}
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
  /** When true, show the example depth-map preview above the drop target */
  showExample?: boolean;
}

function DropZone({ onFile, disabled, showExample }: DropZoneProps) {
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
    <div className="depth-dropzone-outer">
      {showExample && (
        <div className="depth-example" aria-label="Example depth map output">
          <div className="depth-example-pair">
            <div className="depth-example-panel">
              <span className="depth-compare-label mono-label">Photo</span>
              <div className="depth-example-img depth-example-img--source" aria-hidden="true">
                <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true">
                  {/* Sky gradient */}
                  <defs>
                    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b8d4e8" />
                      <stop offset="100%" stopColor="#ddeef7" />
                    </linearGradient>
                    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7cae6e" />
                      <stop offset="100%" stopColor="#5a8c4e" />
                    </linearGradient>
                  </defs>
                  <rect width="160" height="120" fill="url(#sky)" />
                  {/* Mountains */}
                  <polygon points="0,90 40,42 80,90" fill="#8fa8b8" opacity="0.7" />
                  <polygon points="40,90 90,28 140,90" fill="#6e8898" opacity="0.85" />
                  <polygon points="100,90 140,50 160,90" fill="#7a9aaa" opacity="0.65" />
                  {/* Ground */}
                  <rect x="0" y="88" width="160" height="32" fill="url(#ground)" />
                  {/* Tree (near) */}
                  <rect x="118" y="72" width="6" height="18" fill="#6b4c30" />
                  <ellipse cx="121" cy="66" rx="14" ry="16" fill="#2d6e28" />
                  {/* Tree (far) */}
                  <rect x="28" y="78" width="4" height="12" fill="#7a5a3a" opacity="0.7" />
                  <ellipse cx="30" cy="74" rx="9" ry="10" fill="#3a7a35" opacity="0.65" />
                </svg>
              </div>
            </div>
            <div className="depth-example-arrow" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M4 10h12M12 6l4 4-4 4"
                  stroke="var(--ink-faint)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="depth-example-panel">
              <span className="depth-compare-label mono-label">Depth map</span>
              <div className="depth-example-img depth-example-img--depth" aria-hidden="true">
                <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true">
                  <defs>
                    <linearGradient id="depthSky" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#440154" />
                      <stop offset="100%" stopColor="#31688e" />
                    </linearGradient>
                    <linearGradient id="depthGround" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#35b779" />
                      <stop offset="100%" stopColor="#fde725" />
                    </linearGradient>
                  </defs>
                  <rect width="160" height="120" fill="url(#depthSky)" />
                  {/* Far mountains, dark (far = purple) */}
                  <polygon points="0,90 40,42 80,90" fill="#31688e" opacity="0.8" />
                  <polygon points="40,90 90,28 140,90" fill="#2d6b8e" opacity="0.9" />
                  <polygon points="100,90 140,50 160,90" fill="#35688e" opacity="0.75" />
                  {/* Ground, close = green-yellow */}
                  <rect x="0" y="88" width="160" height="32" fill="url(#depthGround)" />
                  {/* Tree near = bright (close) */}
                  <rect x="118" y="72" width="6" height="18" fill="#b0da3a" />
                  <ellipse cx="121" cy="66" rx="14" ry="16" fill="#fde725" />
                  {/* Tree far = dark (far) */}
                  <rect x="28" y="78" width="4" height="12" fill="#3b6b8e" opacity="0.8" />
                  <ellipse cx="30" cy="74" rx="9" ry="10" fill="#2f6e8d" opacity="0.75" />
                </svg>
              </div>
            </div>
          </div>
          <p className="depth-example-caption">
            Depth maps encode distance from the camera as colour: yellow = close, purple = far
            (viridis scale). Upload any photo to generate yours.
          </p>
        </div>
      )}
      <button
        type="button"
        className={`depth-dropzone${dragging ? " depth-dropzone--drag" : ""}${disabled ? " depth-dropzone--disabled" : ""}`}
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
        <span className="depth-dropzone-label">Drop an image here, or click to upload</span>
        <span className="depth-dropzone-hint">PNG, JPG, WebP, GIF</span>
      </button>
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
      className="depth-progress-wrap"
      role="progressbar"
      tabIndex={0}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="depth-progress-track">
        <div className="depth-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="depth-progress-label">
        {label}, {formatProgress(loaded, total)}
      </span>
    </div>
  );
}

// ── Colour legend ─────────────────────────────────────────────────────────────

const LEGEND_GRADIENTS: Record<ColourMap, string> = {
  viridis: "linear-gradient(to right, #440154, #31688e, #35b779, #fde725)",
  magma: "linear-gradient(to right, #000004, #3b0f70, #8c2981, #de4968, #fecf92, #fcfdbf)",
  turbo: "linear-gradient(to right, #30123b, #4777ef, #1bd0d5, #62fc6b, #d2e935, #f66b19, #7a0403)",
  plasma: "linear-gradient(to right, #0d0887, #7e03a8, #cc4778, #f89540, #f0f921)",
  greyscale: "linear-gradient(to right, #000000, #ffffff)",
};

function ColourLegend({ colourMap }: { colourMap: ColourMap }) {
  return (
    <div className="depth-legend" aria-label="Depth colour scale">
      <div
        className="depth-legend-bar"
        style={{ background: LEGEND_GRADIENTS[colourMap] }}
        aria-hidden="true"
      />
      <div className="depth-legend-labels">
        <span className="depth-legend-label mono-label">far</span>
        <span className="depth-legend-label mono-label">close</span>
      </div>
    </div>
  );
}

// ── Parallax preview ──────────────────────────────────────────────────────────
// Mouse/touch-driven 2.5D wiggle: depth map is used as a displacement layer
// to create a subtle parallax effect between the original photo and the depth.

interface ParallaxPreviewProps {
  inputUrl: string;
  depthUrl: string;
}

function ParallaxPreview({ inputUrl, depthUrl }: ParallaxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Normalise to [-1, 1]
    targetRef.current = {
      x: (e.clientX - cx) / (rect.width / 2),
      y: (e.clientY - cy) / (rect.height / 2),
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const touch = e.touches[0];
    targetRef.current = {
      x: (touch.clientX - cx) / (rect.width / 2),
      y: (touch.clientY - cy) / (rect.height / 2),
    };
  }, []);

  const handleLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 };
  }, []);

  // Smooth spring interpolation
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      const LERP = 0.1;
      currentRef.current = {
        x: currentRef.current.x + (targetRef.current.x - currentRef.current.x) * LERP,
        y: currentRef.current.y + (targetRef.current.y - currentRef.current.y) * LERP,
      };
      setOffset({ ...currentRef.current });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Max displacement in px
  const MAX_PX = 14;
  const dx = offset.x * MAX_PX;
  const dy = offset.y * MAX_PX;

  return (
    <div
      ref={containerRef}
      className="depth-parallax"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleLeave}
      aria-label="Parallax depth preview, move mouse to see depth effect"
      role="img"
    >
      {/* Base: original photo, shifts backward (opposite to mouse) */}
      <img
        src={inputUrl}
        alt=""
        aria-hidden="true"
        className="depth-parallax-layer depth-parallax-layer--photo"
        style={{
          transform: `translate(${-dx * 0.4}px, ${-dy * 0.4}px) scale(1.06)`,
        }}
      />
      {/* Overlay: depth map, shifts forward (same direction as mouse) */}
      <img
        src={depthUrl}
        alt=""
        aria-hidden="true"
        className="depth-parallax-layer depth-parallax-layer--depth"
        style={{
          transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) scale(1.06)`,
          mixBlendMode: "screen",
          opacity: 0.55,
        }}
      />
      <span className="depth-parallax-hint mono-label">move mouse to feel depth</span>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    inputFile,
    inputUrl,
    resultUrl,
    errorMsg,
    colourMap,
    invert,
    modelProgress,
    depthCache,
    setInputFile,
    setPhase,
    setModelProgress,
    setResult,
    setResultUrl,
    setError,
    setColourMap,
    setInvert,
    reset,
  } = useDepthStore();

  const busy = phase === "model-loading" || phase === "processing";

  // Re-render the depth map from cache when colourmap or invert changes
  // without re-running inference (the bug fix).
  const prevColourMap = useRef(colourMap);
  const prevInvert = useRef(invert);
  useEffect(() => {
    if (phase !== "done") {
      prevColourMap.current = colourMap;
      prevInvert.current = invert;
      return;
    }
    if (colourMap === prevColourMap.current && invert === prevInvert.current) return;
    if (!depthCache) return;

    const oldUrl = resultUrl;
    renderDepthFromCache(depthCache, colourMap, invert).then((newUrl) => {
      setResultUrl(newUrl);
      if (oldUrl) revokeResult(oldUrl);
    });

    prevColourMap.current = colourMap;
    prevInvert.current = invert;
  }, [colourMap, invert, phase, depthCache, resultUrl, setResultUrl]);

  const { run: runWorker, cancel: cancelWorker } = useWorkerTask<
    { file: File; colourMap: typeof colourMap; invert: boolean },
    DepthWorkerResult
  >();

  const handleCancel = useCallback(() => {
    cancelWorker();
    setPhase("idle");
  }, [cancelWorker, setPhase]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedImage(file)) {
        setError(
          file.type
            ? `Unsupported file type "${file.type}". Please upload a PNG, JPG, WebP or GIF.`
            : "Could not recognise this file as an image. Please upload a PNG, JPG, WebP or GIF."
        );
        return;
      }

      // Verify the file actually decodes as an image before kicking off the model.
      // A file renamed to .jpg but containing garbage will pass the MIME check but
      // fail here, producing a clear message rather than a silent hang or blank error.
      try {
        const bmp = await createImageBitmap(file);
        bmp.close();
      } catch {
        setError(
          "This file could not be decoded as an image. Please check the file and try again."
        );
        return;
      }

      const url = URL.createObjectURL(file);
      setInputFile(file, url);

      setPhase("idle");
      setPhase("model-loading");
      await runWorker(
        () => new InferWorker(),
        { file, colourMap, invert },
        {
          onProgress: (loaded, total, status) => {
            setModelProgress(loaded, total, status);
            if (status === "done") {
              setPhase("processing");
            } else {
              setPhase("model-loading");
            }
          },
          onResult: ({ imageBytes, width, height, normalisedDepth }) => {
            const blob = new Blob([imageBytes], { type: "image/png" });
            const outUrl = URL.createObjectURL(blob);
            const cache = { normalised: normalisedDepth, width, height };
            setResult(outUrl, cache);
          },
          onError: (message) => {
            const msg = message || "An error occurred while generating the depth map. Please try another image.";
            setError(msg);
          },
        }
      );
    },
    [colourMap, invert, setInputFile, setPhase, setModelProgress, setResult, setError, runWorker]
  );

  // Cmd/Ctrl+Enter triggers upload when idle
  useCmdEnter(() => {
        e.preventDefault();
        // If idle, trigger the file dialog
        if (phase === "idle" || phase === "error") {
          const input = document.querySelector<HTMLInputElement>('input[type="file"]');
          input?.click();
    };
    window.addEventListener("keydown", handleKeyDown);
  });

  const handleDownload = useCallback(() => {
    if (!resultUrl || !inputFile) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = outputFilename(inputFile.name);
    a.click();
  }, [resultUrl, inputFile]);

  const handleDownloadRaw = useCallback(async () => {
    if (!depthCache || !inputFile) return;
    try {
      const rawUrl = await exportRaw16bit(depthCache, invert);
      const a = document.createElement("a");
      a.href = rawUrl;
      const base = inputFile.name.replace(/\.[^.]+$/, "");
      a.download = `${base}-depth-raw16.png`;
      a.click();
      // Revoke after a short delay to allow the download to start
      setTimeout(() => URL.revokeObjectURL(rawUrl), 5000);
    } catch (_err) {
      // Raw export failed silently; non-critical
    }
  }, [depthCache, inputFile, invert]);

  const handleReset = useCallback(() => {
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    if (resultUrl) revokeResult(resultUrl);
    reset();
  }, [inputUrl, resultUrl, reset]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      if (resultUrl) revokeResult(resultUrl);
    };
  }, [inputUrl, resultUrl]);

  return (
    <div className="app-root">
      <Header
        title="Depth Map Generator"
        subtitle="turn any photo into a depth map, free, private, runs in your browser"
        brandMark={
          <BrandMark label="Depth Map Generator">
            <DepthBrandGlyph />
          </BrandMark>
        }
        controls={
          <div className="depth-header-controls">
            <ColourMapToggle value={colourMap} onChange={setColourMap} disabled={busy} />
            <button
              type="button"
              className={`space-btn${invert ? " space-btn--active" : ""}`}
              onClick={() => setInvert(!invert)}
              disabled={busy}
              aria-pressed={invert}
              title="Invert depth: swap near/far"
            >
              Invert
            </button>
          </div>
        }
      />

      <main className="site-main">
        <MobileWarning />
        {/* Beta notice */}
        <p className="depth-beta-note">
          <strong>Beta</strong>, first run downloads the model (~25 MB), then it is instant &amp;
          offline. Your images never leave your device.
        </p>

        <div className="card">
          {/* Upload zone */}
          {phase === "idle" && <DropZone onFile={handleFile} disabled={false} showExample />}

          {/* Model loading */}
          {phase === "model-loading" && (
            <div className="depth-status-wrap" role="status" aria-live="polite">
              <ProgressBar
                loaded={modelProgress.loaded}
                total={modelProgress.total}
                label="Downloading model"
              />
              <p className="depth-status-sub">
                One-time download (~25 MB). Saved in your browser cache.
              </p>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Processing */}
          {phase === "processing" && (
            <div className="depth-status-wrap" role="status" aria-live="polite">
              <div className="depth-spinner" aria-label="Processing..." />
              <p className="depth-status-label">Generating depth map...</p>
              {inputUrl && <img src={inputUrl} alt="Source" className="depth-thumb-preview" />}
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Result */}
          {phase === "done" && resultUrl && (
            <div className="depth-result-wrap">
              {/* Parallax preview */}
              {inputUrl && <ParallaxPreview inputUrl={inputUrl} depthUrl={resultUrl} />}

              <div className="depth-compare">
                <div className="depth-compare-panel">
                  <span className="depth-compare-label mono-label">Original</span>
                  {inputUrl && (
                    <img src={inputUrl} alt="Original input" className="depth-compare-img" />
                  )}
                </div>
                <div className="depth-compare-panel">
                  <span className="depth-compare-label mono-label">Depth map</span>
                  <img src={resultUrl} alt="Generated depth map" className="depth-compare-img" />
                </div>
              </div>

              <ColourLegend colourMap={colourMap} />

              <div className="depth-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownload}
                  aria-label={
                    inputFile
                      ? `Download depth map as ${outputFilename(inputFile.name)}`
                      : "Download depth map as PNG"
                  }
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {inputFile ? `Download ${outputFilename(inputFile.name)}` : "Download PNG"}
                </button>
                {depthCache && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleDownloadRaw}
                    title="Download 16-bit greyscale PNG for use in 3D software, compositing, etc."
                  >
                    Raw 16-bit
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Try another image
                </button>
              </div>

              {inputFile && (
                <p className="depth-file-meta mono-label">
                  {inputFile.name} · {formatBytes(inputFile.size)}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="depth-error-wrap" role="alert" aria-live="assertive">
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
              <p className="depth-error-msg">{errorMsg}</p>
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Upload a new image when done / errored */}
        {(phase === "done" || phase === "error") && (
          <div className="card">
            <DropZone onFile={handleFile} disabled={busy} />
          </div>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. Your files never leave your device." />
    </div>
  );
}
