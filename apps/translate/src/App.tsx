import { useCallback, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { LanguagePicker } from "./components/LanguagePicker";
import {
  DETECT_CODE,
  HARD_MAX_CHARS,
  LANGUAGES,
  MAX_INPUT_CHARS,
  findLanguage,
  validateLanguagePair,
} from "./lib/languages";
import { isTranslatorLoaded, loadTranslator, translateText } from "./lib/translator";
import { useTranslateStore } from "./store/translateStore";
import "./styles/translate.css";
import { MobileWarning } from "./components/MobileWarning";

// ── Brand glyph: globe + bidirectional arrows ─────────────────────────────────

function TranslateBrandGlyph() {
  return (
    <>
      {/* Globe outline */}
      <circle cx="16" cy="16" r="12" stroke="#2f9d8d" strokeWidth="2.2" />
      {/* Longitude arc */}
      <ellipse cx="16" cy="16" rx="5.5" ry="12" stroke="#2f9d8d" strokeWidth="1.4" />
      {/* Equator line */}
      <line x1="4" y1="16" x2="28" y2="16" stroke="#2f9d8d" strokeWidth="1.4" />
      {/* Arrow right (amber) */}
      <path d="M9 11 L14 11" stroke="#e8b04b" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M12.5 9 L14.5 11 L12.5 13"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow left (coral) */}
      <path d="M23 21 L18 21" stroke="#d9594c" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M19.5 23 L17.5 21 L19.5 19"
        stroke="#d9594c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

// ── Progress bar component ────────────────────────────────────────────────────

function ProgressBar({ loaded, total, label }: { loaded: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div
      className="tr-progress-bar-wrap"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      tabIndex={0}
    >
      <div className="tr-progress-track">
        <div className="tr-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="tr-progress-label">
        {label}, {pct}%
      </span>
    </div>
  );
}

// ── Swap icon ─────────────────────────────────────────────────────────────────

function SwapIcon() {
  return (
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
      <path d="M7 16V4m0 0L3 8m4-4 4 4" />
      <path d="M17 8v12m0 0 4-4m-4 4-4-4" />
    </svg>
  );
}

// ── Copy icon ─────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
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

// ── Download icon ─────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ── Upload icon ───────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    sourceText,
    targetText,
    sourceLang,
    targetLang,
    detectedLang,
    errorMsg,
    modelProgress,
    chunkProgress,
    setSourceText,
    setSourceLang,
    setTargetLang,
    setPhase,
    setModelProgress,
    setChunkProgress,
    setResult,
    setError,
    swapLanguages,
  } = useTranslateStore();

  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = sourceText.length;
  const charOver = charCount > HARD_MAX_CHARS;
  const charWarn = charCount > MAX_INPUT_CHARS * 0.85;

  const busy = phase === "model-loading" || phase === "translating";

  const handleTranslate = useCallback(async () => {
    const validationErr = validateLanguagePair(sourceLang, targetLang);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    if (!sourceText.trim()) return;
    if (charOver) {
      setError(
        `Input exceeds ${HARD_MAX_CHARS.toLocaleString()} characters. Please shorten your text.`
      );
      return;
    }

    try {
      if (!isTranslatorLoaded()) {
        setPhase("model-loading");
        await loadTranslator((loaded, total, status) => {
          setModelProgress(loaded, total, status);
        });
      }
      setPhase("translating");
      const { translatedText, resolvedSourceLang } = await translateText(
        sourceText,
        sourceLang,
        targetLang,
        (done, total) => {
          if (total > 1) setChunkProgress(done, total);
        }
      );
      setResult(translatedText, sourceLang === DETECT_CODE ? resolvedSourceLang : undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error during translation.";
      setError(msg);
    }
  }, [
    sourceText,
    sourceLang,
    targetLang,
    charOver,
    setPhase,
    setModelProgress,
    setChunkProgress,
    setResult,
    setError,
  ]);

  // Cmd/Ctrl+Enter triggers translation from the source textarea
  const handleSourceKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!busy && sourceText.trim() && !charOver) {
          handleTranslate();
        }
      }
    },
    [busy, sourceText, charOver, handleTranslate]
  );

  const handleCopy = useCallback(async () => {
    if (!targetText) return;
    try {
      await navigator.clipboard.writeText(targetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard write can fail (permission denied, non-secure context).
      // Silently ignore -- the user can still select and copy manually.
    }
  }, [targetText]);

  const handleDownload = useCallback(() => {
    if (!targetText) return;
    const targetLabel = findLanguage(targetLang)?.label ?? targetLang;
    const blob = new Blob([targetText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translation-${targetLabel.toLowerCase().replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [targetText, targetLang]);

  const handleFileLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so the same file can be selected again if needed
      e.target.value = "";
      if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
        setError("Only plain-text (.txt) files are supported.");
        return;
      }
      if (file.size > HARD_MAX_CHARS * 4) {
        // 4 bytes/char upper bound
        setError(
          `File is too large. Maximum supported size is ~${Math.round(HARD_MAX_CHARS / 1000)}K characters.`
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        if (text.length > HARD_MAX_CHARS) {
          setError(
            `File contains ${text.length.toLocaleString()} characters, which exceeds the ${HARD_MAX_CHARS.toLocaleString()} limit.`
          );
          return;
        }
        setSourceText(text);
      };
      reader.onerror = () => {
        setError("Could not read the file. Please try again.");
      };
      reader.readAsText(file, "utf-8");
    },
    [setSourceText, setError]
  );

  // Show model-size warning only when translation has never happened yet
  const modelNeverLoaded = !isTranslatorLoaded() && phase !== "done" && phase !== "translating";

  // Detect badge: what language was detected
  const detectedLangLabel = detectedLang ? findLanguage(detectedLang)?.label : null;

  return (
    <div className="app-root">
      <Header
        title="AI Translator"
        subtitle="translate between 200+ languages, free, private, runs in your browser"
        brandMark={
          <BrandMark label="AI Translator">
            <TranslateBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <MobileWarning />
        {/* Model size notice -- shown only before first load so it does not
            clutter the UI once the model is cached */}
        {modelNeverLoaded && (
          <p className="tr-beta-note">
            <strong>Private &amp; offline.</strong> First run downloads the model (~600 MB, one-time
            -- bigger than usual because it covers 200 languages). After that it runs entirely in
            your browser with no internet.
          </p>
        )}

        <div className="card">
          {/* ── Language selector ── */}
          <div className="tr-lang-bar">
            <div className="tr-lang-picker-wrap">
              <LanguagePicker
                id="source-lang"
                label="From"
                value={sourceLang}
                languages={LANGUAGES}
                onChange={setSourceLang}
                disabled={busy}
                showDetect
              />
              {sourceLang === DETECT_CODE && detectedLangLabel && phase === "done" && (
                <span className="tr-detected-badge">detected: {detectedLangLabel}</span>
              )}
            </div>

            <button
              type="button"
              className="tr-swap-btn"
              onClick={swapLanguages}
              disabled={busy}
              aria-label="Swap source and target languages"
              title="Swap languages"
            >
              <SwapIcon />
            </button>

            <LanguagePicker
              id="target-lang"
              label="To"
              value={targetLang}
              languages={LANGUAGES}
              onChange={setTargetLang}
              disabled={busy}
            />
          </div>

          {/* ── Text panels ── */}
          <div className="tr-panels">
            <div className="tr-panel">
              <div className="tr-panel-header">
                <span className="tr-panel-label">Source text</span>
                <div className="tr-panel-header-actions">
                  {/* File load button */}
                  <button
                    type="button"
                    className="tr-clear-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    aria-label="Load text from .txt file"
                    title="Load .txt file"
                  >
                    <UploadIcon />
                    Load file
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="tr-file-input"
                    onChange={handleFileLoad}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  {sourceText && !busy && (
                    <button
                      type="button"
                      className="tr-clear-btn"
                      onClick={() => setSourceText("")}
                      aria-label="Clear source text"
                      title="Clear"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="source-text"
                className="tr-textarea"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                onKeyDown={handleSourceKeyDown}
                placeholder="Type or paste text, or load a .txt file..."
                aria-label="Source text"
                disabled={busy}
                spellCheck
              />
              <div className="tr-source-footer">
                <span
                  className={`tr-char-count${charOver ? " tr-char-count--over" : charWarn ? " tr-char-count--warn" : ""}`}
                  aria-live="polite"
                >
                  {charCount.toLocaleString()}
                  {charOver
                    ? ` / ${HARD_MAX_CHARS.toLocaleString()} (too long)`
                    : charCount > MAX_INPUT_CHARS
                      ? " (long text: will translate in chunks)"
                      : ""}
                </span>
                <span className="tr-kbd-hint">
                  {navigator.platform?.startsWith("Mac") ? "Cmd" : "Ctrl"}+Enter to translate
                </span>
              </div>
            </div>

            <div className="tr-panel">
              <div className="tr-panel-header">
                <span className="tr-panel-label">Translation</span>
              </div>
              <textarea
                id="target-text"
                className={`tr-textarea tr-textarea--output${targetText ? " tr-textarea--has-result" : ""}`}
                value={targetText}
                readOnly
                placeholder="Translation appears here..."
                aria-label="Translation output"
                aria-live="polite"
              />
              {targetText && (
                <div className="tr-actions">
                  <button
                    type="button"
                    className="tr-copy-btn"
                    onClick={handleCopy}
                    aria-label="Copy translation to clipboard"
                  >
                    <CopyIcon />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className="tr-copy-btn"
                    onClick={handleDownload}
                    aria-label="Download translation as .txt file"
                  >
                    <DownloadIcon />
                    Download .txt
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Model loading progress ── */}
          {phase === "model-loading" && (
            <div className="tr-progress-wrap" aria-live="polite">
              <ProgressBar
                loaded={modelProgress.loaded}
                total={modelProgress.total}
                label="Downloading model"
              />
              <p className="tr-progress-sub">
                One-time download (~600 MB, covers 200 languages). Saved in your browser cache --
                future translations are instant.
              </p>
            </div>
          )}

          {/* ── Translating spinner / chunk progress ── */}
          {phase === "translating" && (
            <div className="tr-progress-wrap" aria-live="polite">
              {chunkProgress && chunkProgress.total > 1 ? (
                <>
                  <ProgressBar
                    loaded={chunkProgress.done}
                    total={chunkProgress.total}
                    label={`Translating chunk ${chunkProgress.done} of ${chunkProgress.total}`}
                  />
                  <p className="tr-progress-sub">
                    Long text split into {chunkProgress.total} chunks for better accuracy.
                  </p>
                </>
              ) : (
                <div className="tr-translating-row">
                  <div className="tr-spinner" aria-label="Translating..." />
                  <span>Translating...</span>
                </div>
              )}
            </div>
          )}

          {/* ── Error ── */}
          {phase === "error" && errorMsg && (
            <p className="tr-error" role="alert">
              {errorMsg}
            </p>
          )}

          {/* ── Translate button ── */}
          <div className="tr-actions" style={{ marginTop: "1.25rem" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleTranslate}
              disabled={busy || !sourceText.trim() || charOver}
              aria-label="Translate text"
            >
              {busy ? "Translating..." : "Translate"}
            </button>
          </div>
        </div>
      </main>

      <Footer blurb="Runs entirely in your browser. Your text never leaves your device." />
    </div>
  );
}
