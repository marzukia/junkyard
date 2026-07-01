import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HmacAlgo, OutputEncoding } from "./lib/hash";
import { encodeOutput } from "./lib/hash";
import type { HashResult } from "./lib/hash";
import type { AlgoName } from "./lib/verify";
import { detectAlgos, matchedAlgo, rowMatchStatus } from "./lib/verify";
import { useHashStore } from "./store/hashStore";

// ── Brand glyph: hash # symbol as stroke line-art ─────────────────────────────
// Two teal vertical strokes + amber/coral horizontal strokes; no fills.

function HashBrandGlyph() {
  return (
    <>
      {/* # glyph as stroke line-art, two slanted vertical strokes (teal) + two horizontal strokes (amber/coral) */}
      <line
        x1="11.5"
        y1="5"
        x2="9.5"
        y2="27"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="20.5"
        y1="5"
        x2="18.5"
        y2="27"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="7"
        y1="12"
        x2="25"
        y2="12"
        stroke="#e8b04b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="20"
        x2="24"
        y2="20"
        stroke="#d9594c"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </>
  );
}

// ── Example text for seeding the tool ─────────────────────────────────────────

const EXAMPLE_TEXT = "The quick brown fox jumps over the lazy dog";

// ── CopyIcon ──────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ── Hash row component ─────────────────────────────────────────────────────────

interface HashRowProps {
  label: string;
  algo: AlgoName;
  hexValue: string;
  uppercase: boolean;
  encoding: OutputEncoding;
  matchTarget: string | null;
  matchedResult: AlgoName | null;
  /** When true, this row is the auto-detected candidate and gets a highlight ring */
  highlighted: boolean;
}

function HashRow({
  label,
  algo,
  hexValue,
  uppercase,
  encoding,
  matchTarget,
  matchedResult,
  highlighted,
}: HashRowProps) {
  const [copied, setCopied] = useState(false);
  const display = encodeOutput(hexValue, encoding, uppercase);
  const status =
    matchTarget !== null ? rowMatchStatus(algo, hexValue, matchTarget, matchedResult) : null;

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [display]);

  return (
    <div className={`hash-row${highlighted ? " hash-row--highlighted" : ""}`}>
      <div className="hash-row-header">
        <span className="mono-label">{label}</span>
        {status === "match" && <span className="hash-match hash-match--ok">match</span>}
        {status === "mismatch" && <span className="hash-match hash-match--fail">mismatch</span>}
      </div>
      <div className={`hash-value-wrap${copied ? " hash-value-wrap--copied" : ""}`}>
        <code className="hash-value">{display}</code>
        <button
          type="button"
          className={`hash-copy-btn${copied ? " hash-copy-btn--copied" : ""}`}
          onClick={() => void copy()}
          aria-label={`Copy ${label} hash`}
          title={copied ? "Copied!" : `Copy ${label}`}
        >
          {copied ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="hash-copy-label">Copied!</span>
            </>
          ) : (
            <CopyIcon />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Results block ──────────────────────────────────────────────────────────────

interface ResultsProps {
  result: HashResult;
  uppercase: boolean;
  encoding: OutputEncoding;
  expectedChecksum: string;
}

function Results({ result, uppercase, encoding, expectedChecksum }: ResultsProps) {
  const target = expectedChecksum.trim() ? expectedChecksum : null;
  const matched = target ? matchedAlgo(result, target) : null;

  // Auto-detect: which algos could the pasted checksum be (before compute)?
  const detected = target ? detectAlgos(target) : [];

  // For highlight: if there's no match yet but user pasted a checksum, highlight detected rows
  // If there IS a match, highlight just the matched row
  const highlightSet = new Set<AlgoName>(matched ? [matched] : detected.length > 0 ? detected : []);

  const rows: Array<{ label: string; algo: AlgoName; hex: string }> = [
    { label: "CRC32", algo: "CRC32", hex: result.crc32 },
    { label: "MD5", algo: "MD5", hex: result.md5 },
    { label: "SHA-1", algo: "SHA-1", hex: result.sha1 },
    { label: "SHA-224", algo: "SHA-224", hex: result.sha224 },
    { label: "SHA-256", algo: "SHA-256", hex: result.sha256 },
    { label: "SHA3-256", algo: "SHA3-256", hex: result.sha3_256 },
    { label: "SHA-384", algo: "SHA-384", hex: result.sha384 },
    { label: "SHA-512", algo: "SHA-512", hex: result.sha512 },
    { label: "SHA3-512", algo: "SHA3-512", hex: result.sha3_512 },
  ];

  return (
    <div className="hash-results">
      {rows.map(({ label, algo, hex }) => (
        <HashRow
          key={algo}
          label={label}
          algo={algo}
          hexValue={hex}
          uppercase={uppercase}
          encoding={encoding}
          matchTarget={target}
          matchedResult={matched}
          highlighted={highlightSet.has(algo)}
        />
      ))}
    </div>
  );
}

// ── HMAC Result ───────────────────────────────────────────────────────────────

interface HmacResultProps {
  algo: HmacAlgo;
  hexValue: string;
  uppercase: boolean;
  encoding: OutputEncoding;
}

function HmacResultRow({ algo, hexValue, uppercase, encoding }: HmacResultProps) {
  const [copied, setCopied] = useState(false);
  const display = encodeOutput(hexValue, encoding, uppercase);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [display]);

  return (
    <div className="hash-results">
      <div className="hash-row">
        <div className="hash-row-header">
          <span className="mono-label">HMAC-{algo}</span>
        </div>
        <div className={`hash-value-wrap${copied ? " hash-value-wrap--copied" : ""}`}>
          <code className="hash-value">{display}</code>
          <button
            type="button"
            className={`hash-copy-btn${copied ? " hash-copy-btn--copied" : ""}`}
            onClick={() => void copy()}
            aria-label={`Copy HMAC-${algo}`}
            title={copied ? "Copied!" : `Copy HMAC-${algo}`}
          >
            {copied ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="hash-copy-label">Copied!</span>
              </>
            ) : (
              <CopyIcon />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Verify field with inline match/algo indicator ──────────────────────────────

interface VerifyFieldProps {
  value: string;
  onChange: (v: string) => void;
  result: HashResult | null;
}

function VerifyField({ value, onChange, result }: VerifyFieldProps) {
  const trimmed = value.trim();
  const possible = trimmed ? detectAlgos(trimmed) : [];

  // If we have a computed result, check for an actual match
  const matched = result && trimmed ? matchedAlgo(result, trimmed) : null;
  const isVerifying = trimmed.length > 0 && result !== null;
  const isMatch = matched !== null;
  const isMismatch = isVerifying && !isMatch;

  return (
    <div className="hash-input-group hash-checksum-group">
      <div className="hash-verify-label-row">
        <label className="mono-label" htmlFor="hash-expected">
          Verify checksum (optional)
        </label>
        {isMatch && (
          <span className="hash-verify-badge hash-verify-badge--ok">{matched} match</span>
        )}
        {isMismatch && (
          <span className="hash-verify-badge hash-verify-badge--fail">
            {possible.length > 0 ? `no ${possible.join(" / ")} match` : "no match"}
          </span>
        )}
        {!isVerifying && possible.length > 0 && (
          <span className="hash-verify-badge hash-verify-badge--hint">{possible.join(" / ")}</span>
        )}
      </div>
      <input
        id="hash-expected"
        type="text"
        className={`hash-expected-input${isMatch ? " hash-expected-input--ok" : isMismatch ? " hash-expected-input--fail" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste expected hash to compare..."
        aria-label="Expected checksum for comparison"
        spellCheck={false}
      />
    </div>
  );
}

// ── HMAC Panel ─────────────────────────────────────────────────────────────────

const HMAC_ALGOS: HmacAlgo[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

interface HmacPanelProps {
  hmacKey: string;
  hmacAlgo: HmacAlgo;
  onKeyChange: (v: string) => void;
  onAlgoChange: (v: HmacAlgo) => void;
}

function HmacPanel({ hmacKey, hmacAlgo, onKeyChange, onAlgoChange }: HmacPanelProps) {
  return (
    <div className="hash-input-group">
      <div className="hash-hmac-row">
        <div className="hash-hmac-key-group">
          <label className="mono-label" htmlFor="hash-hmac-key">
            Secret key
          </label>
          <input
            id="hash-hmac-key"
            type="text"
            className="hash-expected-input"
            value={hmacKey}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder="Enter secret key..."
            aria-label="HMAC secret key"
            spellCheck={false}
          />
        </div>
        <div className="hash-hmac-algo-group">
          <span className="mono-label">Algorithm</span>
          <div className="space-toggle" aria-label="HMAC algorithm">
            {HMAC_ALGOS.map((a) => (
              <button
                key={a}
                type="button"
                className={`space-btn${hmacAlgo === a ? " space-btn--active" : ""}`}
                onClick={() => onAlgoChange(a)}
                aria-pressed={hmacAlgo === a}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export function App() {
  const {
    inputMode,
    toolMode,
    text,
    file,
    result,
    hmacResult,
    loading,
    error,
    uppercase,
    encoding,
    expectedChecksum,
    hmacKey,
    hmacAlgo,
    setInputMode,
    setToolMode,
    setText,
    clearText,
    setFile,
    clearFile,
    setUppercase,
    setEncoding,
    setExpectedChecksum,
    setHmacKey,
    setHmacAlgo,
    compute,
  } = useHashStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-compute when text changes (debounced 200 ms)
  useEffect(() => {
    if (inputMode !== "text") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text) return;
    debounceRef.current = setTimeout(() => {
      void compute();
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, inputMode, compute]);

  // Cmd/Ctrl+Enter triggers compute (fleet-wide power-user shortcut)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void compute();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [compute]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setFile(f);
      // compute after state update
      setTimeout(() => void compute(), 0);
      e.target.value = "";
    },
    [setFile, compute]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      setFile(f);
      setTimeout(() => void compute(), 0);
    },
    [setFile, compute]
  );

  const handleClearFile = useCallback(() => {
    clearFile();
  }, [clearFile]);

  const handleLoadExample = useCallback(() => {
    if (inputMode !== "text") setInputMode("text");
    setText(EXAMPLE_TEXT);
  }, [inputMode, setInputMode, setText]);

  return (
    <div className="app-root">
      <Header
        title="Hash Generator"
        subtitle="md5 · sha-1 · sha-256 · sha-512 · sha-3 · crc32 · hmac, private, runs in your browser"
        brandMark={
          <BrandMark label="Hash Generator">
            <HashBrandGlyph />
          </BrandMark>
        }
        controls={
          <div className="hash-header-controls">
            {/* Encoding toggle — only hex applies case; hide case toggle in base64 modes */}
            <div className="space-toggle-wrapper">
              <span className="space-toggle-label">Output</span>
              <div className="space-toggle" aria-label="Output encoding">
                {(["hex", "base64", "base64url"] as OutputEncoding[]).map((enc) => (
                  <button
                    key={enc}
                    type="button"
                    className={`space-btn${encoding === enc ? " space-btn--active" : ""}`}
                    onClick={() => setEncoding(enc)}
                    aria-pressed={encoding === enc}
                  >
                    {enc}
                  </button>
                ))}
              </div>
            </div>
            {encoding === "hex" && (
              <div className="space-toggle-wrapper">
                <span className="space-toggle-label">Case</span>
                <div className="space-toggle" aria-label="Hash case">
                  <button
                    type="button"
                    className={`space-btn${!uppercase ? " space-btn--active" : ""}`}
                    onClick={() => setUppercase(false)}
                    aria-pressed={!uppercase}
                  >
                    lower
                  </button>
                  <button
                    type="button"
                    className={`space-btn${uppercase ? " space-btn--active" : ""}`}
                    onClick={() => setUppercase(true)}
                    aria-pressed={uppercase}
                  >
                    UPPER
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      />

      <main className="site-main">
        {/* Input card */}
        <div className="card">
          {/* Tool mode + input mode + example button */}
          <div className="hash-mode-row">
            <div className="space-toggle" role="tablist" aria-label="Tool mode">
              <button
                type="button"
                role="tab"
                className={`space-btn${toolMode === "hash" ? " space-btn--active" : ""}`}
                onClick={() => setToolMode("hash")}
                aria-selected={toolMode === "hash"}
              >
                Hash
              </button>
              <button
                type="button"
                role="tab"
                className={`space-btn${toolMode === "hmac" ? " space-btn--active" : ""}`}
                onClick={() => setToolMode("hmac")}
                aria-selected={toolMode === "hmac"}
              >
                HMAC
              </button>
            </div>
            <div className="space-toggle" role="tablist" aria-label="Input mode">
              <button
                type="button"
                role="tab"
                className={`space-btn${inputMode === "text" ? " space-btn--active" : ""}`}
                onClick={() => setInputMode("text")}
                aria-selected={inputMode === "text"}
              >
                Text
              </button>
              <button
                type="button"
                role="tab"
                className={`space-btn${inputMode === "file" ? " space-btn--active" : ""}`}
                onClick={() => setInputMode("file")}
                aria-selected={inputMode === "file"}
              >
                File
              </button>
            </div>
            {inputMode === "text" && (
              <button
                type="button"
                className="hash-example-btn"
                onClick={handleLoadExample}
                aria-label="Load example text"
              >
                Try example
              </button>
            )}
          </div>

          {inputMode === "text" ? (
            <div className="hash-input-group">
              <div className="hash-input-label-row">
                <label className="mono-label" htmlFor="hash-text-input">
                  Input text
                </label>
                {text && (
                  <button
                    type="button"
                    className="hash-clear-btn"
                    onClick={clearText}
                    aria-label="Clear input"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                id="hash-text-input"
                className="hash-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  toolMode === "hmac"
                    ? "Paste or type message to sign..."
                    : "Paste or type text to hash..."
                }
                aria-label="Text to hash"
                rows={4}
              />
            </div>
          ) : (
            <div className="hash-input-group">
              <span className="mono-label">File</span>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileChange}
                aria-label="Select file to hash"
              />
              {file ? (
                <div className="hash-file-selected">
                  <div className="hash-file-info">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="hash-file-name">{file.name}</span>
                    <span className="hash-file-size">
                      {file.size < 1024
                        ? `${file.size} B`
                        : file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                    </span>
                  </div>
                  <div className="hash-file-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace
                    </button>
                    <button type="button" className="btn-secondary" onClick={handleClearFile}>
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="hash-drop-zone"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  aria-label="Drop file here or click to select"
                >
                  <svg
                    width="28"
                    height="28"
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
                  <span>Drop file here or click to select</span>
                  <span className="hash-drop-hint">Any file type · no upload · runs locally</span>
                </button>
              )}
            </div>
          )}

          {/* HMAC key + algo selector */}
          {toolMode === "hmac" && (
            <HmacPanel
              hmacKey={hmacKey}
              hmacAlgo={hmacAlgo}
              onKeyChange={setHmacKey}
              onAlgoChange={setHmacAlgo}
            />
          )}

          {/* File mode: explicit compute button (no auto-compute) */}
          {inputMode === "file" && file && (
            <div className="hash-compute-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void compute()}
                disabled={loading}
              >
                {loading ? "Computing..." : "Compute hashes"}
              </button>
              <span className="hash-compute-hint">or Cmd+Enter</span>
            </div>
          )}

          {/* HMAC: compute button always visible (key required) */}
          {toolMode === "hmac" && inputMode === "text" && (
            <div className="hash-compute-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void compute()}
                disabled={loading || !text || !hmacKey.trim()}
              >
                {loading ? "Computing..." : "Compute HMAC"}
              </button>
              <span className="hash-compute-hint">or Cmd+Enter</span>
            </div>
          )}

          {/* Checksum compare — only in hash mode */}
          {toolMode === "hash" && (
            <VerifyField value={expectedChecksum} onChange={setExpectedChecksum} result={result} />
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="hash-status" role="status" aria-live="polite">
            <span className="hash-status-dot hash-status-dot--loading" />
            <span>Computing...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="hash-status hash-status--error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {/* Results card */}
        {result && !loading && !error && toolMode === "hash" && (
          <div className="card">
            <Results
              result={result}
              uppercase={uppercase}
              encoding={encoding}
              expectedChecksum={expectedChecksum}
            />
          </div>
        )}

        {/* HMAC result card */}
        {hmacResult && !loading && !error && toolMode === "hmac" && (
          <div className="card">
            <HmacResultRow
              algo={hmacResult.algo}
              hexValue={hmacResult.hex}
              uppercase={uppercase}
              encoding={encoding}
            />
          </div>
        )}

        {/* Privacy note */}
        <p className="hash-privacy-note">
          All hashing runs locally in your browser. No data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
