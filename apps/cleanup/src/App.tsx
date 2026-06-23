import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  canvasToImageCoords,
  clamp,
  formatBytes,
  isSupportedImage,
  maskPixelCount,
  paintMaskCircle,
} from "./lib/imageHelpers";
import { eraseRegion } from "./lib/inpaint";
import { useCleanupStore } from "./store/cleanupStore";
import "./styles/cleanup.css";

// ── Brand mark glyph ─────────────────────────────────────────────────────────
// Eraser concept: photo frame + brush stroke + sparkle.

function CleanupBrandGlyph() {
  return (
    <>
      {/* Photo frame */}
      <rect
        x="3"
        y="4"
        width="22"
        height="22"
        rx="2.5"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Object being erased: soft amber blob */}
      <ellipse cx="14" cy="15" rx="5" ry="4" fill="#e8b04b" opacity="0.5" />
      {/* Brush stroke sweeping over it in coral */}
      <path
        d="M8 19 Q14 12 22 8"
        stroke="#d9594c"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Eraser tip dot */}
      <circle cx="22" cy="8" r="2" fill="#d9594c" />
      {/* Sparkle: object vanishing */}
      <circle cx="14" cy="15" r="1.5" fill="#2f9d8d" />
    </>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled: boolean;
}

function DropZone({ onFile, disabled }: DropZoneProps) {
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
      className={`cl-dropzone${dragging ? " cl-dropzone--drag" : ""}${disabled ? " cl-dropzone--disabled" : ""}`}
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
      <span className="cl-dropzone-label">Drop an image here, or click to upload</span>
      <span className="cl-dropzone-hint">PNG, JPG, WebP · brush to mark objects to erase</span>
    </button>
  );
}

// ── Before/After compare slider ───────────────────────────────────────────────

interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
}

function CompareSlider({ beforeUrl, afterUrl }: CompareSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const computePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPosition(clamp(raw, 2, 98));
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    computePosition(e.clientX);
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) computePosition(e.clientX);
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
  }, [computePosition]);

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    computePosition(e.touches[0].clientX);
  };

  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      if (dragging.current) {
        computePosition(e.touches[0].clientX);
        e.preventDefault();
      }
    };
    const onEnd = () => {
      dragging.current = false;
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [computePosition]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPosition((p) => clamp(p - 2, 2, 98));
    else if (e.key === "ArrowRight") setPosition((p) => clamp(p + 2, 2, 98));
  };

  return (
    <div
      ref={containerRef}
      className="cl-compare-slider"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="slider"
      aria-label="Drag to compare before and after"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <img src={beforeUrl} alt="" className="cl-cs-sizer" aria-hidden="true" draggable={false} />
      <div className="cl-cs-before">
        <img src={beforeUrl} alt="Original" className="cl-cs-img" draggable={false} />
        <span className="cl-cs-label cl-cs-label--left mono-label">Before</span>
      </div>
      <div className="cl-cs-after" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={afterUrl} alt="Erased result" className="cl-cs-img" draggable={false} />
        <span className="cl-cs-label cl-cs-label--right mono-label">After</span>
      </div>
      <div className="cl-cs-divider" style={{ left: `${position}%` }}>
        <div className="cl-cs-handle" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle
              cx="9"
              cy="9"
              r="8"
              fill="var(--surface)"
              stroke="var(--rule)"
              strokeWidth="1.5"
            />
            <polyline
              points="6,6 3,9 6,12"
              stroke="var(--ink-mid)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <polyline
              points="12,6 15,9 12,12"
              stroke="var(--ink-mid)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Canvas brush editor ───────────────────────────────────────────────────────
// Displays the image on a canvas; the user brushes a red mask overlay over it.
// The mask is a separate canvas element stacked on top (pointer-events: none)
// so the brush strokes show as translucent red. The raw mask data is maintained
// in a Uint8Array at original image resolution.

interface BrushEditorProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  brushRadius: number;
  onMaskChange: (mask: Uint8Array, count: number) => void;
  onErase: () => void;
  disabled: boolean;
}

function BrushEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  brushRadius,
  onMaskChange,
  onErase,
  disabled,
}: BrushEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<Uint8Array>(new Uint8Array(imageWidth * imageHeight));
  const isDrawing = useRef(false);
  const [maskCount, setMaskCount] = useState(0);
  // Track cursor position for brush preview
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Draw image to canvas once
  useEffect(() => {
    const canvas = imgCanvasRef.current;
    if (!canvas) return;
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
    };
    img.src = imageUrl;
  }, [imageUrl, imageWidth, imageHeight]);

  // Sync mask canvas dimensions
  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    canvas.width = imageWidth;
    canvas.height = imageHeight;
  }, [imageWidth, imageHeight]);

  // Reset mask when image URL or dimensions change.
  // imageUrl is intentionally listed so mask resets when user loads a new image
  // even if it happens to have the same pixel dimensions.
  // biome-ignore lint/correctness/useExhaustiveDependencies: imageUrl drives reset intent
  useEffect(() => {
    maskRef.current = new Uint8Array(imageWidth * imageHeight);
    setMaskCount(0);
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, imageWidth, imageHeight);
  }, [imageUrl, imageWidth, imageHeight]);

  // Paint to the mask at image-space coords (cx, cy)
  const paintAt = useCallback(
    (cx: number, cy: number) => {
      const mask = maskRef.current;
      paintMaskCircle(mask, cx, cy, brushRadius, imageWidth, imageHeight);

      // Render the stroke onto the mask canvas
      const canvas = maskCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "rgba(217, 89, 76, 0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, brushRadius, 0, Math.PI * 2);
      ctx.fill();

      const count = maskPixelCount(mask);
      setMaskCount(count);
      onMaskChange(mask, count);
    },
    [brushRadius, imageWidth, imageHeight, onMaskChange]
  );

  // Convert a PointerEvent to image-space coords
  const eventToImageCoords = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const canvas = imgCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      return canvasToImageCoords(cx, cy, rect.width, rect.height, imageWidth, imageHeight);
    },
    [imageWidth, imageHeight]
  );

  // Convert a PointerEvent to canvas-relative coords (for brush preview)
  const eventToCanvasCoords = useCallback((e: PointerEvent | React.PointerEvent) => {
    const canvas = imgCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      isDrawing.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const coords = eventToImageCoords(e);
      if (coords) paintAt(coords.x, coords.y);
    },
    [disabled, eventToImageCoords, paintAt]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ccoords = eventToCanvasCoords(e);
      if (ccoords) setCursorPos(ccoords);

      if (!isDrawing.current || disabled) return;
      const coords = eventToImageCoords(e);
      if (coords) paintAt(coords.x, coords.y);
    },
    [disabled, eventToImageCoords, eventToCanvasCoords, paintAt]
  );

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const handlePointerLeave = useCallback(() => {
    isDrawing.current = false;
    setCursorPos(null);
  }, []);

  const handleClearMask = useCallback(() => {
    maskRef.current = new Uint8Array(imageWidth * imageHeight);
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, imageWidth, imageHeight);
    }
    setMaskCount(0);
    onMaskChange(maskRef.current, 0);
  }, [imageWidth, imageHeight, onMaskChange]);

  // Compute brush preview circle in CSS pixels on the displayed canvas
  const brushPreviewStyle = (): React.CSSProperties | null => {
    if (!cursorPos || disabled) return null;
    const canvas = imgCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Scale brush radius from image space to display space
    const scaleX = rect.width / imageWidth;
    const displayRadius = brushRadius * scaleX;
    return {
      position: "absolute",
      left: cursorPos.x - displayRadius,
      top: cursorPos.y - displayRadius,
      width: displayRadius * 2,
      height: displayRadius * 2,
      borderRadius: "50%",
      border: "1.5px solid rgba(217, 89, 76, 0.9)",
      background: "rgba(217, 89, 76, 0.15)",
      pointerEvents: "none",
      zIndex: 10,
      boxSizing: "border-box" as const,
    };
  };

  const previewStyle = brushPreviewStyle();

  return (
    <div className="cl-editor">
      <div
        ref={wrapRef}
        className={`cl-canvas-wrap${!disabled ? " cl-canvas-wrap--brushing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label="Brush canvas - paint over objects to erase them"
      >
        {/* Base image canvas */}
        <canvas
          ref={imgCanvasRef}
          style={{ display: "block", width: "100%", height: "auto", maxHeight: 540 }}
        />
        {/* Red mask overlay (drawn into with inpaint mask) */}
        <canvas
          ref={maskCanvasRef}
          className="cl-mask-overlay"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {/* Brush cursor preview circle */}
        {previewStyle && <div style={previewStyle} aria-hidden="true" />}
      </div>

      <p className="cl-mask-hint">
        <strong>Paint</strong> over the object to erase, then click <strong>Erase</strong>. Works
        best on simple backgrounds (sky, walls, grass) and small objects - busy or textured areas
        may smear.
      </p>

      <div className="cl-controls">
        <span className="cl-brush-label">Brush size</span>
        <input
          type="range"
          className="cl-brush-slider"
          min={4}
          max={80}
          step={2}
          value={brushRadius}
          onChange={(e) => {
            const wrap = wrapRef.current;
            wrap?.dispatchEvent(
              new CustomEvent("brushRadiusChange", { detail: Number(e.target.value) })
            );
          }}
          aria-label="Brush radius"
          disabled={disabled}
        />
        <span className="cl-brush-size-val">{brushRadius}px</span>

        <span className="cl-controls-sep" aria-hidden="true" />

        <div className="cl-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onErase}
            disabled={disabled || maskCount === 0}
            aria-label="Erase selected region"
          >
            Erase
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClearMask}
            disabled={disabled || maskCount === 0}
            aria-label="Clear mask"
          >
            Clear mask
          </button>
        </div>

        {maskCount > 0 && (
          <span className="cl-mask-count mono-label">{maskCount.toLocaleString()} px masked</span>
        )}
      </div>
    </div>
  );
}

// ── Brush radius hoisted to App (shared between slider + editor) ──────────────

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    inputFile,
    inputUrl,
    resultUrl,
    errorMsg,
    setInputFile,
    setPhase,
    setResult,
    setError,
    reset,
  } = useCleanupStore();

  const [brushRadius, setBrushRadius] = useState(20);
  const [maskState, setMaskState] = useState<{ mask: Uint8Array; count: number } | null>(null);
  // Natural image dimensions (needed for eraseRegion)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [copyLabel, setCopyLabel] = useState<"Copy PNG" | "Copied!" | "Copy not supported, use Download">("Copy PNG");

  const busy = phase === "erasing";

  // Load natural image dimensions when inputUrl changes
  useEffect(() => {
    if (!inputUrl) {
      setImgDims(null);
      return;
    }
    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = inputUrl;
  }, [inputUrl]);

  // Listen for brush radius changes from the slider event (avoids prop-drilling back up)
  const editorWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = editorWrapRef.current;
    if (!wrap) return;
    const handler = (e: Event) => {
      const radius = (e as CustomEvent<number>).detail;
      if (typeof radius === "number") setBrushRadius(radius);
    };
    wrap.addEventListener("brushRadiusChange", handler);
    return () => wrap.removeEventListener("brushRadiusChange", handler);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedImage(file)) {
        setError(`Unsupported file type "${file.type}". Please upload a PNG, JPG, WebP or GIF.`);
        return;
      }
      const url = URL.createObjectURL(file);
      setInputFile(file, url);
      setPhase("loaded");
      setMaskState(null);
    },
    [setInputFile, setPhase, setError]
  );

  const handleMaskChange = useCallback((mask: Uint8Array, count: number) => {
    setMaskState({ mask, count });
  }, []);

  const handleErase = useCallback(async () => {
    if (!inputUrl || !imgDims || !maskState || maskState.count === 0) return;
    setPhase("erasing");

    try {
      // Fetch the input image into an ImageData at full resolution
      const resp = await fetch(inputUrl);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);

      const { w, h } = imgDims;
      const offscreen = new OffscreenCanvas(w, h);
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("OffscreenCanvas 2d not available");
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();

      const srcData = ctx.getImageData(0, 0, w, h);

      // Run classical inpainting (may take 100-500ms for large images)
      const outData = eraseRegion(srcData, maskState.mask);
      ctx.putImageData(outData, 0, 0);

      const outBlob = await offscreen.convertToBlob({ type: "image/png" });
      const outUrl = URL.createObjectURL(outBlob);
      setResult(outUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error during inpainting.";
      setError(msg);
    }
  }, [inputUrl, imgDims, maskState, setPhase, setResult, setError]);

  const handleDownload = useCallback(() => {
    if (!resultUrl || !inputFile) return;
    const base = inputFile.name.replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${base}-cleanup.png`;
    a.click();
  }, [resultUrl, inputFile]);

  const handleCopyPng = useCallback(async () => {
    if (!resultUrl) return;
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy PNG"), 2000);
    } catch {
      setCopyLabel("Copy not supported, use Download");
      setTimeout(() => setCopyLabel("Copy PNG"), 3000);
    }
  }, [resultUrl]);

  const handleReset = useCallback(() => {
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    reset();
    setMaskState(null);
    setImgDims(null);
    setCopyLabel("Copy PNG");
  }, [inputUrl, resultUrl, reset]);

  const handleEraseAgain = useCallback(() => {
    // Return to the brush editor with the result as the new base image
    if (!resultUrl) return;
    const oldInput = inputUrl;
    const oldResult = resultUrl;
    // The store still has resultUrl; swap input to the result so user can erase more
    useCleanupStore.setState({
      inputUrl: oldResult,
      resultUrl: null,
      phase: "loaded",
    });
    if (oldInput) URL.revokeObjectURL(oldInput);
    setMaskState(null);
  }, [inputUrl, resultUrl]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [inputUrl, resultUrl]);

  return (
    <div className="app-root">
      <Header
        title="Cleanup"
        subtitle="erase objects from photos, on-device, no upload"
        brandMark={
          <BrandMark label="Cleanup">
            <CleanupBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <p className="cl-beta-note">
          <strong>On-device</strong> - classical inpainting runs entirely in your browser. Images
          never leave your device. Works best on simple backgrounds and small objects.
        </p>

        <div className="card">
          {/* Upload */}
          {phase === "idle" && <DropZone onFile={handleFile} disabled={false} />}

          {/* Brush editor */}
          {(phase === "loaded" || phase === "brushing") && inputUrl && imgDims && (
            <div ref={editorWrapRef}>
              <BrushEditor
                imageUrl={inputUrl}
                imageWidth={imgDims.w}
                imageHeight={imgDims.h}
                brushRadius={brushRadius}
                onMaskChange={handleMaskChange}
                onErase={handleErase}
                disabled={busy}
              />
            </div>
          )}

          {/* Erasing in progress */}
          {phase === "erasing" && (
            <div className="cl-status-wrap">
              <div className="cl-spinner" aria-hidden="true" />
              <span className="cl-status-label">Erasing...</span>
              <p className="cl-status-sub">
                Running inpainting in your browser. Large images may take a few seconds.
              </p>
            </div>
          )}

          {/* Result */}
          {phase === "done" && resultUrl && inputUrl && (
            <div className="cl-result-wrap">
              <CompareSlider beforeUrl={inputUrl} afterUrl={resultUrl} />

              <div className="cl-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownload}
                  aria-label="Download result as PNG"
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  className={`btn-primary${copyLabel === "Copied!" ? " btn-primary--flash" : ""}`}
                  onClick={handleCopyPng}
                  aria-label="Copy result to clipboard"
                >
                  {copyLabel}
                </button>
                <button type="button" className="btn-secondary" onClick={handleEraseAgain}>
                  Erase more
                </button>
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  New image
                </button>
              </div>

              {inputFile && (
                <p className="cl-file-meta mono-label">
                  {inputFile.name} · {formatBytes(inputFile.size)}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="cl-error-wrap">
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
              <p className="cl-error-msg">{errorMsg}</p>
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* New image slot when done/errored */}
        {(phase === "done" || phase === "error") && (
          <div className="card">
            <DropZone onFile={handleFile} disabled={busy} />
          </div>
        )}
      </main>

      <Footer blurb="Classical inpainting, fully client-side. No data leaves your device." />
    </div>
  );
}
