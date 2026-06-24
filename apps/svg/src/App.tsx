import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { useSvgStore } from "./store";
import {
  byteLength,
  formatBytes,
  optimizeSvg,
  parseFriendlyError,
  toBase64DataUri,
  toDataUri,
  toJsxComponent,
} from "./svgOptimize";

// ── SVG brand glyph: clean diamond-path mark in teal/amber/coral ──────────────
// Represents an SVG node-path: teal outer diamond frame, amber inner node dot,
// coral path lines. Clean line-art, stroke-only, no fill blocks.
function SvgGlyph() {
  return (
    <>
      {/* Outer diamond frame - teal */}
      <path
        d="M16 3 L29 16 L16 29 L3 16 Z"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Inner path lines - coral */}
      <path
        d="M10 16 L16 10 L22 16 L16 22 Z"
        stroke="#d9594c"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Center node - amber */}
      <circle cx="16" cy="16" r="2.2" fill="#e8b04b" />
    </>
  );
}

// ── Download button ───────────────────────────────────────────────────────────

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [text, filename]);

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={handleDownload}
      disabled={!text}
      aria-label={`Download as ${filename}`}
    >
      Download .svg
    </button>
  );
}

// ── Saving badge ──────────────────────────────────────────────────────────────

function SavingBadge({ saving }: { saving: number }) {
  const pct = Math.round(saving * 100);

  // Already-optimized: tiny or negative savings -- surface a success message
  // instead of a confusing +N% or 0% badge.
  if (pct <= 2) {
    return (
      <span
        className="svg-saving-badge svg-saving-badge--neutral"
        aria-label="Already optimized, nothing to strip"
      >
        Already optimized
      </span>
    );
  }

  const cls =
    pct >= 30
      ? "svg-saving-badge svg-saving-badge--great"
      : pct >= 10
        ? "svg-saving-badge svg-saving-badge--good"
        : "svg-saving-badge";
  const label = `${pct}% smaller`;
  return (
    <span className={cls} aria-label={label}>
      -{pct}%
    </span>
  );
}

// ── SVG preview pane ──────────────────────────────────────────────────────────

function SvgPreview({ svg, label }: { svg: string; label: string }) {
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    <div className="svg-preview-frame" aria-label={label}>
      <img src={dataUri} alt={label} className="svg-preview-img" draggable={false} />
    </div>
  );
}

// ── Checkbox toggle ───────────────────────────────────────────────────────────

function OptionCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="svg-option-check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="svg-checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

// ── Copy formats dropdown ─────────────────────────────────────────────────────

type CopyFormat = "svg" | "data-uri" | "base64" | "jsx";

function CopyFormatButton({ result }: { result: string }) {
  const [open, setOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const copy = useCallback(
    (format: CopyFormat) => {
      let text: string;
      switch (format) {
        case "data-uri":
          text = toDataUri(result);
          break;
        case "base64":
          text = toBase64DataUri(result);
          break;
        case "jsx":
          text = toJsxComponent(result);
          break;
        default:
          text = result;
      }
      void navigator.clipboard.writeText(text).then(() => {
        setCopiedFormat(format);
        setOpen(false);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopiedFormat(null), 1800);
      });
    },
    [result]
  );

  const formatLabels: Record<CopyFormat, string> = {
    svg: "SVG markup",
    "data-uri": "data: URI",
    base64: "base64 URI",
    jsx: "JSX component",
  };

  return (
    <div className="svg-copy-dropdown" ref={containerRef}>
      <button
        type="button"
        className="btn-secondary svg-copy-main"
        onClick={() => copy("svg")}
        disabled={!result}
        aria-label="Copy optimized SVG"
      >
        {copiedFormat ? `Copied as ${formatLabels[copiedFormat]}!` : "Copy SVG"}
      </button>
      <button
        type="button"
        className="btn-secondary svg-copy-arrow"
        onClick={() => setOpen((v) => !v)}
        disabled={!result}
        aria-label="More copy formats"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="svg-copy-chevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="svg-copy-menu" role="menu">
          {(["svg", "data-uri", "base64", "jsx"] as CopyFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              className="svg-copy-menu-item"
              role="menuitem"
              onClick={() => copy(fmt)}
            >
              {formatLabels[fmt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const store = useSvgStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState<"toggle" | "side-by-side">("side-by-side");

  const runOptimize = useCallback(
    (svgText: string) => {
      if (!svgText.trim()) return;
      try {
        const r = optimizeSvg(svgText, store.options);
        store.setResult(r.optimized, r.originalBytes, r.optimizedBytes, r.saving);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Optimization failed.";
        // parseFriendlyError is already applied inside optimizeSvg, but if it
        // somehow re-throws a raw message, run it through the filter again.
        store.setError(parseFriendlyError(raw));
      }
    },
    [store]
  );

  const handleTextChange = useCallback(
    (value: string) => {
      store.setInput(value);
      if (value.trim()) {
        try {
          const r = optimizeSvg(value, store.options);
          store.setResult(r.optimized, r.originalBytes, r.optimizedBytes, r.saving);
        } catch (err) {
          const raw = err instanceof Error ? err.message : "Invalid SVG.";
          store.setError(parseFriendlyError(raw));
        }
      }
    },
    [store]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".svg") && file.type !== "image/svg+xml") {
        store.setError("That doesn't look like an SVG — drop a .svg file or paste SVG markup.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          store.setInput(text);
          runOptimize(text);
        }
      };
      reader.readAsText(file);
    },
    [store, runOptimize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  // Re-run optimization when any option changes (store already clears result on setOption)
  const handleOptionChange = useCallback(
    <K extends keyof typeof store.options>(key: K, value: (typeof store.options)[K]) => {
      store.setOption(key, value);
      if (store.input.trim()) {
        const newOpts = { ...store.options, [key]: value };
        try {
          const r = optimizeSvg(store.input, newOpts);
          store.setResult(r.optimized, r.originalBytes, r.optimizedBytes, r.saving);
        } catch (err) {
          const raw = err instanceof Error ? err.message : "Optimization failed.";
          store.setError(parseFriendlyError(raw));
        }
      }
    },
    [store]
  );

  // Cmd/Ctrl+Enter triggers optimization
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runOptimize(store.input);
      }
    },
    [store.input, runOptimize]
  );

  const hasInput = store.input.trim().length > 0;
  const hasResult = store.result !== null;

  const inputBytes = byteLength(store.input);

  return (
    <div className="app-root">
      <Header
        title="SVG Optimizer"
        subtitle="svgo in your browser. no upload, no account."
        brandMark={
          <BrandMark label="SVG Optimizer">
            <SvgGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* Input section */}
        <section className="svg-input-section">
          {/* Drop zone + textarea split */}
          <div
            className={`svg-dropzone-bar${isDragging ? " svg-dropzone-bar--over" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="svg-dropzone-hint" aria-hidden="true">
              <span className="svg-dropzone-hint-text">Drop .svg or</span>
              <button
                type="button"
                className="btn-secondary svg-browse-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse file
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="svg-file-input"
              onChange={handleFileInput}
              aria-label="Choose SVG file"
            />
          </div>

          <div className="card svg-textarea-card">
            <div className="svg-panel-header">
              <span className="svg-panel-label">Paste SVG</span>
              {hasInput && <span className="svg-stat">{formatBytes(inputBytes)}</span>}
              <span className="svg-panel-hint">Cmd+Enter to optimize</span>
              {hasInput && (
                <button
                  type="button"
                  className="btn-secondary svg-clear-btn"
                  onClick={() => store.setInput("")}
                  aria-label="Clear input"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              ref={textareaRef}
              className="svg-textarea"
              value={store.input}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                'Paste your SVG markup here...\n\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  <!-- your paths -->\n</svg>'
              }
              aria-label="SVG input"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </section>

        {/* Options */}
        <section className="card svg-options-section">
          <div className="svg-options-row">
            <div className="svg-precision-group">
              <label htmlFor="svg-precision" className="svg-panel-label">
                Precision
              </label>
              <div className="svg-precision-control">
                <input
                  id="svg-precision"
                  type="range"
                  min={1}
                  max={8}
                  value={store.options.precision}
                  onChange={(e) => handleOptionChange("precision", Number(e.target.value))}
                  className="svg-slider"
                  aria-label={`Numeric precision: ${store.options.precision}`}
                />
                <span className="svg-precision-val">{store.options.precision}</span>
              </div>
            </div>

            <div className="svg-checkboxes">
              <OptionCheckbox
                id="opt-metadata"
                label="Strip metadata"
                checked={store.options.stripMetadata}
                onChange={(v) => handleOptionChange("stripMetadata", v)}
              />
              <OptionCheckbox
                id="opt-groups"
                label="Collapse groups"
                checked={store.options.collapseGroups}
                onChange={(v) => handleOptionChange("collapseGroups", v)}
              />
              <OptionCheckbox
                id="opt-comments"
                label="Remove comments"
                checked={store.options.removeComments}
                onChange={(v) => handleOptionChange("removeComments", v)}
              />
              <OptionCheckbox
                id="opt-shapes"
                label="Convert shapes"
                checked={store.options.convertShapes}
                onChange={(v) => handleOptionChange("convertShapes", v)}
              />
              <OptionCheckbox
                id="opt-ids"
                label="Clean up IDs"
                checked={store.options.cleanupIds}
                onChange={(v) => handleOptionChange("cleanupIds", v)}
              />
            </div>
          </div>
        </section>

        {/* Error */}
        {store.error && (
          <div className="svg-error" role="alert" aria-live="polite">
            <span className="svg-error-icon">!</span>
            <span>{store.error}</span>
          </div>
        )}

        {/* Result */}
        {hasResult && store.result && (
          <section className="card svg-result-section">
            {/* Stats bar */}
            <div className="svg-stats-bar">
              <div className="svg-stat-item">
                <span className="svg-stat-label">Original</span>
                <span className="svg-stat-value">{formatBytes(store.originalBytes)}</span>
              </div>
              <div className="svg-stat-arrow" aria-hidden="true">
                →
              </div>
              <div className="svg-stat-item">
                <span className="svg-stat-label">Optimized</span>
                <span className="svg-stat-value">{formatBytes(store.optimizedBytes)}</span>
              </div>
              <SavingBadge saving={store.saving} />
              <div className="svg-result-actions">
                <CopyFormatButton result={store.result} />
                <DownloadButton text={store.result} filename="optimized.svg" />
              </div>
            </div>

            {/* Preview toggle + panes */}
            <div className="svg-preview-section">
              <div className="svg-preview-toggle-row">
                <div className="space-toggle" role="group" aria-label="Preview layout">
                  {previewMode === "side-by-side" ? (
                    <>
                      <button
                        type="button"
                        className="space-btn space-btn--active"
                        aria-pressed={true}
                      >
                        Side by side
                      </button>
                      <button
                        type="button"
                        className="space-btn"
                        aria-pressed={false}
                        onClick={() => setPreviewMode("toggle")}
                      >
                        Toggle
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="space-btn"
                        aria-pressed={false}
                        onClick={() => setPreviewMode("side-by-side")}
                      >
                        Side by side
                      </button>
                      <button
                        type="button"
                        className="space-btn space-btn--active"
                        aria-pressed={true}
                      >
                        Toggle
                      </button>
                    </>
                  )}
                </div>
                {previewMode === "toggle" && (
                  <div
                    className="space-toggle"
                    role="group"
                    aria-label="Preview mode"
                    style={{ marginLeft: "0.75rem" }}
                  >
                    <button
                      type="button"
                      className={`space-btn${store.activePreview === "original" ? " space-btn--active" : ""}`}
                      onClick={() => store.setActivePreview("original")}
                      aria-pressed={store.activePreview === "original"}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      className={`space-btn${store.activePreview === "optimized" ? " space-btn--active" : ""}`}
                      onClick={() => store.setActivePreview("optimized")}
                      aria-pressed={store.activePreview === "optimized"}
                    >
                      Optimized
                    </button>
                  </div>
                )}
              </div>

              <div
                className={
                  previewMode === "side-by-side"
                    ? "svg-preview-panes svg-preview-panes--side-by-side"
                    : "svg-preview-panes"
                }
              >
                {previewMode === "side-by-side" ? (
                  <>
                    <div className="svg-preview-labeled">
                      <span className="svg-preview-cap">Original</span>
                      <SvgPreview svg={store.input} label="Original SVG preview" />
                    </div>
                    <div className="svg-preview-labeled">
                      <span className="svg-preview-cap">Optimized</span>
                      <SvgPreview svg={store.result} label="Optimized SVG preview" />
                    </div>
                  </>
                ) : store.activePreview === "original" ? (
                  <SvgPreview svg={store.input} label="Original SVG preview" />
                ) : (
                  <SvgPreview svg={store.result} label="Optimized SVG preview" />
                )}
              </div>
            </div>

            {/* Optimized output textarea */}
            <div className="svg-output-wrap">
              <div className="svg-panel-header">
                <span className="svg-panel-label">Optimized SVG</span>
              </div>
              <textarea
                className="svg-textarea svg-textarea--output"
                value={store.result}
                readOnly
                aria-label="Optimized SVG output"
                aria-readonly="true"
                spellCheck={false}
              />
            </div>
          </section>
        )}

        <p className="svg-privacy-note">
          Runs entirely in your browser. No data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Powered by SVGO. No data leaves your device." />
    </div>
  );
}
