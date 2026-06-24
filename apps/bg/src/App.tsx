import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { revokeResult } from "./lib/bgRemoval";
import { useWorkerTask } from "./lib/workerTask";

type BgWorkerResult = { imageBytes: ArrayBuffer; width: number; height: number };
import {
  clamp,
  computeCoverFit,
  formatBytes,
  formatProgress,
  isSupportedImage,
  parseHexColor,
} from "./lib/imageHelpers";
import { useBgStore } from "./store/bgStore";
import "./styles/bg.css";
import { MobileWarning } from "./components/MobileWarning";

// ── Brand mark glyph ──────────────────────────────────────────────────────────
// A clean flat scissors/cutout mark: foreground shape in teal, shadow in amber,
// cutout lines in coral, no backing panel.

function BgBrandGlyph() {
  return (
    <>
      {/* Photo frame outline (teal) */}
      <rect
        x="3"
        y="5"
        width="22"
        height="22"
        rx="2.5"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Dashed inset suggesting removed/transparent background */}
      <rect
        x="7"
        y="9"
        width="14"
        height="14"
        rx="1.5"
        stroke="#2f9d8d"
        strokeWidth="1.6"
        strokeDasharray="3 2.5"
      />
      {/* Amber accent dot, subject retained */}
      <circle cx="14" cy="16" r="2" fill="#e8b04b" />
      {/* Coral cut line crossing the corner, the "removal" gesture */}
      <line
        x1="21"
        y1="3"
        x2="29"
        y2="11"
        stroke="#d9594c"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Small coral dot to anchor the cut */}
      <circle cx="29" cy="11" r="1.8" fill="#d9594c" />
    </>
  );
}

// ── Checkerboard background for transparency preview ─────────────────────────

function CheckerboardSVG({ size = 12 }: { size?: number }) {
  return (
    <svg
      className="bg-checker"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <pattern
          id="checker"
          x="0"
          y="0"
          width={size * 2}
          height={size * 2}
          patternUnits="userSpaceOnUse"
        >
          <rect width={size} height={size} fill="#c0c0c0" />
          <rect x={size} y={size} width={size} height={size} fill="#c0c0c0" />
          <rect x={size} width={size} height={size} fill="#e8e8e8" />
          <rect y={size} width={size} height={size} fill="#e8e8e8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#checker)" />
    </svg>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled: boolean;
  onSample?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

function DropZone({ onFile, disabled, onSample, onKeyDown }: DropZoneProps) {
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
    <div>
      <button
        type="button"
        className={`bg-dropzone${dragging ? " bg-dropzone--drag" : ""}${disabled ? " bg-dropzone--disabled" : ""}`}
        disabled={disabled}
        aria-label="Upload image, click or drag and drop"
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKeyDown}
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
        <span className="bg-dropzone-label">Drop an image here, or click to upload</span>
        <span className="bg-dropzone-hint">PNG, JPG, WebP · up to any size</span>
        <span className="bg-dropzone-hint" style={{ opacity: 0.6 }}>
          Cmd/Ctrl+Enter to open file picker
        </span>
      </button>
      {onSample && !disabled && (
        <div className="bg-sample-row">
          <span className="bg-sample-divider">or</span>
          <button type="button" className="btn-secondary" onClick={onSample}>
            Try sample image
          </button>
        </div>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  loaded: number;
  total: number;
  label: string;
  indeterminate?: boolean;
}

function ProgressBar({ loaded, total, label, indeterminate = false }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div
      className="bg-progress-wrap"
      role="progressbar"
      tabIndex={0}
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`bg-progress-track${indeterminate ? " bg-progress-track--indeterminate" : ""}`}
      >
        <div
          className="bg-progress-fill"
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
      <span className="bg-progress-label">
        {indeterminate ? label : `${label}, ${formatProgress(loaded, total)}`}
      </span>
    </div>
  );
}

// ── Background fill type ──────────────────────────────────────────────────────

export type BgFill = "transparent" | "white" | "black" | "blur" | "custom" | "gradient" | "image";

// ── Gradient fill state ───────────────────────────────────────────────────────

export interface GradientConfig {
  colorA: string;
  colorB: string;
  angle: number;
}

const GRADIENT_PRESETS: { label: string; colorA: string; colorB: string; angle: number }[] = [
  { label: "Teal dusk", colorA: "#2f9d8d", colorB: "#1a2530", angle: 135 },
  { label: "Amber sky", colorA: "#e8b04b", colorB: "#d9594c", angle: 120 },
  { label: "Mist", colorA: "#d4eef0", colorB: "#c8e0d8", angle: 180 },
  { label: "Slate", colorA: "#e9eef1", colorB: "#9aa6b0", angle: 160 },
  { label: "Midnight", colorA: "#13171a", colorB: "#283037", angle: 145 },
  { label: "Rose", colorA: "#fde8e8", colorB: "#d9594c", angle: 130 },
];

/** Produce a CSS linear-gradient string from a GradientConfig. */
function gradientCss(g: GradientConfig): string {
  return `linear-gradient(${g.angle}deg, ${g.colorA}, ${g.colorB})`;
}

/** True when the fill leaves zero transparent pixels (safe for JPG output). */
export function isOpaqueFill(fill: BgFill, bgImageFile: File | null): boolean {
  if (fill === "transparent") return false;
  if (fill === "blur") return true;
  if (fill === "white") return true;
  if (fill === "black") return true;
  if (fill === "custom") return true;
  if (fill === "gradient") return true;
  if (fill === "image") return bgImageFile !== null;
  return false;
}

// ── Background color / fill picker ───────────────────────────────────────────

interface BgPickerProps {
  value: BgFill;
  customColor: string;
  onChange: (v: BgFill) => void;
  onCustomColor: (hex: string) => void;
}

function BgPicker({ value, customColor, onChange, onCustomColor }: BgPickerProps) {
  const [hexInput, setHexInput] = useState(customColor);
  const [hexError, setHexError] = useState(false);

  // Keep local input in sync when customColor changes externally
  useEffect(() => {
    setHexInput(customColor);
    setHexError(false);
  }, [customColor]);

  const handleHexCommit = (raw: string) => {
    const parsed = parseHexColor(raw);
    if (parsed) {
      setHexError(false);
      onCustomColor(parsed);
      onChange("custom");
    } else {
      setHexError(true);
    }
  };

  const swatches: { id: BgFill; label: string; style?: React.CSSProperties }[] = [
    { id: "transparent", label: "Transparent" },
    { id: "white", label: "White" },
    { id: "black", label: "Black" },
    { id: "blur", label: "Blur original" },
    { id: "gradient", label: "Gradient" },
    { id: "image", label: "Image" },
  ];

  return (
    <div className="bg-bg-picker">
      <span className="bg-bg-picker-label">Background</span>
      <div className="bg-swatch-group" role="radiogroup" aria-label="Background fill">
        {swatches.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            aria-label={opt.label}
            title={opt.label}
            className={`bg-swatch bg-swatch--${opt.id}${value === opt.id ? " bg-swatch--active" : ""}`}
            onClick={() => onChange(opt.id)}
          />
        ))}
        {/* Custom color swatch - clicking activates custom mode */}
        <button
          type="button"
          role="radio"
          aria-checked={value === "custom"}
          aria-label="Custom color"
          title="Custom color"
          className={`bg-swatch bg-swatch--custom${value === "custom" ? " bg-swatch--active" : ""}`}
          style={{ background: parseHexColor(customColor) ?? "#888888" }}
          onClick={() => onChange("custom")}
        />
      </div>
      {/* Hex input shown when custom is selected */}
      {value === "custom" && (
        <div className="bg-hex-input-wrap">
          <span className="bg-hex-prefix">#</span>
          <input
            type="text"
            className={`bg-hex-input${hexError ? " bg-hex-input--error" : ""}`}
            value={hexInput.replace(/^#/, "")}
            maxLength={7}
            spellCheck={false}
            aria-label="Custom hex color"
            placeholder="e.g. ff5500"
            onChange={(e) => {
              setHexInput(e.target.value);
              setHexError(false);
            }}
            onBlur={(e) => handleHexCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleHexCommit((e.target as HTMLInputElement).value);
            }}
          />
          {hexError && <span className="bg-hex-error">Invalid hex</span>}
        </div>
      )}
    </div>
  );
}

// ── Background replacement picker (gradient + image) ─────────────────────────

interface BgReplacePickerProps {
  bgFill: BgFill;
  gradient: GradientConfig;
  bgImageFile: File | null;
  bgImageUrl: string | null;
  onGradient: (g: GradientConfig) => void;
  onBgImage: (file: File, url: string) => void;
  onClearBgImage: () => void;
}

function BgReplacePicker({
  bgFill,
  gradient,
  bgImageFile,
  bgImageUrl,
  onGradient,
  onBgImage,
  onClearBgImage,
}: BgReplacePickerProps) {
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  const handleBgImageFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    onClearBgImage();
    const url = URL.createObjectURL(file);
    onBgImage(file, url);
  };

  if (bgFill !== "gradient" && bgFill !== "image") return null;

  return (
    <div className="bg-replace-panel">
      {bgFill === "gradient" && (
        <div className="bg-gradient-editor">
          <span className="bg-bg-picker-label">Gradient presets</span>
          <div className="bg-gradient-presets">
            {GRADIENT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="bg-gradient-swatch"
                title={p.label}
                aria-label={p.label}
                style={{ background: `linear-gradient(${p.angle}deg, ${p.colorA}, ${p.colorB})` }}
                onClick={() => onGradient({ colorA: p.colorA, colorB: p.colorB, angle: p.angle })}
              />
            ))}
          </div>
          <div className="bg-gradient-custom">
            <label className="bg-gradient-field">
              <span className="bg-bg-picker-label">From</span>
              <input
                type="color"
                className="bg-color-native"
                value={gradient.colorA}
                onChange={(e) => onGradient({ ...gradient, colorA: e.target.value })}
              />
            </label>
            <label className="bg-gradient-field">
              <span className="bg-bg-picker-label">To</span>
              <input
                type="color"
                className="bg-color-native"
                value={gradient.colorB}
                onChange={(e) => onGradient({ ...gradient, colorB: e.target.value })}
              />
            </label>
            <label className="bg-gradient-field bg-gradient-field--wide">
              <span className="bg-bg-picker-label">Angle {gradient.angle}&deg;</span>
              <input
                type="range"
                className="bg-angle-range"
                min={0}
                max={359}
                value={gradient.angle}
                onChange={(e) => onGradient({ ...gradient, angle: Number(e.target.value) })}
              />
            </label>
          </div>
          <div
            className="bg-gradient-preview"
            style={{ background: gradientCss(gradient) }}
            aria-hidden="true"
          />
        </div>
      )}

      {bgFill === "image" && (
        <div className="bg-image-editor">
          <input
            ref={bgImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => handleBgImageFile(e.target.files)}
            aria-hidden="true"
            tabIndex={-1}
          />
          {bgImageUrl ? (
            <div className="bg-image-thumb-wrap">
              <img
                src={bgImageUrl}
                alt={bgImageFile?.name ?? "Background image"}
                className="bg-image-thumb"
              />
              <div className="bg-image-thumb-meta">
                <span className="bg-bg-picker-label">{bgImageFile?.name}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onClearBgImage();
                    if (bgImageInputRef.current) bgImageInputRef.current.value = "";
                  }}
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="bg-image-upload-btn"
              onClick={() => bgImageInputRef.current?.click()}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload background image
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Draggable before/after compare slider ─────────────────────────────────────

interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  bgFill: BgFill;
  customColor: string;
  gradient: GradientConfig;
  bgImageUrl: string | null;
}

function CompareSlider({
  beforeUrl,
  afterUrl,
  bgFill,
  customColor,
  gradient,
  bgImageUrl,
}: CompareSliderProps) {
  const [position, setPosition] = useState(50); // 0-100
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const computePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPosition(clamp(raw, 2, 98));
  }, []);

  // Mouse
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

  // Touch
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

  // Keyboard: arrow keys for fine-grained control
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPosition((p) => clamp(p - 2, 2, 98));
    else if (e.key === "ArrowRight") setPosition((p) => clamp(p + 2, 2, 98));
  };

  // After panel background style
  const afterBgStyle = (): React.CSSProperties => {
    if (bgFill === "white") return { background: "#ffffff" };
    if (bgFill === "black") return { background: "#111111" };
    if (bgFill === "custom") return { background: parseHexColor(customColor) ?? "#888888" };
    if (bgFill === "gradient") return { background: gradientCss(gradient) };
    return {};
  };

  return (
    <div
      ref={containerRef}
      className="bg-compare-slider"
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
      {/* Invisible sizer: flows normally to give the container its natural height.
          The visible before/after images are absolutely layered on top. */}
      <img src={beforeUrl} alt="" className="bg-cs-sizer" aria-hidden="true" draggable={false} />

      {/* Before layer (full width, clipped on right) */}
      <div className="bg-cs-before">
        <img src={beforeUrl} alt="Original" className="bg-cs-img" draggable={false} />
        <span className="bg-cs-label bg-cs-label--left mono-label">Before</span>
      </div>

      {/* After layer (clipped to left portion) */}
      <div className="bg-cs-after" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {bgFill === "blur" ? (
          <div className="bg-cs-blur-bg">
            <img
              src={beforeUrl}
              alt=""
              className="bg-cs-blur-img"
              aria-hidden="true"
              draggable={false}
            />
          </div>
        ) : bgFill === "transparent" ? (
          <CheckerboardSVG size={10} />
        ) : bgFill === "image" && bgImageUrl ? (
          <img
            src={bgImageUrl}
            alt=""
            className="bg-cs-bg-img"
            aria-hidden="true"
            draggable={false}
          />
        ) : null}
        <div className="bg-cs-after-fill" style={afterBgStyle()} />
        <img
          src={afterUrl}
          alt="Background removed"
          className="bg-cs-img bg-cs-img--fg"
          draggable={false}
        />
        <span className="bg-cs-label bg-cs-label--right mono-label">After</span>
      </div>

      {/* Divider line + handle */}
      <div className="bg-cs-divider" style={{ left: `${position}%` }}>
        <div className="bg-cs-handle" aria-hidden="true">
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

// ── Apply background to result canvas, return a blob URL ─────────────────────
// This lets Download respect the chosen fill rather than always emitting transparent PNG.

async function applyBgToResult(
  resultUrl: string,
  originalUrl: string | null,
  bgFill: BgFill,
  customColor: string,
  gradient: GradientConfig,
  bgImageUrl: string | null,
  width: number,
  height: number,
  format: "png" | "jpg" = "png"
): Promise<string> {
  // For transparent output, return the existing URL as-is (always PNG)
  if (bgFill === "transparent") return resultUrl;

  const fgBitmap = await createImageBitmap(await (await fetch(resultUrl)).blob());

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d not available");

  if (bgFill === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  } else if (bgFill === "black") {
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, width, height);
  } else if (bgFill === "custom") {
    ctx.fillStyle = parseHexColor(customColor) ?? "#ffffff";
    ctx.fillRect(0, 0, width, height);
  } else if (bgFill === "gradient") {
    // Resolve gradient stops relative to the canvas diagonal
    const grd = ctx.createLinearGradient(...angleToPoints(gradient.angle, width, height));
    grd.addColorStop(0, gradient.colorA);
    grd.addColorStop(1, gradient.colorB);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
  } else if (bgFill === "blur" && originalUrl) {
    // Draw original, approximate blur via downscale+upscale
    const origBitmap = await createImageBitmap(await (await fetch(originalUrl)).blob());
    const blurCanvas = new OffscreenCanvas(Math.ceil(width / 8), Math.ceil(height / 8));
    const blurCtx = blurCanvas.getContext("2d");
    if (blurCtx) {
      blurCtx.drawImage(origBitmap, 0, 0, blurCanvas.width, blurCanvas.height);
      ctx.drawImage(blurCanvas, 0, 0, width, height);
    } else {
      ctx.drawImage(origBitmap, 0, 0, width, height);
    }
    origBitmap.close();
  } else if (bgFill === "image" && bgImageUrl) {
    const bgBitmap = await createImageBitmap(await (await fetch(bgImageUrl)).blob());
    const { x, y, w, h } = computeCoverFit(bgBitmap.width, bgBitmap.height, width, height);
    ctx.drawImage(bgBitmap, x, y, w, h);
    bgBitmap.close();
  }

  ctx.drawImage(fgBitmap, 0, 0, width, height);
  fgBitmap.close();

  const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
  const quality = format === "jpg" ? 0.92 : undefined;
  const blob = await canvas.convertToBlob({ type: mimeType, quality });
  return URL.createObjectURL(blob);
}

/**
 * Convert a CSS-style gradient angle (deg, 0=up, clockwise) to
 * CanvasRenderingContext2D createLinearGradient x0,y0,x1,y1 coordinates.
 */
function angleToPoints(angleDeg: number, w: number, h: number): [number, number, number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  // Length of the diagonal so the gradient always spans the full canvas
  const len = Math.sqrt(w * w + h * h) / 2;
  const x0 = cx - Math.cos(rad) * len;
  const y0 = cy - Math.sin(rad) * len;
  const x1 = cx + Math.cos(rad) * len;
  const y1 = cy + Math.sin(rad) * len;
  return [x0, y0, x1, y1];
}

// ── Tiny 1x1 transparent PNG data URL (sample image trigger) ─────────────────
// We generate a small gradient PNG in-browser so there's no extra asset to fetch.
// This is a real portrait-like placeholder: 200x260, teal gradient + amber ellipse.

function createSampleImageFile(): File {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 260;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 200, 260);
  grad.addColorStop(0, "#d4eef0");
  grad.addColorStop(1, "#c8e0d8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 200, 260);

  // A simple "person silhouette" shape: circle head + rounded torso
  ctx.fillStyle = "#2f7d8d";
  // head
  ctx.beginPath();
  ctx.arc(100, 80, 38, 0, Math.PI * 2);
  ctx.fill();
  // torso
  ctx.beginPath();
  ctx.ellipse(100, 185, 55, 65, 0, 0, Math.PI * 2);
  ctx.fill();

  // Amber accent
  ctx.fillStyle = "#e8b04b";
  ctx.beginPath();
  ctx.ellipse(130, 65, 14, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  const dataUrl = canvas.toDataURL("image/png");
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], "sample-portrait.png", { type: mime });
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    inputFile,
    inputUrl,
    resultUrl,
    errorMsg,
    modelProgress,
    resultDimensions,
    setInputFile,
    setPhase,
    setModelProgress,
    setResult,
    setError,
    reset,
  } = useBgStore();

  const [bgFill, setBgFill] = useState<BgFill>("transparent");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [gradient, setGradient] = useState<GradientConfig>(GRADIENT_PRESETS[0]);
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<"Copy PNG" | "Copied!" | "Copy not supported, use Download">("Copy PNG");

  const busy = phase === "model-loading" || phase === "processing";

  // Cmd/Ctrl+Enter opens the file picker from anywhere on the page
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (phase === "idle" || phase === "error" || phase === "done") {
          // Find the hidden file input inside the first dropzone
          const input = document.querySelector<HTMLInputElement>(".bg-dropzone input[type=file]");
          input?.click();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  const { run: runWorker, cancel: cancelWorker } = useWorkerTask<
    { file: File },
    BgWorkerResult
  >();

  const handleCancel = useCallback(() => {
    cancelWorker();
    setPhase("idle");
  }, [cancelWorker, setPhase]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedImage(file)) {
        setError(`Unsupported file type "${file.type}". Please upload a PNG, JPG, WebP or GIF.`);
        return;
      }
      const url = URL.createObjectURL(file);
      setInputFile(file, url);

      setPhase("model-loading");
      await runWorker(
        new URL("./infer.worker.ts", import.meta.url),
        { file },
        {
          onProgress: (loaded, total, status) => {
            setModelProgress(loaded, total, status);
            if (status === "done") {
              setPhase("processing");
            } else {
              setPhase("model-loading");
            }
          },
          onResult: ({ imageBytes, width, height }) => {
            const blob = new Blob([imageBytes], { type: "image/png" });
            const outUrl = URL.createObjectURL(blob);
            setResult(outUrl, width, height);
          },
          onError: (message) => {
            setError(message);
          },
        }
      );
    },
    [setInputFile, setPhase, setModelProgress, setResult, setError, runWorker]
  );

  const handleSample = useCallback(() => {
    try {
      const file = createSampleImageFile();
      handleFile(file);
    } catch {
      // canvas unavailable in some envs -- silently ignore
    }
  }, [handleFile]);

  const handleBgImage = useCallback((file: File, url: string) => {
    setBgImageFile(file);
    setBgImageUrl(url);
  }, []);

  const handleClearBgImage = useCallback(() => {
    if (bgImageUrl) URL.revokeObjectURL(bgImageUrl);
    setBgImageFile(null);
    setBgImageUrl(null);
  }, [bgImageUrl]);

  const handleDownload = useCallback(
    async (format: "png" | "jpg" = "png") => {
      if (!resultUrl || !inputFile) return;
      const { width, height } = resultDimensions;

      let downloadUrl = resultUrl;
      let didCreate = false;
      try {
        if (bgFill !== "transparent" || format === "jpg") {
          downloadUrl = await applyBgToResult(
            resultUrl,
            inputUrl,
            bgFill,
            customColor,
            gradient,
            bgImageUrl,
            width,
            height,
            format
          );
          didCreate = true;
        }
      } catch {
        // fallback: download the transparent PNG
        downloadUrl = resultUrl;
      }

      const suffix = bgFill === "transparent" ? "bg-removed" : `bg-${bgFill}`;
      const base = inputFile.name.replace(/\.[^.]+$/, "");
      const ext = format === "jpg" ? "jpg" : "png";
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${base}-${suffix}.${ext}`;
      a.click();

      if (didCreate) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000);
      }
    },
    [resultUrl, inputFile, bgFill, customColor, gradient, bgImageUrl, inputUrl, resultDimensions]
  );

  const handleCopyPng = useCallback(async () => {
    if (!resultUrl) return;
    let blobUrl = resultUrl;
    let didCreate = false;
    try {
      const { width, height } = resultDimensions;
      if (bgFill !== "transparent") {
        blobUrl = await applyBgToResult(
          resultUrl,
          inputUrl,
          bgFill,
          customColor,
          gradient,
          bgImageUrl,
          width,
          height,
          "png"
        );
        didCreate = true;
      }
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy PNG"), 2000);
    } catch {
      setCopyLabel("Copy not supported, use Download");
      setTimeout(() => setCopyLabel("Copy PNG"), 3000);
    } finally {
      if (didCreate) URL.revokeObjectURL(blobUrl);
    }
  }, [resultUrl, bgFill, customColor, gradient, bgImageUrl, inputUrl, resultDimensions]);

  const handleReset = useCallback(() => {
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    if (resultUrl) revokeResult(resultUrl);
    if (bgImageUrl) URL.revokeObjectURL(bgImageUrl);
    reset();
    setBgFill("transparent");
    setCustomColor("#ffffff");
    setGradient(GRADIENT_PRESETS[0]);
    setBgImageFile(null);
    setBgImageUrl(null);
    setCopyLabel("Copy PNG");
  }, [inputUrl, resultUrl, bgImageUrl, reset]);

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
        title="Background Remover"
        subtitle="remove image backgrounds, free, private, runs in your browser"
        brandMark={
          <BrandMark label="Background Remover">
            <BgBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <MobileWarning />
        {/* Beta notice */}
        <p className="bg-beta-note">
          <strong>Beta</strong>, first run downloads a model (~40 MB), then it is instant &amp;
          offline. Your images never leave your device.
        </p>

        <div className="card">
          {/* Upload zone (always visible unless we have a result) */}
          {phase === "idle" && (
            <DropZone onFile={handleFile} disabled={false} onSample={handleSample} />
          )}

          {/* Model loading */}
          {phase === "model-loading" && (
            <div className="bg-status-wrap">
              <ProgressBar
                loaded={modelProgress.loaded}
                total={modelProgress.total}
                label="Downloading model"
              />
              <p className="bg-status-sub">
                One-time download (~40 MB). Saved in your browser cache.
              </p>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Processing */}
          {phase === "processing" && (
            <div className="bg-status-wrap">
              <ProgressBar loaded={0} total={1} label="Removing background" indeterminate={true} />
              <p className="bg-status-sub">Processing your image...</p>
              {inputUrl && <img src={inputUrl} alt="Source" className="bg-thumb-preview" />}
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Result */}
          {phase === "done" && resultUrl && inputUrl && (
            <div className="bg-result-wrap">
              {/* Draggable before/after compare slider */}
              <CompareSlider
                beforeUrl={inputUrl}
                afterUrl={resultUrl}
                bgFill={bgFill}
                customColor={customColor}
                gradient={gradient}
                bgImageUrl={bgImageUrl}
              />

              {/* Background picker */}
              <BgPicker
                value={bgFill}
                customColor={customColor}
                onChange={setBgFill}
                onCustomColor={setCustomColor}
              />

              {/* Gradient / image replacement controls */}
              <BgReplacePicker
                bgFill={bgFill}
                gradient={gradient}
                bgImageFile={bgImageFile}
                bgImageUrl={bgImageUrl}
                onGradient={setGradient}
                onBgImage={handleBgImage}
                onClearBgImage={handleClearBgImage}
              />

              {/* Actions */}
              <div className="bg-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleDownload("png")}
                  aria-label="Download result as PNG"
                >
                  Download PNG
                </button>
                {isOpaqueFill(bgFill, bgImageFile) && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleDownload("jpg")}
                    aria-label="Download result as JPG"
                  >
                    Download JPG
                  </button>
                )}
                <button
                  type="button"
                  className={`btn-primary${copyLabel === "Copied!" ? " btn-primary--flash" : ""}`}
                  onClick={handleCopyPng}
                  aria-label="Copy result image to clipboard"
                >
                  {copyLabel}
                </button>
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Try another image
                </button>
              </div>

              {inputFile && (
                <p className="bg-file-meta mono-label">
                  {inputFile.name} · {formatBytes(inputFile.size)}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="bg-error-wrap">
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
              <p className="bg-error-msg">{errorMsg}</p>
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

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
