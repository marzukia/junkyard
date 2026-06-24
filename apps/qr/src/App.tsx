import { useCallback, useEffect, useRef, useState } from "react";
import { BatchMode } from "./components/BatchMode";
import { BrandMark } from "./components/BrandMark";
import { ContentTypeTabs } from "./components/ContentTypeTabs";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { classifyContrast, contrastRatio, suggestFgForBg } from "./lib/contrast";
import { canvasToPngUrl, generateSvgString, normaliseHex, renderQRToCanvas } from "./lib/qr";
import type { DotStyle, ErrorCorrectionLevel, EyeStyle } from "./lib/qr";
import { willExceedCapacity } from "./lib/templates";
import type { ContentType } from "./lib/templates";
import { useQRStore } from "./store/qrStore";

/** Copy PNG from canvas to clipboard and return whether it succeeded. */
async function copyCanvasPngToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      navigator.clipboard
        .write([new ClipboardItem({ "image/png": blob })])
        .then(() => resolve(true))
        .catch(() => resolve(false));
    }, "image/png");
  });
}

// ── Brand mark glyph (QR corner pattern in brand palette) ────────────────────

function QRBrandGlyph() {
  return (
    <>
      {/* Top-left finder: evenodd ring punches transparent hole, no backing panel */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.5 2A2.5 2.5 0 0 0 2 4.5v7A2.5 2.5 0 0 0 4.5 14h7A2.5 2.5 0 0 0 14 11.5v-7A2.5 2.5 0 0 0 11.5 2H4.5zm1 2.5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"
        fill="#2f9d8d"
      />
      <rect x="6.5" y="6.5" width="3" height="3" rx="0.75" fill="#2f9d8d" />
      {/* Top-right finder: amber ring */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.5 2A2.5 2.5 0 0 0 18 4.5v7A2.5 2.5 0 0 0 20.5 14h7A2.5 2.5 0 0 0 30 11.5v-7A2.5 2.5 0 0 0 27.5 2h-7zm1 2.5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"
        fill="#e8b04b"
      />
      <rect x="22.5" y="6.5" width="3" height="3" rx="0.75" fill="#e8b04b" />
      {/* Bottom-left finder: coral ring */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.5 18A2.5 2.5 0 0 0 2 20.5v7A2.5 2.5 0 0 0 4.5 30h7A2.5 2.5 0 0 0 14 27.5v-7A2.5 2.5 0 0 0 11.5 18H4.5zm1 2.5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"
        fill="#d9594c"
      />
      <rect x="6.5" y="22.5" width="3" height="3" rx="0.75" fill="#d9594c" />
      {/* Data dots bottom-right */}
      <rect x="18" y="18" width="4" height="4" rx="1" fill="#2f9d8d" />
      <rect x="24" y="18" width="4" height="4" rx="1" fill="#2f9d8d" />
      <rect x="18" y="24" width="4" height="4" rx="1" fill="#e8b04b" />
      <rect x="24" y="24" width="4" height="4" rx="1" fill="#d9594c" />
    </>
  );
}

// ── Dot style icons, use currentColor so they inherit the button's CSS color ──

function DotSquareIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={c * 9 + 1}
            y={r * 9 + 1}
            width="7"
            height="7"
            fill="currentColor"
          />
        ))
      )}
    </svg>
  );
}

function DotRoundedIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={c * 9 + 1}
            y={r * 9 + 1}
            width="7"
            height="7"
            rx="2.5"
            fill="currentColor"
          />
        ))
      )}
    </svg>
  );
}

function DotCircleIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <circle key={`${r}-${c}`} cx={c * 9 + 4.5} cy={r * 9 + 4.5} r="3.5" fill="currentColor" />
        ))
      )}
    </svg>
  );
}

function DotClassyIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Centre squares, edge circles */}
      <rect x="10" y="10" width="8" height="8" fill="currentColor" />
      <circle cx="4.5" cy="4.5" r="3.5" fill="currentColor" />
      <circle cx="23.5" cy="4.5" r="3.5" fill="currentColor" />
      <circle cx="4.5" cy="23.5" r="3.5" fill="currentColor" />
      <circle cx="23.5" cy="23.5" r="3.5" fill="currentColor" />
    </svg>
  );
}

// ── Eye style icons ───────────────────────────────────────────────────────────

function EyeSquareIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="24" height="24" fill="currentColor" />
      <rect x="5" y="5" width="18" height="18" fill="white" />
      <rect x="9" y="9" width="10" height="10" fill="currentColor" />
    </svg>
  );
}

function EyeRoundedIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="24" height="24" rx="5" fill="currentColor" />
      <rect x="5" y="5" width="18" height="18" rx="3" fill="white" />
      <rect x="9" y="9" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

function EyeCircleIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="currentColor" />
      <circle cx="14" cy="14" r="8" fill="white" />
      <circle cx="14" cy="14" r="5" fill="currentColor" />
    </svg>
  );
}

function EyeLeafIcon() {
  return (
    <svg className="qr-dot-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="24" height="24" rx="7" fill="currentColor" />
      <rect x="5" y="5" width="18" height="18" rx="4" fill="white" />
      <rect x="9" y="9" width="10" height="10" rx="3" fill="currentColor" />
    </svg>
  );
}

const DOT_STYLES: { id: DotStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
  { id: "classy", label: "Classy" },
];

const EYE_STYLES: { id: EyeStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
  { id: "leaf", label: "Leaf" },
];

const EC_LEVELS: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

// ── Colour field ──────────────────────────────────────────────────────────────

interface ColourFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
}

function ColourField({ label, value, onChange, id }: ColourFieldProps) {
  const [hex, setHex] = useState(value);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHex(value);
  }, [value]);

  const commit = useCallback(
    (raw: string) => {
      const norm = normaliseHex(raw);
      if (norm) onChange(norm);
    },
    [onChange]
  );

  return (
    <div className="qr-colour-field">
      <label className="qr-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="qr-colour-input-wrap">
        <div
          className="qr-colour-swatch"
          style={{ background: value }}
          onClick={() => pickerRef.current?.click()}
          role="button"
          aria-label={`Open ${label} colour picker`}
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && pickerRef.current?.click()}
        />
        <input
          ref={pickerRef}
          type="color"
          className="qr-colour-picker"
          value={value}
          onChange={(e) => {
            setHex(e.target.value);
            onChange(e.target.value);
          }}
          aria-label={`${label} colour picker`}
        />
        <input
          id={id}
          type="text"
          className="qr-colour-hex"
          value={hex}
          maxLength={7}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => commit(hex)}
          onKeyDown={(e) => e.key === "Enter" && commit(hex)}
          aria-label={`${label} hex value`}
        />
      </div>
    </div>
  );
}

// ── Contrast warning banner ───────────────────────────────────────────────────

interface ContrastBannerProps {
  fgColor: string;
  bgColor: string;
  onFix: () => void;
}

function ContrastBanner({ fgColor, bgColor, onFix }: ContrastBannerProps) {
  const ratio = contrastRatio(fgColor, bgColor);
  if (ratio === null) return null;
  const level = classifyContrast(ratio);
  if (level === "good") return null;

  const isFail = level === "fail";
  return (
    <div className={`qr-contrast-banner qr-contrast-banner--${level}`} role="alert">
      <span>
        {isFail
          ? `Low contrast (${ratio.toFixed(1)}:1) — scanners may fail. `
          : `Contrast ${ratio.toFixed(1)}:1 may be marginal for some scanners. `}
      </span>
      <button type="button" className="qr-contrast-fix-btn" onClick={onFix}>
        Fix contrast
      </button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

type AppMode = "single" | "batch";

export function App() {
  const {
    text,
    fgColor,
    bgColor,
    errorCorrectionLevel,
    dotStyle,
    eyeStyle,
    logoDataUrl,
    logoFileName,
    setText,
    setFgColor,
    setBgColor,
    setErrorCorrectionLevel,
    setDotStyle,
    setEyeStyle,
    setLogo,
    clearLogo,
  } = useQRStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Top-level mode: single QR vs batch
  const [appMode, setAppMode] = useState<AppMode>("single");

  // Content-type tab state (not persisted - session only)
  const [activeType, setActiveType] = useState<ContentType>("url");

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !text.trim()) return;
    setRendering(true);
    setError(null);
    try {
      await renderQRToCanvas(canvas, {
        text: text.trim(),
        fgColor,
        bgColor,
        errorCorrectionLevel,
        dotStyle,
        eyeStyle,
        logoDataUrl: logoDataUrl ?? undefined,
      });
    } catch {
      // Detect capacity overflow specifically so the user knows how to fix it
      if (willExceedCapacity(text.trim(), errorCorrectionLevel)) {
        setError(
          `Content is too long for a QR code at this error correction level (${errorCorrectionLevel}). Try shortening the text, using a URL shortener, or switching to error correction L.`
        );
      } else {
        setError("Could not generate QR code. Check your input.");
      }
    } finally {
      setRendering(false);
    }
  }, [text, fgColor, bgColor, errorCorrectionLevel, dotStyle, eyeStyle, logoDataUrl]);

  useEffect(() => {
    void render();
  }, [render]);

  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvasToPngUrl(canvas);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.png";
    a.click();
  }, []);

  const downloadSvg = useCallback(async () => {
    if (!text.trim()) return;
    try {
      const svg = generateSvgString({
        text: text.trim(),
        fgColor,
        bgColor,
        errorCorrectionLevel,
        dotStyle,
        eyeStyle,
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-code.svg";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError("SVG export failed.");
    }
  }, [text, fgColor, bgColor, errorCorrectionLevel, dotStyle, eyeStyle]);

  const copyImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ok = await copyCanvasPngToClipboard(canvas);
    if (ok) {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setError("Clipboard write not supported in this browser.");
    }
  }, []);

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Logo must be an image file.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setLogo(result, file.name);
        }
      };
      reader.onerror = () => setError("Couldn't read that logo file.");
      reader.readAsDataURL(file);
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [setLogo, setError]
  );

  // Fix contrast: set fg to best contrast for current bg
  const handleFixContrast = useCallback(() => {
    const suggested = suggestFgForBg(bgColor);
    setFgColor(suggested);
  }, [bgColor, setFgColor]);

  // Handle switching content-type tabs: clear text to empty the preview
  // (template forms will immediately emit their own payload via onPayload)
  const handleTypeChange = useCallback(
    (type: ContentType) => {
      setActiveType(type);
      if (type === "url") {
        // Restore URL tab to whatever is in store (persisted url or default)
        // Don't overwrite; let rawText display the current store value
      } else {
        setText("");
      }
    },
    [setText]
  );

  const hasText = text.trim().length > 0;

  return (
    <div className="app-root">
      <Header
        title="QR Code"
        subtitle="free qr codes with logo, colours &amp; styles"
        brandMark={
          <BrandMark label="QR Code Generator">
            <QRBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* Mode toggle: Single vs Batch */}
        <div className="qr-mode-toggle-wrap">
          <div className="space-toggle" role="tablist" aria-label="QR generation mode">
            <button
              type="button"
              role="tab"
              aria-selected={appMode === "single"}
              className={`space-btn${appMode === "single" ? " space-btn--active" : ""}`}
              onClick={() => setAppMode("single")}
            >
              Single QR
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={appMode === "batch"}
              className={`space-btn${appMode === "batch" ? " space-btn--active" : ""}`}
              onClick={() => setAppMode("batch")}
            >
              Batch
            </button>
          </div>
        </div>

        <div className="card">
          {appMode === "single" ? (
            <div className="qr-layout">
              {/* Preview column */}
              <div className="qr-preview-wrap">
                <div className="qr-canvas-frame" style={{ background: bgColor }}>
                  {hasText ? (
                    <canvas ref={canvasRef} width={512} height={512} aria-label="QR code preview" />
                  ) : (
                    <div
                      className="qr-empty-state"
                      ref={canvasRef as unknown as React.RefObject<HTMLDivElement>}
                    >
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 32 32"
                        fill="none"
                        aria-hidden="true"
                      >
                        <QRBrandGlyph />
                      </svg>
                      <span>Fill in the fields to generate a QR code</span>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="qr-error-msg" role="alert">
                    {error}
                  </p>
                )}

                {hasText && !rendering && !error && (
                  <div className="qr-download-row">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={downloadPng}
                      aria-label="Download QR code as PNG"
                    >
                      Download PNG
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void downloadSvg()}
                      aria-label="Download QR code as SVG"
                    >
                      Download SVG
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary qr-copy-btn${copied ? " qr-copy-btn--copied" : ""}`}
                      onClick={() => void copyImage()}
                      aria-label="Copy QR code image to clipboard"
                    >
                      {copied ? "Copied!" : "Copy image"}
                    </button>
                  </div>
                )}
              </div>

              {/* Controls column */}
              <div className="qr-controls">
                {/* Content type tabs + input */}
                <ContentTypeTabs
                  activeType={activeType}
                  onTypeChange={handleTypeChange}
                  onPayload={setText}
                  rawText={text}
                />

                {/* Contrast warning */}
                <ContrastBanner fgColor={fgColor} bgColor={bgColor} onFix={handleFixContrast} />

                {/* Colours */}
                <div className="qr-field-group">
                  <span className="qr-field-label">Colours</span>
                  <div className="qr-colour-row">
                    <ColourField
                      label="Foreground"
                      value={fgColor}
                      onChange={setFgColor}
                      id="qr-fg"
                    />
                    <ColourField
                      label="Background"
                      value={bgColor}
                      onChange={setBgColor}
                      id="qr-bg"
                    />
                  </div>
                </div>

                {/* Dot style */}
                <div className="qr-field-group">
                  <span className="qr-field-label">Dot style</span>
                  <div className="qr-dot-grid" role="group" aria-label="Dot style">
                    {DOT_STYLES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        className={`qr-dot-btn${dotStyle === id ? " qr-dot-btn--active" : ""}`}
                        onClick={() => setDotStyle(id)}
                        aria-pressed={dotStyle === id}
                        aria-label={`${label} dot style`}
                      >
                        {id === "square" && <DotSquareIcon />}
                        {id === "rounded" && <DotRoundedIcon />}
                        {id === "dots" && <DotCircleIcon />}
                        {id === "classy" && <DotClassyIcon />}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Eye style */}
                <div className="qr-field-group">
                  <span className="qr-field-label">Eye style</span>
                  <div className="qr-dot-grid" role="group" aria-label="Eye style">
                    {EYE_STYLES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        className={`qr-dot-btn${eyeStyle === id ? " qr-dot-btn--active" : ""}`}
                        onClick={() => setEyeStyle(id)}
                        aria-pressed={eyeStyle === id}
                        aria-label={`${label} eye style`}
                      >
                        {id === "square" && <EyeSquareIcon />}
                        {id === "rounded" && <EyeRoundedIcon />}
                        {id === "circle" && <EyeCircleIcon />}
                        {id === "leaf" && <EyeLeafIcon />}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error correction */}
                <div className="qr-field-group">
                  <span className="qr-field-label">Error correction</span>
                  <div className="qr-ec-row" role="group" aria-label="Error correction level">
                    {EC_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={`qr-ec-btn${errorCorrectionLevel === level ? " qr-ec-btn--active" : ""}`}
                        onClick={() => setErrorCorrectionLevel(level)}
                        aria-pressed={errorCorrectionLevel === level}
                        title={
                          level === "L"
                            ? "Low, 7% recovery"
                            : level === "M"
                              ? "Medium, 15% recovery"
                              : level === "Q"
                                ? "Quartile, 25% recovery"
                                : "High, 30% recovery (best for logos)"
                        }
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6rem",
                      color: "var(--ink-faint)",
                    }}
                  >
                    Use H when adding a logo
                  </span>
                </div>

                {/* Logo upload */}
                <div className="qr-field-group">
                  <span className="qr-field-label">Logo overlay</span>
                  <div className="qr-logo-upload">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      style={{ display: "none" }}
                      aria-label="Upload logo image"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoDataUrl ? "Replace logo" : "Upload logo"}
                    </button>
                    {logoDataUrl && (
                      <>
                        <img src={logoDataUrl} alt="Logo preview" className="qr-logo-thumb" />
                        {logoFileName && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.65rem",
                              color: "var(--ink-mid)",
                            }}
                          >
                            {logoFileName}
                          </span>
                        )}
                        <button type="button" className="qr-logo-clear" onClick={clearLogo}>
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="batch-layout">
              <div className="batch-settings-note">
                <span className="qr-field-label">
                  Style settings from Single QR apply (colours, dot style, eye style, error
                  correction)
                </span>
              </div>
              <BatchMode
                fgColor={fgColor}
                bgColor={bgColor}
                errorCorrectionLevel={errorCorrectionLevel}
                dotStyle={dotStyle}
                eyeStyle={eyeStyle}
              />
            </div>
          )}
        </div>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            color: "var(--ink-faint)",
            textAlign: "center",
          }}
        >
          Runs entirely in your browser, no data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
