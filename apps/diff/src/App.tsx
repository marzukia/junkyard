import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { buildUnifiedPatch, computeDiff, LARGE_INPUT_LINE_THRESHOLD, wordLevelStats } from "./lib/diff";
import type { InlineLine, SideBySideLine, WordChange } from "./lib/diff";
import type { DiffLevel, ViewMode } from "./store/diffStore";
import { useDiffStore } from "./store/diffStore";

// ─── Brand glyph ─────────────────────────────────────────────────────────────
// Two overlapping document shapes with a vertical bar, symbolises diff/compare.
// Flat, no background square, brand palette.

function DiffBrandGlyph() {
  return (
    <>
      {/* Left column: three teal text lines */}
      <line x1="3" y1="9" x2="13" y2="9" stroke="#2f9d8d" strokeWidth="2.4" strokeLinecap="round" />
      <line
        x1="3"
        y1="14"
        x2="13"
        y2="14"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="19"
        x2="10"
        y2="19"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Coral minus, removed line marker */}
      <line
        x1="3"
        y1="25.5"
        x2="8"
        y2="25.5"
        stroke="#d9594c"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Thin coral centre divider */}
      <line
        x1="16"
        y1="5"
        x2="16"
        y2="27"
        stroke="#d9594c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Right column: three teal text lines */}
      <line
        x1="19"
        y1="9"
        x2="29"
        y2="9"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="19"
        y1="14"
        x2="26"
        y2="14"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="19"
        y1="19"
        x2="29"
        y2="19"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Amber plus, added line marker */}
      <line
        x1="21.5"
        y1="25.5"
        x2="26.5"
        y2="25.5"
        stroke="#e8b04b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="23"
        x2="24"
        y2="28"
        stroke="#e8b04b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </>
  );
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const EXAMPLE_LEFT = `The quick brown fox jumps over the lazy dog.
Pack my box with five dozen liquor jugs.
How vexingly quick daft zebras jump!
The five boxing wizards jump quickly.`;

const EXAMPLE_RIGHT = `The quick brown fox leaps over the lazy cat.
Pack my crate with five dozen liquor jugs.
How surprisingly quick daft zebras jump!
The five boxing wizards jump quickly.
A new line was added at the end.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function WordSpans({ words }: { words: WordChange[] }) {
  return (
    <>
      {words.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: word tokens have no stable id; index is safe here since the array is derived from immutable diff output and never reordered
        <span key={i} className={w.kind !== "equal" ? `diff-word diff-word--${w.kind}` : undefined}>
          {w.value}
        </span>
      ))}
    </>
  );
}

function LineNo({ n }: { n: number | null }) {
  return (
    <span className="diff-lineno" aria-hidden="true">
      {n != null ? String(n) : ""}
    </span>
  );
}

// ─── File drop zone input ─────────────────────────────────────────────────────

interface FileDropInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
}

function FileDropInput({ id, label, value, onChange, placeholder, ariaLabel }: FileDropInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      // Reject obviously binary files by MIME type prefix
      if (file.type && !file.type.startsWith("text/") && file.type !== "application/json") {
        setFileError(`Cannot read "${file.name}" — only text files are supported.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === "string") {
          onChange(text);
          setFileError(null);
        }
      };
      reader.onerror = () => {
        setFileError(`Failed to read "${file.name}".`);
      };
      reader.readAsText(file);
    },
    [onChange]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="diff-input-col">
      <div className="diff-input-label-row">
        <label className="diff-input-label" htmlFor={id}>
          {label}
        </label>
        <>
          {/* Visually hidden file input; triggered by button below so keyboard users can reach it */}
          <input
            ref={fileInputRef}
            type="file"
            accept="text/*,.patch,.diff,.json,.md,.csv,.ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h"
            style={{ position: "absolute", opacity: 0, width: 0, height: 0, overflow: "hidden" }}
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              // Reset so the same file can be re-selected
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="diff-file-btn"
            title="Load from file"
            onClick={() => fileInputRef.current?.click()}
          >
            Load file
          </button>
        </>
      </div>
      {fileError != null && (
        <span className="diff-file-error" role="alert">
          {fileError}
        </span>
      )}
      <textarea
        id={id}
        className={`diff-textarea${isDragging ? " diff-textarea--drag" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        aria-label={ariaLabel}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />
    </div>
  );
}

// ─── Controls toolbar ─────────────────────────────────────────────────────────

interface ToolbarProps {
  viewMode: ViewMode;
  diffLevel: DiffLevel;
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  onViewMode: (m: ViewMode) => void;
  onDiffLevel: (l: DiffLevel) => void;
  onIgnoreWhitespace: (v: boolean) => void;
  onIgnoreCase: (v: boolean) => void;
  onSwap: () => void;
  onClear: () => void;
  onExample: () => void;
  hasContent: boolean;
}

function Toolbar({
  viewMode,
  diffLevel,
  ignoreWhitespace,
  ignoreCase,
  onViewMode,
  onDiffLevel,
  onIgnoreWhitespace,
  onIgnoreCase,
  onSwap,
  onClear,
  onExample,
  hasContent,
}: ToolbarProps) {
  return (
    <div className="diff-toolbar">
      <div className="diff-toolbar-left">
        <div className="space-toggle-wrapper">
          <span className="space-toggle-label">View</span>
          <div className="space-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`space-btn${viewMode === "split" ? " space-btn--active" : ""}`}
              onClick={() => onViewMode("split")}
              aria-pressed={viewMode === "split"}
            >
              Split
            </button>
            <button
              type="button"
              className={`space-btn${viewMode === "inline" ? " space-btn--active" : ""}`}
              onClick={() => onViewMode("inline")}
              aria-pressed={viewMode === "inline"}
            >
              Inline
            </button>
          </div>
        </div>
        <div className="space-toggle-wrapper">
          <span className="space-toggle-label">Level</span>
          <div className="space-toggle" role="group" aria-label="Diff level">
            <button
              type="button"
              className={`space-btn${diffLevel === "word" ? " space-btn--active" : ""}`}
              onClick={() => onDiffLevel("word")}
              aria-pressed={diffLevel === "word"}
            >
              Word
            </button>
            <button
              type="button"
              className={`space-btn${diffLevel === "line" ? " space-btn--active" : ""}`}
              onClick={() => onDiffLevel("line")}
              aria-pressed={diffLevel === "line"}
            >
              Line
            </button>
          </div>
        </div>
        <div className="space-toggle-wrapper">
          <span className="space-toggle-label">Ignore</span>
          <div className="space-toggle" aria-label="Ignore options">
            <button
              type="button"
              className={`space-btn${ignoreWhitespace ? " space-btn--active" : ""}`}
              onClick={() => onIgnoreWhitespace(!ignoreWhitespace)}
              aria-pressed={ignoreWhitespace}
              title="Ignore leading/trailing whitespace and collapse internal spaces"
            >
              Whitespace
            </button>
            <button
              type="button"
              className={`space-btn${ignoreCase ? " space-btn--active" : ""}`}
              onClick={() => onIgnoreCase(!ignoreCase)}
              aria-pressed={ignoreCase}
              title="Ignore letter case when comparing"
            >
              Case
            </button>
          </div>
        </div>
      </div>
      <div className="diff-toolbar-right">
        {!hasContent && (
          <button
            type="button"
            className="btn-secondary diff-example-btn"
            onClick={onExample}
            aria-label="Load example text"
          >
            Try example
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={onSwap}
          disabled={!hasContent}
          aria-label="Swap left and right"
          title="Swap left and right"
        >
          Swap
        </button>
        {hasContent && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onClear}
            aria-label="Clear both inputs"
            title="Clear (Esc)"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Input panes ─────────────────────────────────────────────────────────────

interface InputPanesProps {
  leftText: string;
  rightText: string;
  onLeft: (v: string) => void;
  onRight: (v: string) => void;
}

function InputPanes({ leftText, rightText, onLeft, onRight }: InputPanesProps) {
  return (
    <div className="diff-input-grid">
      <FileDropInput
        id="diff-left"
        label="Original"
        value={leftText}
        onChange={onLeft}
        placeholder="Paste original text or drop a file here..."
        ariaLabel="Original text"
      />
      <FileDropInput
        id="diff-right"
        label="Modified"
        value={rightText}
        onChange={onRight}
        placeholder="Paste modified text or drop a file here..."
        ariaLabel="Modified text"
      />
    </div>
  );
}

// ─── Stats bar ───────────────────────────────────────────────────────────────

interface StatsBarProps {
  added: number;
  removed: number;
  unchanged: number;
  wordAdded: number;
  wordRemoved: number;
  changeCount: number;
  currentChange: number | null;
  onPrev: () => void;
  onNext: () => void;
}

function StatsBar({
  added,
  removed,
  unchanged,
  wordAdded,
  wordRemoved,
  changeCount,
  currentChange,
  onPrev,
  onNext,
}: StatsBarProps) {
  return (
    <div className="diff-stats">
      <span className="diff-stat diff-stat--added">+{added} lines</span>
      <span className="diff-stat diff-stat--removed">{removed} lines</span>
      <span className="diff-stat diff-stat--equal">{unchanged} unchanged</span>
      {(wordAdded > 0 || wordRemoved > 0) && (
        <>
          <span className="diff-stat-sep">·</span>
          <span className="diff-stat diff-stat--added">+{wordAdded} words</span>
          <span className="diff-stat diff-stat--removed">{wordRemoved} words</span>
        </>
      )}
      {changeCount > 0 && (
        <>
          <span className="diff-stat-sep">·</span>
          <div className="diff-nav" aria-label="Navigate changes">
            <button
              type="button"
              className="diff-nav-btn"
              onClick={onPrev}
              aria-label="Previous change"
              title="Previous change"
            >
              ↑
            </button>
            <span className="diff-nav-count" aria-live="polite">
              {currentChange != null
                ? `${currentChange + 1} / ${changeCount}`
                : `${changeCount} changes`}
            </span>
            <button
              type="button"
              className="diff-nav-btn"
              onClick={onNext}
              aria-label="Next change"
              title="Next change"
            >
              ↓
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Identical banner ─────────────────────────────────────────────────────────

function IdenticalBanner() {
  return (
    <output className="diff-identical-banner" aria-label="Texts are identical">
      <span className="diff-identical-icon" aria-hidden="true">
        ✓
      </span>
      <span className="diff-identical-text">Texts are identical</span>
      <span className="diff-identical-sub">No differences found between the two inputs.</span>
    </output>
  );
}

// ─── Split diff view ─────────────────────────────────────────────────────────

interface SplitViewProps {
  lines: SideBySideLine[];
  showWords: boolean;
  changeRefs: React.RefObject<Map<number, HTMLElement>>;
}

function SplitView({ lines, showWords, changeRefs }: SplitViewProps) {
  let changeIdx = -1;
  return (
    <div className="diff-output diff-output--split" aria-label="Side by side diff">
      <div className="diff-split-col diff-split-col--left">
        <div className="diff-col-header">Original</div>
        {lines.map((line, i) => {
          const isChange = line.kind !== "equal";
          if (isChange) changeIdx++;
          const ci = changeIdx;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable id; index is safe (pure derived array, no reorder)
              key={i}
              className={`diff-row diff-row--${line.kind}`}
              ref={
                isChange
                  ? (el) => {
                      if (el) changeRefs.current?.set(ci, el);
                    }
                  : undefined
              }
            >
              <LineNo n={line.leftNo} />
              <span className="diff-cell">
                {line.leftText != null ? (
                  showWords && line.leftWords != null ? (
                    <WordSpans words={line.leftWords} />
                  ) : (
                    line.leftText
                  )
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      <div className="diff-split-col diff-split-col--right">
        <div className="diff-col-header">Modified</div>
        {lines.map((line, i) => {
          const rightKind = line.kind === "removed" ? "equal diff-row--empty" : line.kind;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable id; index is safe (pure derived array, no reorder)
            <div key={i} className={`diff-row diff-row--${rightKind}`}>
              <LineNo n={line.rightNo} />
              <span className="diff-cell">
                {line.rightText != null ? (
                  showWords && line.rightWords != null ? (
                    <WordSpans words={line.rightWords} />
                  ) : (
                    line.rightText
                  )
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inline diff view ────────────────────────────────────────────────────────

interface InlineViewProps {
  lines: InlineLine[];
  showWords: boolean;
  changeRefs: React.RefObject<Map<number, HTMLElement>>;
}

function InlineView({ lines, showWords, changeRefs }: InlineViewProps) {
  let changeIdx = -1;
  // Track which logical change group we're in; consecutive non-equal lines share a group
  let lastWasChange = false;

  return (
    <div className="diff-output diff-output--inline" aria-label="Inline diff">
      <div className="diff-col-header diff-col-header--inline">Changes</div>
      {lines.map((line, i) => {
        const isChange = line.kind !== "equal";
        if (isChange && !lastWasChange) changeIdx++;
        lastWasChange = isChange;
        const ci = changeIdx;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable id; index is safe (pure derived array, no reorder)
            key={i}
            className={`diff-row diff-row--${line.kind}`}
            ref={
              isChange && line.kind === "removed"
                ? (el) => {
                    if (el) changeRefs.current?.set(ci, el);
                  }
                : isChange && line.kind === "added" && !lastWasChange
                  ? (el) => {
                      if (el) changeRefs.current?.set(ci, el);
                    }
                  : undefined
            }
          >
            <span className="diff-prefix" aria-hidden="true">
              {line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}
            </span>
            <LineNo n={line.no} />
            <span className="diff-cell">
              {showWords && line.words != null ? <WordSpans words={line.words} /> : line.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard not available
    }
  }, [getText]);

  return (
    <button type="button" className="btn-secondary diff-copy-btn" onClick={() => void copy()}>
      {copied ? "Copied!" : "Copy diff"}
    </button>
  );
}

// ─── Download patch button ────────────────────────────────────────────────────

function DownloadButton({ getPatch }: { getPatch: () => string }) {
  const download = useCallback(() => {
    const text = getPatch();
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diff.patch";
    a.click();
    URL.revokeObjectURL(url);
  }, [getPatch]);

  return (
    <button type="button" className="btn-secondary diff-copy-btn" onClick={download}>
      Download .patch
    </button>
  );
}

// ─── Change navigation helpers ────────────────────────────────────────────────

/**
 * Count the number of distinct change groups in a side-by-side diff.
 * A group is a contiguous run of non-equal lines.
 */
function countChanges(lines: SideBySideLine[]): number {
  let count = 0;
  let inGroup = false;
  for (const line of lines) {
    if (line.kind !== "equal") {
      if (!inGroup) {
        count++;
        inGroup = true;
      }
    } else {
      inGroup = false;
    }
  }
  return count;
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function App() {
  const {
    leftText,
    rightText,
    viewMode,
    diffLevel,
    ignoreWhitespace,
    ignoreCase,
    setLeftText,
    setRightText,
    setViewMode,
    setDiffLevel,
    setIgnoreWhitespace,
    setIgnoreCase,
    swap,
    clear,
  } = useDiffStore();

  // On narrow viewports, override split -> inline so the result is readable.
  // User can still manually switch back via the toolbar.
  const [isMobileWidth, setIsMobileWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 700 : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const handler = (e: MediaQueryListEvent) => setIsMobileWidth(e.matches);
    mq.addEventListener("change", handler);
    setIsMobileWidth(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // On mobile, if the persisted preference is "split", silently display inline.
  // The store value stays as-is so switching back to desktop restores it.
  const effectiveViewMode: ViewMode = isMobileWidth && viewMode === "split" ? "inline" : viewMode;

  const hasContent = leftText.trim().length > 0 || rightText.trim().length > 0;
  const hasBothSides = leftText.trim().length > 0 && rightText.trim().length > 0;

  const diffOpts = useMemo(
    () => ({ ignoreWhitespace, ignoreCase }),
    [ignoreWhitespace, ignoreCase]
  );

  const diffResult = useMemo(() => {
    if (!hasBothSides) return null;
    return computeDiff(leftText, rightText, diffOpts);
  }, [leftText, rightText, hasBothSides, diffOpts]);

  const wordStats = useMemo(() => {
    if (!hasBothSides) return null;
    return wordLevelStats(leftText, rightText);
  }, [leftText, rightText, hasBothSides]);

  const showWords = diffLevel === "word";

  // Detect whether the result is identical (all unchanged, no added/removed)
  const isIdentical =
    diffResult != null && diffResult.stats.added === 0 && diffResult.stats.removed === 0;

  const changeCount = useMemo(() => {
    if (!diffResult || isIdentical) return 0;
    return countChanges(diffResult.sideBySide);
  }, [diffResult, isIdentical]);

  // Change navigation state
  const [currentChange, setCurrentChange] = useState<number | null>(null);
  const changeRefsMap = useRef<Map<number, HTMLElement>>(new Map());

  // Reset navigation when diff changes. diffResult is the trigger even though it's not read
  // inside the callback body — biome-ignore below is intentional.
  // biome-ignore lint/correctness/useExhaustiveDependencies: diffResult is the trigger
  useEffect(() => {
    setCurrentChange(null);
    changeRefsMap.current.clear();
  }, [diffResult]);

  const scrollToChange = useCallback((idx: number) => {
    const el = changeRefsMap.current.get(idx);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setCurrentChange(idx);
  }, []);

  const goNext = useCallback(() => {
    if (changeCount === 0) return;
    const next = currentChange == null ? 0 : (currentChange + 1) % changeCount;
    scrollToChange(next);
  }, [changeCount, currentChange, scrollToChange]);

  const goPrev = useCallback(() => {
    if (changeCount === 0) return;
    const prev =
      currentChange == null ? changeCount - 1 : (currentChange - 1 + changeCount) % changeCount;
    scrollToChange(prev);
  }, [changeCount, currentChange, scrollToChange]);

  const getDiffText = useCallback(() => {
    if (!diffResult) return "";
    if (effectiveViewMode === "inline") {
      return diffResult.inline
        .map((l) => `${l.kind === "added" ? "+" : l.kind === "removed" ? "-" : " "} ${l.text}`)
        .join("\n");
    }
    return diffResult.sideBySide
      .map((l) => {
        const left = l.leftText ?? "";
        const right = l.rightText ?? "";
        if (l.kind === "equal") return `  ${left}`;
        if (l.kind === "removed") return `- ${left}`;
        if (l.kind === "added") return `+ ${right}`;
        return `- ${left}\n+ ${right}`;
      })
      .join("\n");
  }, [diffResult, effectiveViewMode]);

  const getPatch = useCallback(() => {
    return buildUnifiedPatch(leftText, rightText, diffOpts);
  }, [leftText, rightText, diffOpts]);

  const loadExample = useCallback(() => {
    setLeftText(EXAMPLE_LEFT);
    setRightText(EXAMPLE_RIGHT);
  }, [setLeftText, setRightText]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape clears when a textarea is focused
      if (e.key === "Escape" && hasContent) {
        const active = document.activeElement;
        if (active instanceof HTMLTextAreaElement) {
          clear();
        }
      }
      // Cmd/Ctrl+Enter: no-op here (diff is live/reactive), but kept for consistency
      // with fleet expectation. Could focus the output in future.
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasContent, clear]);

  return (
    <div className="app-root">
      <Header
        title="Text Diff"
        subtitle="compare two texts, side-by-side or inline"
        brandMark={
          <BrandMark label="Text Diff">
            <DiffBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* Toolbar above inputs so controls are reachable before scrolling on mobile */}
        <Toolbar
          viewMode={viewMode}
          diffLevel={diffLevel}
          ignoreWhitespace={ignoreWhitespace}
          ignoreCase={ignoreCase}
          onViewMode={setViewMode}
          onDiffLevel={setDiffLevel}
          onIgnoreWhitespace={setIgnoreWhitespace}
          onIgnoreCase={setIgnoreCase}
          onSwap={swap}
          onClear={clear}
          onExample={loadExample}
          hasContent={hasContent}
        />

        {/* Input card */}
        <div className="card">
          <InputPanes
            leftText={leftText}
            rightText={rightText}
            onLeft={setLeftText}
            onRight={setRightText}
          />
        </div>

        {/* Diff output */}
        {diffResult != null &&
          (isIdentical ? (
            <IdenticalBanner />
          ) : (
            <>
              {wordStats != null && (
                <StatsBar
                  added={diffResult.stats.added}
                  removed={diffResult.stats.removed}
                  unchanged={diffResult.stats.unchanged}
                  wordAdded={wordStats.wordAdded}
                  wordRemoved={wordStats.wordRemoved}
                  changeCount={changeCount}
                  currentChange={currentChange}
                  onPrev={goPrev}
                  onNext={goNext}
                />
              )}

              {/* Word diff disabled notice */}
              {diffResult.wordDiffDisabled && (
                <output className="diff-word-notice" role="status" aria-live="polite">
                  <span>Word-level highlighting disabled for large input ({LARGE_INPUT_LINE_THRESHOLD}+ lines). Line-level diff remains.</span>
                </output>
              )}

              <div className="card diff-output-card">
                {effectiveViewMode === "split" ? (
                  <SplitView
                    lines={diffResult.sideBySide}
                    showWords={showWords}
                    changeRefs={changeRefsMap}
                  />
                ) : (
                  <InlineView
                    lines={diffResult.inline}
                    showWords={showWords}
                    changeRefs={changeRefsMap}
                  />
                )}
              </div>

              <div className="diff-actions">
                <CopyButton getText={getDiffText} />
                <DownloadButton getPatch={getPatch} />
              </div>
            </>
          ))}

        {!hasBothSides && hasContent && (
          <p className="diff-hint">Enter text in both panes to see the diff.</p>
        )}

        {!hasContent && (
          <p className="diff-hint">
            Paste text into both panes above, or drop a file onto either pane. Press Esc while
            typing to clear.
          </p>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
