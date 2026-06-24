import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  generateList,
  generateParagraphs,
  generateSentences,
  generateWords,
  isValidHexColor,
  placeholderImgTag,
  placeholderSvgDataUri,
  renderPlaceholderPng,
  renderPlaceholderSvg,
  toLoremHtml,
  withClassicStart,
} from "./lib/lorem";
import type { WordBank } from "./lib/lorem";
import { useLoremStore } from "./store/loremStore";

// ── Brand glyph: text lines + placeholder image frame ────────────────────────

function LoremBrandGlyph() {
  return (
    <>
      {/* Text lines representing lorem ipsum */}
      <line x1="4" y1="6" x2="20" y2="6" stroke="#2f9d8d" strokeWidth="2.5" strokeLinecap="round" />
      <line
        x1="4"
        y1="11"
        x2="28"
        y2="11"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="4"
        y1="16"
        x2="24"
        y2="16"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Placeholder image frame */}
      <rect
        x="4"
        y="21"
        width="14"
        height="9"
        rx="2"
        stroke="#e8b04b"
        strokeWidth="2"
        fill="none"
      />
      {/* Mountain icon inside frame */}
      <polyline
        points="4,27 8,23 12,26 16,22 18,24"
        stroke="#d9594c"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({
  text,
  label,
  displayLabel = "Copy",
}: {
  text: string;
  label: string;
  displayLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    });
  }, [text]);

  return (
    <button
      type="button"
      className={`btn-secondary${copied ? " btn-secondary--copied" : ""}`}
      onClick={handleCopy}
      aria-label={label}
      disabled={!text}
    >
      {copied ? "Copied!" : displayLabel}
    </button>
  );
}

// ── Lorem ipsum panel ────────────────────────────────────────────────────────

const MODE_OPTIONS = [
  { value: "paragraphs", label: "Paragraphs" },
  { value: "sentences", label: "Sentences" },
  { value: "words", label: "Words" },
  { value: "list", label: "List" },
] as const;

type ModeValue = (typeof MODE_OPTIONS)[number]["value"];

const WORD_BANK_OPTIONS: { value: WordBank; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "bacon", label: "Bacon" },
  { value: "hipster", label: "Hipster" },
  { value: "corporate", label: "Corporate" },
];

function LoremPanel() {
  const {
    mode,
    count,
    listStyle,
    seed,
    wordBank,
    classicStart,
    setMode,
    setCount,
    setListStyle,
    regenerate,
    setWordBank,
    setClassicStart,
  } = useLoremStore();

  const [output, setOutput] = useState("");
  const [clampNote, setClampNote] = useState<string | null>(null);
  const clampTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxCount = mode === "words" ? 200 : mode === "list" ? 30 : 20;

  useEffect(() => {
    let result = "";
    if (mode === "paragraphs") {
      result = generateParagraphs(count, seed, wordBank);
    } else if (mode === "sentences") {
      result = generateSentences(count, seed, wordBank);
    } else if (mode === "words") {
      result = generateWords(count, seed, wordBank);
    } else {
      result = generateList(count, seed, listStyle === "ordered", wordBank).join("\n");
    }
    if (classicStart && (mode === "paragraphs" || mode === "sentences")) {
      result = withClassicStart(result, mode);
    }
    setOutput(result);
  }, [mode, count, listStyle, seed, wordBank, classicStart]);

  // Cmd/Ctrl+Enter regenerates
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        regenerate();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [regenerate]);

  const countLabel =
    mode === "paragraphs"
      ? "Paragraphs"
      : mode === "sentences"
        ? "Sentences"
        : mode === "words"
          ? "Words"
          : "Items";

  const supportsClassicStart = mode === "paragraphs" || mode === "sentences";

  function handleCountChange(raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    if (n > maxCount) {
      setCount(maxCount);
      setClampNote(`Max ${maxCount} ${countLabel.toLowerCase()} — clamped.`);
      if (clampTimer.current) clearTimeout(clampTimer.current);
      clampTimer.current = setTimeout(() => setClampNote(null), 3000);
    } else if (n < 1) {
      setCount(1);
    } else {
      setCount(n);
      setClampNote(null);
    }
  }

  const htmlOutput = toLoremHtml(output, mode, listStyle);

  return (
    <div className="lorem-layout">
      {/* Controls */}
      <div className="card lorem-controls">
        <div className="lorem-controls-inner">
          {/* Mode toggle */}
          <div className="space-toggle-wrapper">
            <span className="space-toggle-label">Type</span>
            <div className="space-toggle" role="group" aria-label="Output type">
              {MODE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`space-btn${mode === value ? " space-btn--active" : ""}`}
                  onClick={() => setMode(value as ModeValue)}
                  aria-pressed={mode === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* List style (only when mode is list) */}
          {mode === "list" && (
            <div className="space-toggle-wrapper">
              <span className="space-toggle-label">Style</span>
              <div className="space-toggle" role="group" aria-label="List style">
                <button
                  type="button"
                  className={`space-btn${listStyle === "unordered" ? " space-btn--active" : ""}`}
                  onClick={() => setListStyle("unordered")}
                  aria-pressed={listStyle === "unordered"}
                >
                  Bullets
                </button>
                <button
                  type="button"
                  className={`space-btn${listStyle === "ordered" ? " space-btn--active" : ""}`}
                  onClick={() => setListStyle("ordered")}
                  aria-pressed={listStyle === "ordered"}
                >
                  Numbered
                </button>
              </div>
            </div>
          )}

          {/* Count input */}
          <div className="lorem-count-section">
            <div className="lorem-count-wrapper">
              <label htmlFor="lorem-count" className="space-toggle-label">
                {countLabel}
              </label>
              <input
                id="lorem-count"
                type="number"
                className="lorem-count-input"
                min={1}
                max={maxCount}
                value={count}
                onChange={(e) => handleCountChange(e.target.value)}
                aria-label={`Number of ${countLabel.toLowerCase()}`}
              />
              <span className="lorem-count-max">/ {maxCount}</span>
            </div>
            {clampNote && (
              <output className="lorem-clamp-note" aria-live="polite">
                {clampNote}
              </output>
            )}
          </div>

          {/* Word bank */}
          <div className="space-toggle-wrapper space-toggle-wrapper--wrap">
            <span className="space-toggle-label">Style</span>
            <div className="space-toggle" role="group" aria-label="Word bank">
              {WORD_BANK_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`space-btn${wordBank === value ? " space-btn--active" : ""}`}
                  onClick={() => setWordBank(value)}
                  aria-pressed={wordBank === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Classic start toggle */}
          {supportsClassicStart && (
            <label className="lorem-toggle-row">
              <input
                type="checkbox"
                className="lorem-checkbox"
                checked={classicStart}
                onChange={(e) => setClassicStart(e.target.checked)}
                aria-label="Start with classic Lorem ipsum opening sentence"
              />
              <span className="lorem-toggle-label-text">
                Start with "Lorem ipsum dolor sit amet..."
              </span>
            </label>
          )}

          {/* Regenerate */}
          <button
            type="button"
            className="btn-primary"
            onClick={regenerate}
            title="Regenerate (Cmd+Enter)"
          >
            Regenerate
          </button>
          <span className="lorem-kbd-hint">
            <kbd>Cmd</kbd>+<kbd>Enter</kbd> to regenerate
          </span>
        </div>
      </div>

      {/* Output */}
      <div className="card lorem-output-card">
        <div className="lorem-output-header">
          <span className="lorem-panel-label">Output</span>
          <div className="lorem-output-actions">
            <CopyButton text={output} label="Copy lorem ipsum plain text" />
            <CopyButton
              text={htmlOutput}
              label="Copy lorem ipsum as HTML"
              displayLabel="Copy HTML"
            />
          </div>
        </div>
        <textarea
          className="lorem-textarea"
          value={output}
          readOnly
          aria-label="Lorem ipsum output"
          aria-readonly="true"
          spellCheck={false}
          data-testid="lorem-output"
        />
      </div>
    </div>
  );
}

// ── Placeholder image panel ──────────────────────────────────────────────────

const PRESET_SIZES = [
  { label: "800x600", w: 800, h: 600 },
  { label: "1200x630", w: 1200, h: 630 },
  { label: "400x300", w: 400, h: 300 },
  { label: "1920x1080", w: 1920, h: 1080 },
  { label: "300x250", w: 300, h: 250 },
  { label: "160x600", w: 160, h: 600 },
];

function ColorInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [raw, setRaw] = useState(value);
  const valid = isValidHexColor(raw);

  useEffect(() => {
    setRaw(value);
  }, [value]);

  return (
    <div className="color-input-group">
      <label htmlFor={id} className="space-toggle-label">
        {label}
      </label>
      <div className="color-input-row">
        <input
          id={`${id}-picker`}
          type="color"
          className="color-swatch"
          value={valid ? raw : value}
          onChange={(e) => {
            setRaw(e.target.value);
            onChange(e.target.value);
          }}
          aria-label={`${label} colour picker`}
        />
        <input
          id={id}
          type="text"
          className={`lorem-text-input${valid ? "" : " lorem-text-input--error"}`}
          value={raw}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value;
            setRaw(v);
            if (isValidHexColor(v)) onChange(v);
          }}
          aria-label={`${label} hex colour`}
          aria-invalid={!valid}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function PlaceholderPanel() {
  const {
    width,
    height,
    bgColor,
    textColor,
    label,
    format,
    setWidth,
    setHeight,
    setBgColor,
    setTextColor,
    setLabel,
    setFormat,
  } = useLoremStore();

  const svgString = renderPlaceholderSvg({ width, height, bgColor, textColor, label });
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const handleDownloadSvg = useCallback(() => {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `placeholder-${width}x${height}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [svgString, width, height]);

  const handleDownloadPng = useCallback(() => {
    void renderPlaceholderPng({ width, height, bgColor, textColor, label }).then((dataUrl) => {
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `placeholder-${width}x${height}.png`;
      a.click();
    });
  }, [width, height, bgColor, textColor, label]);

  const handleDownload = format === "png" ? handleDownloadPng : handleDownloadSvg;

  const [widthRaw, setWidthRaw] = useState(String(width));
  const [heightRaw, setHeightRaw] = useState(String(height));

  const applyDimension = useCallback(
    (axis: "w" | "h", val: string) => {
      const n = Number.parseInt(val, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 4000) {
        if (axis === "w") setWidth(n);
        else setHeight(n);
      }
    },
    [setWidth, setHeight]
  );

  const cfg = { width, height, bgColor, textColor, label };
  const svgDataUri = placeholderSvgDataUri(cfg);
  const svgImgTag = placeholderImgTag(cfg, "svg");

  return (
    <div className="placeholder-layout">
      {/* Controls */}
      <div className="card placeholder-controls">
        <div className="placeholder-controls-inner">
          {/* Preset sizes */}
          <div className="placeholder-presets">
            <span className="space-toggle-label">Presets</span>
            <div className="preset-grid">
              {PRESET_SIZES.map(({ label: pl, w, h }) => (
                <button
                  key={pl}
                  type="button"
                  className={`btn-secondary${w === width && h === height ? " btn-secondary--active" : ""}`}
                  onClick={() => {
                    setWidth(w);
                    setHeight(h);
                    setWidthRaw(String(w));
                    setHeightRaw(String(h));
                  }}
                >
                  {pl}
                </button>
              ))}
            </div>
          </div>

          {/* Custom dimensions */}
          <div className="placeholder-dims">
            <div className="dim-input-group">
              <label htmlFor="ph-width" className="space-toggle-label">
                Width
              </label>
              <input
                id="ph-width"
                type="number"
                className="lorem-count-input"
                min={1}
                max={4000}
                value={widthRaw}
                onChange={(e) => {
                  setWidthRaw(e.target.value);
                  applyDimension("w", e.target.value);
                }}
                aria-label="Placeholder width in pixels"
              />
            </div>
            <span className="dim-x">x</span>
            <div className="dim-input-group">
              <label htmlFor="ph-height" className="space-toggle-label">
                Height
              </label>
              <input
                id="ph-height"
                type="number"
                className="lorem-count-input"
                min={1}
                max={4000}
                value={heightRaw}
                onChange={(e) => {
                  setHeightRaw(e.target.value);
                  applyDimension("h", e.target.value);
                }}
                aria-label="Placeholder height in pixels"
              />
            </div>
          </div>

          {/* Colours */}
          <ColorInput id="ph-bg" label="Background" value={bgColor} onChange={setBgColor} />
          <ColorInput id="ph-text" label="Text" value={textColor} onChange={setTextColor} />

          {/* Label */}
          <div className="placeholder-label-group">
            <label htmlFor="ph-label" className="space-toggle-label">
              Label
            </label>
            <input
              id="ph-label"
              type="text"
              className="lorem-text-input"
              value={label}
              placeholder={`${width}x${height}`}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Placeholder image label text"
            />
          </div>

          {/* Format + download */}
          <div className="placeholder-actions">
            <div className="space-toggle-wrapper">
              <span className="space-toggle-label">Format</span>
              <div className="space-toggle" role="group" aria-label="Download format">
                <button
                  type="button"
                  className={`space-btn${format === "svg" ? " space-btn--active" : ""}`}
                  onClick={() => setFormat("svg")}
                  aria-pressed={format === "svg"}
                >
                  SVG
                </button>
                <button
                  type="button"
                  className={`space-btn${format === "png" ? " space-btn--active" : ""}`}
                  onClick={() => setFormat("png")}
                  aria-pressed={format === "png"}
                >
                  PNG
                </button>
              </div>
            </div>
            <button type="button" className="btn-primary" onClick={handleDownload}>
              Download {format.toUpperCase()}
            </button>
          </div>

          {/* Copy markup actions */}
          <div className="placeholder-copy-actions">
            <span className="space-toggle-label">Copy as</span>
            <div className="placeholder-copy-btns">
              <CopyButton
                text={svgImgTag}
                label="Copy img tag with SVG data URI"
                displayLabel="&lt;img&gt; tag"
              />
              <CopyButton text={svgDataUri} label="Copy SVG data URI" displayLabel="Data URI" />
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="card placeholder-preview-card">
        <div className="lorem-output-header">
          <span className="lorem-panel-label">Preview</span>
          <span className="lorem-stat">
            {width}x{height}px
          </span>
        </div>
        <div className="placeholder-preview-frame" aria-label="Placeholder image preview">
          <img
            src={svgDataUrl}
            alt={`Placeholder ${width}x${height}`}
            className="placeholder-preview-img"
            data-testid="placeholder-preview"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const { activeTab, setActiveTab } = useLoremStore();

  return (
    <div className="app-root">
      <Header
        title="Lorem Ipsum"
        subtitle="text generator + placeholder images"
        brandMark={
          <BrandMark label="Lorem Ipsum Generator">
            <LoremBrandGlyph />
          </BrandMark>
        }
        controls={
          <div className="space-toggle-wrapper">
            <div className="space-toggle" role="tablist" aria-label="Tool section">
              <button
                type="button"
                role="tab"
                className={`space-btn${activeTab === "lorem" ? " space-btn--active" : ""}`}
                onClick={() => setActiveTab("lorem")}
                aria-selected={activeTab === "lorem"}
              >
                Lorem Ipsum
              </button>
              <button
                type="button"
                role="tab"
                className={`space-btn${activeTab === "placeholder" ? " space-btn--active" : ""}`}
                onClick={() => setActiveTab("placeholder")}
                aria-selected={activeTab === "placeholder"}
              >
                Placeholder Images
              </button>
            </div>
          </div>
        }
      />

      <main className="site-main">
        {activeTab === "lorem" ? <LoremPanel /> : <PlaceholderPanel />}
        <p className="lorem-privacy-note">
          Runs entirely in your browser. No data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
