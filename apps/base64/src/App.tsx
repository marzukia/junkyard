import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./kit/components/BrandMark";
import { Footer } from "./kit/components/Footer";
import { Header } from "./kit/components/Header";
import {
  base64ToBytes,
  decode,
  decodeGzipBase64,
  encode,
  encodeGzipBase64,
  isImageDataUri,
  looksLikeBase64,
  parseDataUri,
  stripDataUri,
} from "./lib/base64";
import type { EncodingMode } from "./lib/base64";
import { useBase64Store } from "./store/base64Store";
import type { Direction } from "./store/base64Store";

// ── Brand glyph: stacked horizontal bars, a clean "encode" motif ─────────────
// Three bars of different widths in teal/amber/coral, no backing square.

function Base64BrandGlyph() {
  return (
    <>
      {/* Left angle bracket, teal stroke */}
      <polyline
        points="12,7 5,16 12,25"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right angle bracket, teal stroke */}
      <polyline
        points="20,7 27,16 20,25"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Amber data line between brackets */}
      <line
        x1="14"
        y1="16"
        x2="18"
        y2="16"
        stroke="#e8b04b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Coral accent dot */}
      <circle cx="16" cy="22" r="1.8" fill="#d9594c" />
    </>
  );
}

// ── Mode + direction toggles ───────────────────────────────────────────────────

const MODES: { id: EncodingMode; label: string }[] = [
  { id: "base64", label: "Base64" },
  { id: "base64url", label: "Base64 URL" },
  { id: "url", label: "URL" },
  { id: "hex", label: "Hex" },
];

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: "encode", label: "Encode" },
  { id: "decode", label: "Decode" },
];

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [value]);

  return (
    <button
      type="button"
      className={`btn-secondary b64-copy-btn${copied ? " b64-copy-btn--copied" : ""}`}
      onClick={() => void handleCopy()}
      aria-label={copied ? "Copied!" : "Copy to clipboard"}
      disabled={!value}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Sample data ────────────────────────────────────────────────────────────────

const SAMPLE_ENCODE = "Hello, World! Try encoding this text.";
const SAMPLE_DECODE = "SGVsbG8sIFdvcmxkISBUcnkgZW5jb2RpbmcgdGhpcyB0ZXh0Lg==";
const SAMPLE_DECODE_URL = "SGVsbG8sIFdvcmxkISBUcnkgZW5jb2RpbmcgdGhpcyB0ZXh0Lg";
const SAMPLE_DECODE_URLENC = "Hello%2C%20World%21%20Try%20encoding%20this%20text.";
const SAMPLE_DECODE_HEX = "48656c6c6f2c20576f726c6421";

// ── Decoded image preview ─────────────────────────────────────────────────────
// Shows a thumbnail when the decoded output is a data-URI image.

function DecodedImagePreview({ output }: { output: string }) {
  if (!output) return null;
  const parsed = parseDataUri(output);
  if (!parsed || !parsed.mime.startsWith("image/")) return null;
  return (
    <div className="b64-decoded-image-wrap">
      <span className="b64-decoded-image-label">Image preview</span>
      <div className="b64-image-preview b64-image-preview--decoded">
        <img src={output} alt="Decoded data-URI" />
      </div>
      <p className="b64-hint">
        Decoded as <code>{parsed.mime}</code> image. Copy the data-URI above to embed directly.
      </p>
    </div>
  );
}

// ── Auto-detect nudge ─────────────────────────────────────────────────────────
// In encode mode, if input looks like base64, show a "Decode instead?" banner.

function Base64NudgeBanner({ onSwitch }: { onSwitch: () => void }) {
  return (
    <output className="b64-nudge">
      <span className="b64-nudge-text">Input looks like a Base64 string.</span>
      <button type="button" className="btn-secondary b64-copy-btn" onClick={onSwitch}>
        Decode instead
      </button>
    </output>
  );
}

// ── Text tab ──────────────────────────────────────────────────────────────────

function TextTab() {
  const {
    mode,
    direction,
    gzip,
    inputText,
    outputText,
    error,
    setInputText,
    setOutputText,
    setError,
    setDirection,
    clearText,
  } = useBase64Store();

  // Gzip encode/decode is async; track pending state
  const [gzipPending, setGzipPending] = useState(false);

  // Whether to show the "looks like base64, decode instead?" nudge
  const showNudge =
    direction === "encode" &&
    (mode === "base64" || mode === "base64url") &&
    !gzip &&
    inputText.length >= 12 &&
    looksLikeBase64(inputText);

  useEffect(() => {
    if (!inputText) {
      setOutputText("");
      setError(null);
      return;
    }

    // Gzip path (async, encode mode only, only for base64/base64url)
    const isGzipMode = gzip && (mode === "base64" || mode === "base64url");
    if (isGzipMode) {
      setGzipPending(true);
      const op = direction === "encode" ? encodeGzipBase64(inputText) : decodeGzipBase64(inputText);
      op.then(
        (result) => {
          setOutputText(result);
          setError(null);
          setGzipPending(false);
        },
        () => {
          setOutputText("");
          setError(
            direction === "decode"
              ? "Could not decompress. Ensure the input is a valid gzip+base64 string."
              : "Gzip compression failed."
          );
          setGzipPending(false);
        }
      );
      return;
    }

    // Synchronous path
    try {
      const result = direction === "encode" ? encode(inputText, mode) : decode(inputText, mode);
      setOutputText(result);
      setError(null);
    } catch {
      setOutputText("");
      setError(
        direction === "decode"
          ? "Invalid input, could not decode. Check the encoded string."
          : "Encoding failed."
      );
    }
  }, [inputText, mode, direction, gzip, setOutputText, setError]);

  const handleLoadSample = useCallback(() => {
    if (direction === "encode") {
      setInputText(SAMPLE_ENCODE);
    } else {
      const sample =
        mode === "base64url"
          ? SAMPLE_DECODE_URL
          : mode === "url"
            ? SAMPLE_DECODE_URLENC
            : mode === "hex"
              ? SAMPLE_DECODE_HEX
              : SAMPLE_DECODE;
      setInputText(sample);
    }
  }, [direction, mode, setInputText]);

  // Cmd/Ctrl+Enter in the input textarea re-runs (re-triggers useEffect by blurring/focusing,
  // but since output is reactive there's no separate "run" — we use it to copy the output).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (outputText) {
          void navigator.clipboard.writeText(outputText).catch(() => {});
        }
      }
    },
    [outputText]
  );

  const inputLabel = direction === "encode" ? "Input text" : "Encoded input";
  const outputLabel =
    direction === "encode"
      ? gzip && (mode === "base64" || mode === "base64url")
        ? "Gzip + Base64 output"
        : "Encoded output"
      : "Decoded output";

  return (
    <div className="b64-text-layout">
      <div className="b64-field-group">
        <div className="b64-field-header">
          <label className="mono-label" htmlFor="b64-input">
            {inputLabel}
          </label>
          <div className="b64-btn-row">
            {!inputText && (
              <button
                type="button"
                className="btn-secondary b64-copy-btn"
                onClick={handleLoadSample}
                aria-label="Load sample text"
              >
                Example
              </button>
            )}
            {inputText && (
              <button
                type="button"
                className="btn-secondary b64-copy-btn"
                onClick={clearText}
                aria-label="Clear input and output"
              >
                Clear
              </button>
            )}
            <CopyButton value={inputText} />
          </div>
        </div>
        {showNudge && <Base64NudgeBanner onSwitch={() => setDirection("decode")} />}
        <textarea
          id="b64-input"
          className="b64-textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={direction === "encode" ? "Paste text to encode…" : "Paste encoded string…"}
          aria-label={inputLabel}
          spellCheck={false}
        />
        <p className="b64-hint">Cmd/Ctrl+Enter copies the output.</p>
      </div>

      <div className="b64-field-group">
        <div className="b64-field-header">
          <span className="mono-label">{gzipPending ? "Working…" : outputLabel}</span>
          <CopyButton value={outputText} />
        </div>
        {error ? (
          <div className="b64-error" role="alert">
            {error}
          </div>
        ) : (
          <>
            <textarea
              className="b64-textarea b64-textarea--output"
              value={outputText}
              readOnly
              placeholder="Output appears here…"
              aria-label={outputLabel}
              aria-live="polite"
              spellCheck={false}
            />
            {direction === "decode" && <DecodedImagePreview output={outputText} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Snippet copy row ──────────────────────────────────────────────────────────
// Used in file tab for CSS and <img> snippets.

function SnippetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="b64-snippet-row">
      <span className="b64-snippet-label">{label}</span>
      <code className="b64-snippet-code">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}

// ── File tab ──────────────────────────────────────────────────────────────────

function FileTab() {
  const {
    fileDataUrl,
    fileName,
    fileMime,
    fileBase64Output,
    setFile,
    setFileBase64Output,
    clearFile,
  } = useBase64Store();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const b64InputRef = useRef<HTMLTextAreaElement>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decodedPreviewUrl, setDecodedPreviewUrl] = useState<string | null>(null);

  // When a file is loaded, compute its Base64 output
  useEffect(() => {
    if (!fileDataUrl) return;
    // dataUrl is already "data:<mime>;base64,<b64>", extract raw b64
    const raw = stripDataUri(fileDataUrl);
    setFileBase64Output(raw);
  }, [fileDataUrl, setFileBase64Output]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setFile(result, file.name, file.type || "application/octet-stream");
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [setFile]
  );

  const handleDownloadFromB64 = useCallback(() => {
    const raw = b64InputRef.current?.value.trim();
    if (!raw) return;
    setDecodeError(null);
    // Accept either plain Base64 or a data-URI
    const b64 = stripDataUri(raw);
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(b64);
    } catch {
      setDecodeError("Could not decode. Paste a valid Base64 string or data-URI.");
      return;
    }
    const mime = fileMime ?? "application/octet-stream";
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ?? "download";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [fileMime, fileName]);

  // When the decode textarea changes, attempt to detect an image for live preview
  const handleDecodeInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDecodeError(null);
    const raw = e.target.value.trim();
    if (!raw) {
      setDecodedPreviewUrl(null);
      return;
    }
    // Only show live preview if it has a data:image/ prefix
    if (/^data:image\//.test(raw)) {
      setDecodedPreviewUrl(raw);
    } else {
      setDecodedPreviewUrl(null);
    }
  }, []);

  const isImage = fileDataUrl ? isImageDataUri(fileDataUrl) : false;
  const b64ForDataUri = fileBase64Output ?? "";
  const dataUri = fileDataUrl ?? "";

  // CSS and <img> snippet values (only for images)
  const cssSnippet = isImage && fileBase64Output ? `url("${dataUri}")` : "";
  const imgSnippet = isImage && fileBase64Output ? `<img src="${dataUri}" alt="" />` : "";

  return (
    <div className="b64-file-layout">
      {/* Left: upload panel */}
      <div className="b64-field-group">
        <span className="mono-label">File to Base64</span>
        <div className="b64-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            style={{ display: "none" }}
            aria-label="Upload file to encode"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            {fileDataUrl ? "Replace file" : "Choose file…"}
          </button>

          {fileDataUrl && (
            <>
              {fileName && <span className="b64-file-name">{fileName}</span>}
              {isImage && (
                <div className="b64-image-preview">
                  <img src={fileDataUrl} alt="Preview of uploaded file" />
                </div>
              )}
              <button type="button" className="btn-secondary b64-clear-btn" onClick={clearFile}>
                Clear
              </button>
            </>
          )}
        </div>

        {fileBase64Output && (
          <div className="b64-field-group" style={{ marginTop: "1rem" }}>
            <div className="b64-field-header">
              <span className="mono-label">Base64 output</span>
              <CopyButton value={b64ForDataUri} />
            </div>
            <textarea
              className="b64-textarea b64-textarea--output b64-textarea--compact"
              value={fileBase64Output}
              readOnly
              aria-label="Base64 encoded file output"
              aria-live="polite"
              spellCheck={false}
            />
            {/* Data-URI snippet */}
            <div className="b64-field-group" style={{ marginTop: "0.5rem" }}>
              <span className="mono-label b64-snippets-heading">Embed snippets</span>
              <div className="b64-snippets">
                <SnippetRow
                  label="data-URI"
                  value={dataUri.slice(0, 120) + (dataUri.length > 120 ? "…" : "")}
                />
                {isImage && (
                  <>
                    <SnippetRow
                      label="CSS"
                      value={cssSnippet.slice(0, 80) + (cssSnippet.length > 80 ? "…" : "")}
                    />
                    <SnippetRow
                      label="<img>"
                      value={imgSnippet.slice(0, 80) + (imgSnippet.length > 80 ? "…" : "")}
                    />
                  </>
                )}
              </div>
              <p className="b64-hint">
                Copy buttons copy the full value, not the truncated preview.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: decode panel */}
      <div className="b64-field-group">
        <span className="mono-label">Base64 to file download</span>
        <div className="b64-field-header" style={{ marginTop: "0.5rem" }}>
          <label className="mono-label" htmlFor="b64-decode-input" style={{ opacity: 0 }}>
            Paste
          </label>
        </div>
        <textarea
          id="b64-decode-input"
          ref={b64InputRef}
          className="b64-textarea"
          onChange={handleDecodeInput}
          placeholder={
            "Paste Base64 or data-URI here…\n\nExample:\ndata:image/png;base64,iVBOR…\nor just the raw Base64 string."
          }
          aria-label="Base64 to decode and download"
          spellCheck={false}
        />
        {decodedPreviewUrl && (
          <div className="b64-image-preview b64-image-preview--decoded">
            <img src={decodedPreviewUrl} alt="Decoded data" />
          </div>
        )}
        {decodeError && (
          <div className="b64-error b64-error--inline" role="alert">
            {decodeError}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownloadFromB64}
            aria-label="Download decoded file"
          >
            Download file
          </button>
        </div>
        <p className="b64-hint">
          Paste a data-URI or raw Base64 string and click Download. The file is reconstructed
          entirely in your browser, nothing is uploaded.
        </p>
      </div>
    </div>
  );
}

// ── Tab nav ───────────────────────────────────────────────────────────────────

type ActiveTab = "text" | "file";

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  const { mode, direction, gzip, setMode, setDirection, setGzip } = useBase64Store();
  const [activeTab, setActiveTab] = useState<ActiveTab>("text");

  // Gzip option only makes sense for base64/base64url encode/decode
  const showGzip = activeTab === "text" && (mode === "base64" || mode === "base64url");

  const headerControls = (
    <div className="b64-controls">
      {/* Mode selector */}
      <div className="space-toggle-wrapper">
        <span className="space-toggle-label">Mode</span>
        <div className="space-toggle" role="radiogroup" aria-label="Encoding mode">
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`space-btn${mode === id ? " space-btn--active" : ""}`}
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Encode / Decode direction (only shown on text tab) */}
      {activeTab === "text" && (
        <div className="space-toggle-wrapper">
          <div className="space-toggle" role="radiogroup" aria-label="Encode or decode">
            {DIRECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`space-btn${direction === id ? " space-btn--active" : ""}`}
                onClick={() => setDirection(id)}
                aria-pressed={direction === id}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gzip toggle (only for base64 modes in text tab) */}
      {showGzip && (
        <div className="space-toggle-wrapper">
          <button
            type="button"
            className={`space-btn${gzip ? " space-btn--active" : ""}`}
            onClick={() => setGzip(!gzip)}
            aria-pressed={gzip}
            title="Gzip compress then Base64 encode (or decode+decompress)"
          >
            Gzip
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-root">
      <Header
        title="Base64 Encode / Decode"
        subtitle="base64 · url-safe · url encoding · hex · gzip · text + file · no upload"
        brandMark={
          <BrandMark label="Base64 Encode / Decode">
            <Base64BrandGlyph />
          </BrandMark>
        }
        controls={headerControls}
      />

      <main className="site-main">
        {/* Tab nav */}
        <div className="b64-tab-nav" role="tablist" aria-label="Input type">
          <button
            type="button"
            role="tab"
            className={`b64-tab-btn${activeTab === "text" ? " b64-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("text")}
            aria-selected={activeTab === "text"}
          >
            Text
          </button>
          <button
            type="button"
            role="tab"
            className={`b64-tab-btn${activeTab === "file" ? " b64-tab-btn--active" : ""}`}
            onClick={() => setActiveTab("file")}
            aria-selected={activeTab === "file"}
          >
            File
          </button>
        </div>

        <div className="card">{activeTab === "text" ? <TextTab /> : <FileTab />}</div>

        <p className="b64-privacy-note">
          Runs entirely in your browser, no data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
