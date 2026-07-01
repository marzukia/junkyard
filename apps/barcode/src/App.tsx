import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import JsBarcode from "jsbarcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { BatchTab } from "./components/BatchTab";
import { QrTab } from "./components/QrTab";
import { FORMAT_META, FORMAT_ORDER, ean8Autofix, ean13Autofix, upcaAutofix } from "./lib/barcode";
import type { BarcodeFormat } from "./lib/barcode";
import { useBarcodeStore } from "./store/barcodeStore";
import "./styles/barcode.css";
import { useCmdEnter } from "@junkyardsh/kit";

// ── Mode switcher ─────────────────────────────────────────────────────────

type AppMode = "barcode" | "qr" | "batch";

const MODE_LABELS: Record<AppMode, string> = {
  barcode: "Barcode",
  qr: "QR Code",
  batch: "Batch",
};

function ModeSelector({
  value,
  onChange,
}: {
  value: AppMode;
  onChange: (m: AppMode) => void;
}) {
  return (
    <div className="space-toggle-wrapper">
      <span className="space-toggle-label">Mode</span>
      <div className="space-toggle" role="group" aria-label="Tool mode">
        {(["barcode", "qr", "batch"] as AppMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`space-btn${value === m ? " space-btn--active" : ""}`}
            onClick={() => onChange(m)}
            aria-pressed={value === m}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Copy PNG to clipboard ──────────────────────────────────────────────────

async function copyPngToClipboard(svgEl: SVGSVGElement): Promise<void> {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svgEl.viewBox.baseVal.width || svgEl.clientWidth;
      canvas.height = svgEl.viewBox.baseVal.height || svgEl.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("No canvas context"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob failed"));
          return;
        }
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(resolve, reject);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

// ── Brand glyph: barcode-inspired vertical bars ───────────────────────────

function BarcodeBrandGlyph() {
  return (
    <>
      {/* Quiet zone guides, amber */}
      <line x1="2" y1="5" x2="2" y2="27" stroke="#e8b04b" strokeWidth="1" strokeLinecap="round" />
      <line x1="30" y1="5" x2="30" y2="27" stroke="#e8b04b" strokeWidth="1" strokeLinecap="round" />
      {/* Barcode bars, teal */}
      <line
        x1="4.5"
        y1="5"
        x2="4.5"
        y2="27"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1="7" y1="5" x2="7" y2="27" stroke="#2f9d8d" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="5" x2="10" y2="27" stroke="#2f9d8d" strokeWidth="1" strokeLinecap="round" />
      <line
        x1="12"
        y1="5"
        x2="12"
        y2="27"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Center guard, coral */}
      <line x1="16" y1="4" x2="16" y2="28" stroke="#d9594c" strokeWidth="2" strokeLinecap="round" />
      {/* Right bars, teal */}
      <line
        x1="19.5"
        y1="5"
        x2="19.5"
        y2="27"
        stroke="#2f9d8d"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="21.5"
        y1="5"
        x2="21.5"
        y2="27"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="24.5"
        y1="5"
        x2="24.5"
        y2="27"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1="27" y1="5" x2="27" y2="27" stroke="#2f9d8d" strokeWidth="1" strokeLinecap="round" />
    </>
  );
}

// ── Format selector ───────────────────────────────────────────────────────

function FormatSelector({
  value,
  onChange,
}: {
  value: BarcodeFormat;
  onChange: (f: BarcodeFormat) => void;
}) {
  return (
    <div className="space-toggle-wrapper">
      <span className="space-toggle-label">Format</span>
      <div className="space-toggle" role="group" aria-label="Barcode format">
        {FORMAT_ORDER.map((fmt) => (
          <button
            key={fmt}
            type="button"
            className={`space-btn${value === fmt ? " space-btn--active" : ""}`}
            onClick={() => onChange(fmt)}
            aria-pressed={value === fmt}
          >
            {FORMAT_META[fmt].label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Slider control ────────────────────────────────────────────────────────

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bc-slider-row">
      <label className="bc-slider-label">
        <div className="bc-slider-header">
          <span className="mono-label">{label}</span>
          <span className="bc-slider-value">
            {value}
            {unit}
          </span>
        </div>
        <input
          type="range"
          className="bc-range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${label} ${value}${unit}`}
        />
      </label>
    </div>
  );
}

// ── Download helpers ──────────────────────────────────────────────────────

function downloadSvg(svgEl: SVGSVGElement, filename: string) {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function downloadPng(svgEl: SVGSVGElement, filename: string) {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = svgEl.viewBox.baseVal.width || svgEl.clientWidth;
    canvas.height = svgEl.viewBox.baseVal.height || svgEl.clientHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = filename;
    a.click();
  };
  img.src = url;
}

// ── Barcode tab ───────────────────────────────────────────────────────────

function BarcodeTab() {
  const {
    format,
    input,
    width,
    height,
    margin,
    displayValue,
    setInput,
    setWidth,
    setHeight,
    setMargin,
    setDisplayValue,
  } = useBarcodeStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [hasBarcode, setHasBarcode] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  // Auto-fix: if user enters 12/11/7 digits for EAN-13/UPC-A/EAN-8, append check digit
  const autofix = computeAutofix(format, input);

  const meta = FORMAT_META[format];
  const effectiveInput = autofix.autofixed ? autofix.value : input;
  const canRender = effectiveInput.trim().length > 0 && autofix.validationError === null;

  // Re-render barcode whenever relevant state changes
  useEffect(() => {
    if (!svgRef.current) return;
    if (!canRender) {
      while (svgRef.current.firstChild) svgRef.current.removeChild(svgRef.current.firstChild);
      svgRef.current.removeAttribute("viewBox");
      setHasBarcode(false);
      setRenderError(null);
      return;
    }

    try {
      JsBarcode(svgRef.current, effectiveInput, {
        format,
        width: Math.max(1, Math.round(width / 80)),
        height,
        margin,
        displayValue,
        lineColor: "#1a2530",
        background: "#ffffff",
        fontOptions: "500",
        font: "Roboto, system-ui, sans-serif",
        fontSize: 14,
        textMargin: 6,
      });
      setHasBarcode(true);
      setRenderError(null);
    } catch (e) {
      setHasBarcode(false);
      setRenderError(e instanceof Error ? e.message : "Could not generate barcode.");
    }
  }, [format, effectiveInput, width, height, margin, displayValue, canRender]);

  const handleDownloadPng = useCallback(() => {
    if (!svgRef.current || !hasBarcode) return;
    downloadPng(svgRef.current, `barcode-${format.toLowerCase()}.png`);
  }, [hasBarcode, format]);

  const handleDownloadSvg = useCallback(() => {
    if (!svgRef.current || !hasBarcode) return;
    downloadSvg(svgRef.current, `barcode-${format.toLowerCase()}.svg`);
  }, [hasBarcode, format]);

  const handleCopyPng = useCallback(() => {
    if (!svgRef.current || !hasBarcode) return;
    copyPngToClipboard(svgRef.current).then(
      () => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 2000);
      },
      () => {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 2500);
      }
    );
  }, [hasBarcode]);

  // Cmd/Ctrl+Enter: copy PNG (primary action when barcode is ready)
  useCmdEnter(() => {
    if (hasBarcode && svgRef.current) {
      copyPngToClipboard(svgRef.current).then(
        () => {
          setCopyState("copied");
          setTimeout(() => setCopyState("idle"), 2000);
        },
        () => {
          setCopyState("error");
          setTimeout(() => setCopyState("idle"), 2500);
        }
      );
    }
  });

  return (
    <div className="bc-layout">
      {/* ── Input + options panel ── */}
      <div className="card bc-controls-card">
        <div className="bc-section">
          <label className="bc-input-label" htmlFor="bc-input">
            <span className="mono-label">Input</span>
            <span className="bc-format-hint">{meta.description}</span>
          </label>
          <input
            id="bc-input"
            type="text"
            className={`bc-input${autofix.validationError ? " bc-input--error" : ""}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={meta.placeholder}
            aria-label="Barcode input text"
            aria-describedby={autofix.validationError ? "bc-input-error" : undefined}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
          {autofix.autofixed && (
            <p className="bc-autofix-hint" aria-live="polite">
              Check digit added: {input} + {autofix.value.slice(-1)} = {autofix.value}
            </p>
          )}
          {autofix.validationError && (
            <p id="bc-input-error" className="bc-error" role="alert" aria-live="polite">
              <span className="bc-error-icon">!</span>
              {autofix.validationError}
            </p>
          )}
        </div>

        <div className="bc-section">
          <span className="mono-label">Size</span>
          <div className="bc-sliders">
            <SliderControl
              label="Width"
              value={width}
              min={FORMAT_META[format].minWidth}
              max={600}
              step={10}
              unit="px"
              onChange={setWidth}
            />
            <SliderControl
              label="Height"
              value={height}
              min={40}
              max={300}
              step={5}
              unit="px"
              onChange={setHeight}
            />
            <SliderControl
              label="Margin"
              value={margin}
              min={0}
              max={40}
              step={2}
              unit="px"
              onChange={setMargin}
            />
          </div>
        </div>

        <div className="bc-section bc-section--row">
          <span className="mono-label">Show text</span>
          <button
            type="button"
            className={`bc-toggle${displayValue ? " bc-toggle--on" : ""}`}
            onClick={() => setDisplayValue(!displayValue)}
            aria-pressed={displayValue}
            aria-label="Toggle text below barcode"
          >
            <span className="bc-toggle-knob" />
          </button>
        </div>
      </div>

      {/* ── Preview + download panel ── */}
      <div className="card bc-preview-card">
        <div className="bc-preview-header">
          <span className="mono-label">Preview</span>
          {hasBarcode && (
            <div className="copy-actions">
              <button
                type="button"
                className={`btn-secondary${copyState === "copied" ? " bc-copy--done" : copyState === "error" ? " bc-copy--err" : ""}`}
                onClick={handleCopyPng}
                aria-label="Copy barcode as PNG to clipboard"
              >
                {copyState === "copied"
                  ? "Copied!"
                  : copyState === "error"
                    ? "Copy failed"
                    : "Copy PNG"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadPng}
                aria-label="Download barcode as PNG"
              >
                Download PNG
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadSvg}
                aria-label="Download barcode as SVG"
              >
                Download SVG
              </button>
            </div>
          )}
        </div>

        <div className="bc-preview-canvas" aria-label="Barcode preview">
          {!canRender && !renderError && (
            <div className="bc-empty">
              <span className="bc-empty-glyph">
                <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" width="48" height="48">
                  <line
                    x1="4"
                    y1="8"
                    x2="4"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <line
                    x1="10"
                    y1="8"
                    x2="10"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="18"
                    y1="8"
                    x2="18"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="23"
                    y1="8"
                    x2="23"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <line
                    x1="29"
                    y1="8"
                    x2="29"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="35"
                    y1="8"
                    x2="35"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="41"
                    y1="8"
                    x2="41"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="44"
                    y1="8"
                    x2="44"
                    y2="40"
                    stroke="var(--rule)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <p className="bc-empty-text">Enter valid text above to generate a barcode.</p>
            </div>
          )}
          {renderError && (
            <p className="bc-error bc-render-error" role="alert">
              <span className="bc-error-icon">!</span>
              {renderError}
            </p>
          )}
          {/* SVG target, always in DOM so the ref is stable */}
          <svg
            ref={svgRef}
            className={`bc-svg${hasBarcode ? " bc-svg--visible" : ""}`}
            aria-label="Generated barcode"
          />
        </div>

        {hasBarcode && <p className="bc-keyboard-hint">Cmd+Enter copies PNG to clipboard</p>}
      </div>
    </div>
  );
}

// ── Auto-check-digit logic for EAN-13 / UPC-A / EAN-8 ────────────────────

interface AutofixResult {
  value: string;
  autofixed: boolean;
  validationError: string | null;
}

function computeAutofix(format: BarcodeFormat, input: string): AutofixResult {
  const trimmed = input.trim();
  if (format === "EAN13") {
    const { value, appended } = ean13Autofix(trimmed);
    if (appended) {
      return { value, autofixed: true, validationError: null };
    }
  }
  if (format === "UPC") {
    const { value, appended } = upcaAutofix(trimmed);
    if (appended) {
      return { value, autofixed: true, validationError: null };
    }
  }
  if (format === "EAN8") {
    const { value, appended } = ean8Autofix(trimmed);
    if (appended) {
      return { value, autofixed: true, validationError: null };
    }
  }
  // No autofix: validate directly
  const meta = FORMAT_META[format];
  const err = trimmed.length === 0 ? null : meta.validate(trimmed);
  return { value: trimmed, autofixed: false, validationError: err };
}

// ── Main App ──────────────────────────────────────────────────────────────

export function App() {
  const [mode, setMode] = useState<AppMode>("barcode");
  const { format, setFormat } = useBarcodeStore();

  const subtitle =
    mode === "barcode"
      ? "code128, ean-13, upc-a, ean-8, code39, code93, itf. png + svg. free + private."
      : mode === "qr"
        ? "qr codes: text, url, wifi, vcard. png + svg. free + private."
        : "batch barcode generation. paste a list, download a zip.";

  return (
    <div className="app-root">
      <Header
        title="Barcode Generator"
        subtitle={subtitle}
        brandMark={
          <BrandMark label="Barcode Generator">
            <BarcodeBrandGlyph />
          </BrandMark>
        }
        controls={
          <>
            <ModeSelector value={mode} onChange={setMode} />
            {mode === "barcode" && <FormatSelector value={format} onChange={setFormat} />}
          </>
        }
      />

      <main className="site-main">
        {mode === "barcode" && <BarcodeTab />}
        {mode === "qr" && <QrTab />}
        {mode === "batch" && <BatchTab />}

        <p className="bc-privacy-note">
          Runs entirely in your browser. No data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
