import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import type { SummaryResult } from "./lib/summarizer";
import InferWorker from "./infer.worker.ts?worker";
import { useWorkerTask } from "./lib/workerTask";
import {
  MODEL_MAX_WORDS,
  SAMPLE_TEXT,
  countWords,
  extractTextFromHtml,
  formatProgress,
  formatReduction,
  formatWordCount,
  lengthLabel,
  maxWordsToMin,
  needsChunking,
  sliderToMaxWords,
} from "./lib/textHelpers";
import { useSummarizeStore } from "./store/summarizeStore";
import "./styles/summarize.css";
import { MobileWarning } from "./components/MobileWarning";
import { useCmdEnter } from "./components/useCmdEnter";

const MIN_INPUT_WORDS = 30;

// ── Brand mark glyph, condensed lines suggesting text compression ────────────
// Three lines collapsing into two: the act of summarization.

function SummarizeBrandGlyph() {
  return (
    <>
      {/* Top three input lines (teal) */}
      <line x1="4" y1="7" x2="28" y2="7" stroke="#2f9d8d" strokeWidth="2.2" strokeLinecap="round" />
      <line
        x1="4"
        y1="13"
        x2="22"
        y2="13"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="4"
        y1="19"
        x2="26"
        y2="19"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Converging arrow (amber) suggesting compression */}
      <polyline
        points="20,21 24,25 28,21"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line
        x1="24"
        y1="19"
        x2="24"
        y2="25"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Output summary line (coral), shorter, distilled */}
      <line
        x1="4"
        y1="28"
        x2="16"
        y2="28"
        stroke="#d9594c"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </>
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
      className="sum-progress-wrap"
      role="progressbar"
      tabIndex={0}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="sum-progress-track">
        <div className="sum-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sum-progress-label">
        {label}, {formatProgress(loaded, total)}
      </span>
    </div>
  );
}

// ── URL import state machine ──────────────────────────────────────────────────

type UrlState = "idle" | "loading" | "error";

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    inputText,
    summary,
    inputWords,
    outputWords,
    errorMsg,
    modelProgress,
    lengthSlider,
    chunkProgress,
    lastChunkCount,
    setInputText,
    setPhase,
    setModelProgress,
    setChunkProgress,
    setResult,
    setError,
    setLengthSlider,
    reset,
  } = useSummarizeStore();

  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlState, setUrlState] = useState<UrlState>("idle");
  const [urlError, setUrlError] = useState("");
  const [showUrlPanel, setShowUrlPanel] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "model-loading" || phase === "processing";

  const maxWords = sliderToMaxWords(lengthSlider);
  const minWords = maxWordsToMin(maxWords);
  const isLongDoc = needsChunking(inputText);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setInputText(text, countWords(text));
    },
    [setInputText]
  );

  const { run: runWorker, cancel: cancelWorker } = useWorkerTask<
    { inputText: string; minWords: number; maxWords: number },
    SummaryResult
  >();

  const handleCancel = useCallback(() => {
    cancelWorker();
    setPhase("idle");
  }, [cancelWorker, setPhase]);

  const handleSummarize = useCallback(async () => {
    if (!inputText.trim() || busy || inputWords < MIN_INPUT_WORDS) return;
    setPhase("idle");
    setPhase("model-loading");
    setChunkProgress(0, 1);
    await runWorker(
      () => new InferWorker(),
      { inputText, minWords, maxWords },
      {
        onProgress: (loaded, total, status) => {
          setModelProgress(loaded, total, status);
          setPhase("model-loading");
        },
        onChunkProgress: (done, total) => {
          setPhase("processing");
          setChunkProgress(done, total);
        },
        onResult: (result) => {
          setResult(result.summary, result.inputWords, result.outputWords, result.chunks);
        },
        onError: (message) => {
          setError(message);
        },
      }
    );
  }, [
    inputText,
    busy,
    inputWords,
    minWords,
    maxWords,
    setPhase,
    setModelProgress,
    setChunkProgress,
    setResult,
    setError,
    runWorker,
  ]);

  // Cmd/Ctrl+Enter triggers summarize
  useCmdEnter(() => {
        e.preventDefault();
        handleSummarize();
    };
    window.addEventListener("keydown", handler);
  });

  const handleCopy = useCallback(async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard not available
    }
  }, [summary]);

  const handleReset = useCallback(() => {
    reset();
    setUrlInput("");
    setUrlState("idle");
    setUrlError("");
    setShowUrlPanel(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [reset]);

  const handleClearInput = useCallback(() => {
    setInputText("", 0);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [setInputText]);

  const handleSample = useCallback(() => {
    const text = SAMPLE_TEXT;
    setInputText(text, countWords(text));
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [setInputText]);

  // ── File import ────────────────────────────────────────────────────────────

  const handleFileLoad = useCallback(
    (file: File) => {
      const allowed = ["text/plain", "text/markdown", "text/x-markdown", ""];
      const extOk = /\.(txt|md)$/i.test(file.name);
      if (!allowed.includes(file.type) && !extOk) {
        setError("Unsupported file type. Please import a .txt or .md file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        const wordCount = countWords(text);
        if (wordCount === 0) {
          setError("The file appears to be empty.");
          return;
        }
        setInputText(text, wordCount);
        setTimeout(() => textareaRef.current?.focus(), 50);
      };
      reader.onerror = () => setError("Failed to read the file.");
      reader.readAsText(file);
    },
    [setInputText, setError]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileLoad(file);
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [handleFileLoad]
  );

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the panel, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileLoad(file);
    },
    [handleFileLoad]
  );

  // ── URL import ─────────────────────────────────────────────────────────────

  const handleUrlFetch = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    let url: URL;
    try {
      url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    } catch {
      setUrlError("Enter a valid URL (e.g. https://example.com/article).");
      return;
    }

    setUrlState("loading");
    setUrlError("");

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}.`);
      }
      const contentType = res.headers.get("content-type") ?? "";
      let text: string;
      if (contentType.includes("text/html")) {
        const html = await res.text();
        text = extractTextFromHtml(html);
      } else {
        text = await res.text();
      }

      const wordCount = countWords(text);
      if (wordCount < MIN_INPUT_WORDS) {
        setUrlState("error");
        setUrlError(
          "Could not extract enough text from that page. Try copying and pasting the article text directly."
        );
        return;
      }

      setInputText(text, wordCount);
      setUrlState("idle");
      setShowUrlPanel(false);
      setUrlInput("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err) {
      setUrlState("error");
      const msg = err instanceof Error ? err.message : "Unknown error";
      // CORS failures show as network errors
      const isCors =
        msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror");
      setUrlError(
        isCors
          ? "This page blocked direct access (CORS). Copy and paste the article text instead."
          : `Could not fetch: ${msg}`
      );
    }
  }, [urlInput, setInputText]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleUrlFetch();
    },
    [handleUrlFetch]
  );

  // ── Chunk processing label ─────────────────────────────────────────────────

  const chunkLabel =
    phase === "processing" && chunkProgress.total > 1
      ? `Summarizing chunk ${chunkProgress.done + 1} of ${chunkProgress.total}...`
      : "Summarizing...";

  const reduction = summary ? formatReduction(inputWords, outputWords) : "";

  return (
    <div className="app-root">
      <Header
        title="Text Summarizer"
        subtitle="abstractive summarization, free, private, runs in your browser"
        brandMark={
          <BrandMark label="Text Summarizer">
            <SummarizeBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <MobileWarning />
        {/* Beta notice */}
        <p className="sum-beta-note">
          <strong>Beta</strong>, first run downloads a model (~80 MB), then it is instant &amp;
          offline. Your text never leaves your device.
        </p>

        <div className="card">
          {/* Two-column input / output */}
          <div className="sum-layout">
            {/* Input panel */}
            <div
              className={`sum-panel${isDragging ? " sum-panel--dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="sum-panel-header">
                <span className="sum-panel-label">Input</span>
                <span className="sum-input-meta" aria-live="polite">
                  {inputWords > 0 ? (
                    <>
                      <span className="sum-word-count">{formatWordCount(inputWords)}</span>
                      {inputWords < MIN_INPUT_WORDS && (
                        <span className="sum-min-hint">
                          need {MIN_INPUT_WORDS - inputWords} more
                        </span>
                      )}
                      {isLongDoc && (
                        <span
                          className="sum-long-doc-hint"
                          title={`Over ${MODEL_MAX_WORDS} words; will be processed in chunks`}
                        >
                          long doc
                        </span>
                      )}
                    </>
                  ) : null}
                </span>
                <span className="sum-input-actions">
                  {inputWords > 0 && !busy && (
                    <>
                      <button
                        type="button"
                        className="sum-inline-btn"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Import a text file"
                        title="Import .txt or .md file"
                      >
                        Import
                      </button>
                      <button
                        type="button"
                        className="sum-inline-btn"
                        onClick={handleClearInput}
                        aria-label="Clear input text"
                      >
                        Clear
                      </button>
                    </>
                  )}
                  {inputWords === 0 && !busy && (
                    <>
                      <button
                        type="button"
                        className="sum-inline-btn"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Import a text file"
                        title="Import .txt or .md file"
                      >
                        Import
                      </button>
                      <button
                        type="button"
                        className={`sum-inline-btn${showUrlPanel ? " sum-inline-btn--active" : ""}`}
                        onClick={() => setShowUrlPanel((v) => !v)}
                        aria-label="Load text from a URL"
                        title="Fetch article from URL"
                      >
                        URL
                      </button>
                      <button
                        type="button"
                        className="sum-inline-btn"
                        onClick={handleSample}
                        aria-label="Load a sample text"
                      >
                        Sample
                      </button>
                    </>
                  )}
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFileInputChange}
                style={{ display: "none" }}
                aria-label="Import text file"
              />

              {/* URL import panel */}
              {showUrlPanel && inputWords === 0 && (
                <div className="sum-url-panel">
                  <div className="sum-url-row">
                    <input
                      type="url"
                      className="sum-url-input"
                      placeholder="https://example.com/article"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={handleUrlKeyDown}
                      aria-label="Article URL"
                      disabled={urlState === "loading"}
                    />
                    <button
                      type="button"
                      className="btn-primary sum-url-fetch-btn"
                      onClick={handleUrlFetch}
                      disabled={urlState === "loading" || !urlInput.trim()}
                      aria-label="Fetch article from URL"
                    >
                      {urlState === "loading" ? "Loading..." : "Fetch"}
                    </button>
                  </div>
                  {urlState === "error" && urlError && <p className="sum-url-error">{urlError}</p>}
                  <p className="sum-url-note">
                    Works for pages that allow cross-origin requests. Paywalled or CORS-blocked
                    sites will need copy-paste instead.
                  </p>
                </div>
              )}

              {/* Drag-drop overlay */}
              {isDragging && (
                <div className="sum-drag-overlay" aria-hidden="true">
                  Drop .txt or .md file
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="sum-textarea"
                placeholder="Paste your article, report, or long text here..."
                value={inputText}
                onChange={handleTextChange}
                disabled={busy}
                aria-label="Text to summarize"
                spellCheck={false}
              />

              {/* Long-doc notice below textarea */}
              {isLongDoc && !busy && (
                <p className="sum-long-doc-notice">
                  Long document detected ({formatWordCount(inputWords)} / model limit ~
                  {MODEL_MAX_WORDS} words). Will be summarized in chunks automatically.
                </p>
              )}
            </div>

            {/* Output panel */}
            <div className="sum-panel">
              <div className="sum-panel-header">
                <span className="sum-panel-label">Summary</span>
                {phase === "done" && outputWords > 0 && (
                  <span className="sum-word-count" aria-live="polite">
                    {formatWordCount(outputWords)}
                    {reduction && (
                      <span className="sum-reduction" style={{ marginLeft: "0.4rem" }}>
                        {reduction}
                      </span>
                    )}
                    {lastChunkCount > 1 && (
                      <span
                        className="sum-chunk-badge"
                        title={`Processed in ${lastChunkCount} chunks`}
                      >
                        {lastChunkCount} chunks
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div
                className={`sum-output${
                  phase === "done" && summary
                    ? ""
                    : phase === "model-loading" || phase === "processing"
                      ? " sum-output--loading"
                      : " sum-output--placeholder"
                }`}
                aria-live="polite"
                aria-label="Summary output"
              >
                {(phase === "idle" || (phase === "error" && !summary)) &&
                  "Your summary will appear here."}

                {phase === "model-loading" && (
                  <>
                    <ProgressBar
                      loaded={modelProgress.loaded}
                      total={modelProgress.total}
                      label="Downloading model"
                    />
                    <span className="sum-progress-label" style={{ marginTop: "0.25rem" }}>
                      One-time download (~80 MB). Saved in your browser cache.
                    </span>
                  </>
                )}

                {phase === "processing" && (
                  <>
                    <div className="sum-spinner" aria-label="Summarizing..." />
                    <span className="sum-spinner-label">{chunkLabel}</span>
                    {chunkProgress.total > 1 && (
                      <ProgressBar
                        loaded={chunkProgress.done}
                        total={chunkProgress.total}
                        label="Chunk progress"
                      />
                    )}
                  </>
                )}

                {phase === "done" && summary && summary}

                {phase === "error" && !summary && (
                  <span style={{ color: "#d9594c" }}>{errorMsg}</span>
                )}
              </div>

              {/* Output actions (copy / reset) */}
              {phase === "done" && summary && (
                <div className="sum-output-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleCopy}
                    aria-label="Copy summary to clipboard"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleReset}>
                    Clear
                  </button>
                </div>
              )}

              {phase === "error" && (
                <div className="sum-error-wrap">
                  <p className="sum-error-msg">{errorMsg}</p>
                  <button type="button" className="btn-secondary" onClick={handleReset}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="sum-controls">
            <div className="sum-length-group">
              <span className="sum-length-label">
                Summary length, {lengthLabel(maxWords)} (~{maxWords} words)
              </span>
              <div className="sum-length-slider">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={lengthSlider}
                  onChange={(e) => setLengthSlider(Number(e.target.value))}
                  aria-label="Summary length"
                  aria-valuetext={`${lengthLabel(maxWords)}, about ${maxWords} words`}
                  disabled={busy}
                />
                <span className="sum-length-value mono-label">{maxWords}w</span>
              </div>
            </div>

            <div className="sum-submit-wrap">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSummarize}
                disabled={busy || inputWords < MIN_INPUT_WORDS}
                aria-label="Summarize text"
                title={
                  inputWords < MIN_INPUT_WORDS
                    ? `Add ${MIN_INPUT_WORDS - inputWords} more words to summarize`
                    : "Summarize (Cmd+Enter)"
                }
              >
                {busy ? "Working..." : "Summarize"}
              </button>
              {busy && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCancel}
                  aria-label="Cancel summarization"
                >
                  Cancel
                </button>
              )}
              {inputWords > 0 && inputWords < MIN_INPUT_WORDS && (
                <span className="sum-submit-hint" aria-live="polite">
                  {MIN_INPUT_WORDS - inputWords} more word
                  {MIN_INPUT_WORDS - inputWords !== 1 ? "s" : ""} needed ({inputWords}/
                  {MIN_INPUT_WORDS})
                </span>
              )}
              {!busy && inputWords >= MIN_INPUT_WORDS && (
                <span className="sum-kbd-hint" aria-hidden="true">
                  <kbd>Cmd</kbd>+<kbd>Enter</kbd>
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer blurb="Runs entirely in your browser. Your text never leaves your device." />
    </div>
  );
}
