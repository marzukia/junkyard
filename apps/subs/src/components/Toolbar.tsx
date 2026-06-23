import { useEffect, useRef, useState } from "react";
import { type SubFormat, countMatches, formatTimestampSrt, parseTimestamp } from "../lib/subtitle";
import { useSubsStore } from "../store/useSubsStore";

/** Milliseconds a success/copy toast stays visible. */
const TOAST_MS = 1800;

/** A small, self-clearing toast that lives inside the toolbar. */
function ShiftToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <output className="shift-toast" aria-live="polite">
      {message}
    </output>
  );
}

// ── Find & Replace panel ──────────────────────────────────────────────────────

function FindReplacePanel({ onClose }: { onClose: () => void }) {
  const cues = useSubsStore((s) => s.cues);
  const applyFindReplace = useSubsStore((s) => s.applyFindReplace);

  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [regexError, setRegexError] = useState(false);

  const matchCount = countMatches(cues, pattern, useRegex, caseSensitive);

  function validate(): boolean {
    if (!useRegex) return true;
    try {
      new RegExp(pattern);
      setRegexError(false);
      return true;
    } catch {
      setRegexError(true);
      return false;
    }
  }

  function handleReplace() {
    if (!validate()) return;
    if (!pattern) return;
    applyFindReplace(pattern, replacement, useRegex, caseSensitive);
    setToast(`Replaced ${matchCount} match${matchCount !== 1 ? "es" : ""}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleReplace();
    }
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="panel card" onKeyDown={onKeyDown}>
      <div className="panel__header">
        <span className="mono-label">Find &amp; Replace</span>
        <button
          type="button"
          className="panel__close"
          onClick={onClose}
          aria-label="Close find and replace"
        >
          ×
        </button>
      </div>

      <div className="panel__body">
        <div className="panel__field">
          <label className="panel__field-label" htmlFor="fr-pattern">
            Find
          </label>
          <input
            id="fr-pattern"
            type="text"
            className={`panel__input${regexError ? " panel__input--error" : ""}`}
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value);
              setRegexError(false);
            }}
            placeholder="Search text..."
            // biome-ignore lint/a11y/noAutofocus: panel is opened intentionally
            autoFocus
          />
          {regexError && (
            <span className="panel__field-hint panel__field-hint--error">Invalid regex</span>
          )}
          {pattern && !regexError && (
            <span className="panel__field-hint">
              {matchCount} match{matchCount !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        <div className="panel__field">
          <label className="panel__field-label" htmlFor="fr-replacement">
            Replace with
          </label>
          <input
            id="fr-replacement"
            type="text"
            className="panel__input"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replacement text (blank to delete)"
          />
        </div>

        <div className="panel__toggles">
          <label className="panel__toggle-label">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => {
                setUseRegex(e.target.checked);
                setRegexError(false);
              }}
            />
            Regex
          </label>
          <label className="panel__toggle-label">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Case sensitive
          </label>
        </div>

        <div className="panel__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleReplace}
            disabled={!pattern || regexError}
            title="Replace all (Ctrl+Enter)"
          >
            Replace all
          </button>
          {toast && <ShiftToast message={toast} onDone={() => setToast(null)} />}
        </div>
      </div>
    </div>
  );
}

// ── Two-point sync panel ──────────────────────────────────────────────────────

function SyncPanel({ onClose }: { onClose: () => void }) {
  const applyLinearSync = useSubsStore((s) => s.applyLinearSync);
  const cues = useSubsStore((s) => s.cues);

  // Default point A to first cue start, point B to last cue start
  const defaultA = cues[0] ? formatTimestampSrt(cues[0].startMs) : "00:00:00,000";
  const defaultB = cues[cues.length - 1]
    ? formatTimestampSrt(cues[cues.length - 1].startMs)
    : "00:00:10,000";

  const [subA, setSubA] = useState(defaultA);
  const [actualA, setActualA] = useState(defaultA);
  const [subB, setSubB] = useState(defaultB);
  const [actualB, setActualB] = useState(defaultB);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function parseField(v: string): number | null {
    try {
      return parseTimestamp(v);
    } catch {
      return null;
    }
  }

  function handleSync() {
    const sa = parseField(subA);
    const aa = parseField(actualA);
    const sb = parseField(subB);
    const ab = parseField(actualB);
    if (sa === null || aa === null || sb === null || ab === null) {
      setError("All four timestamps must be valid (HH:MM:SS,mmm)");
      return;
    }
    setError(null);
    applyLinearSync(sa, aa, sb, ab);
    setToast("Sync applied");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSync();
    }
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="panel card" onKeyDown={onKeyDown}>
      <div className="panel__header">
        <span className="mono-label">Two-Point Sync</span>
        <button
          type="button"
          className="panel__close"
          onClick={onClose}
          aria-label="Close sync panel"
        >
          ×
        </button>
      </div>

      <div className="panel__body">
        <p className="panel__desc">
          Enter two reference points: a subtitle timestamp that should actually appear at a
          different time. A linear scale + offset is computed and applied to all cues.
        </p>

        <div className="sync-grid">
          <span className="mono-label sync-grid__label">Point</span>
          <span className="mono-label sync-grid__label">Subtitle shows</span>
          <span className="mono-label sync-grid__label">Should be at</span>

          <span className="sync-grid__point-label">A</span>
          <input
            type="text"
            className="panel__input"
            value={subA}
            onChange={(e) => setSubA(e.target.value)}
            placeholder="00:00:00,000"
            aria-label="Point A subtitle time"
            // biome-ignore lint/a11y/noAutofocus: panel opened intentionally
            autoFocus
          />
          <input
            type="text"
            className="panel__input"
            value={actualA}
            onChange={(e) => setActualA(e.target.value)}
            placeholder="00:00:00,000"
            aria-label="Point A actual time"
          />

          <span className="sync-grid__point-label">B</span>
          <input
            type="text"
            className="panel__input"
            value={subB}
            onChange={(e) => setSubB(e.target.value)}
            placeholder="00:00:10,000"
            aria-label="Point B subtitle time"
          />
          <input
            type="text"
            className="panel__input"
            value={actualB}
            onChange={(e) => setActualB(e.target.value)}
            placeholder="00:00:10,000"
            aria-label="Point B actual time"
          />
        </div>

        {error && (
          <span className="panel__field-hint panel__field-hint--error" role="alert">
            {error}
          </span>
        )}

        <div className="panel__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSync}
            title="Apply sync (Ctrl+Enter)"
          >
            Apply sync
          </button>
          {toast && <ShiftToast message={toast} onDone={() => setToast(null)} />}
        </div>
      </div>
    </div>
  );
}

// ── Main Toolbar ──────────────────────────────────────────────────────────────

const ALL_FORMATS: SubFormat[] = ["srt", "vtt", "ass", "sbv"];

export function Toolbar() {
  const {
    cues,
    selectedIds,
    format,
    fileName,
    history,
    shiftAll,
    shiftSel,
    fixAll,
    undo,
    setFormat,
    download,
    serialised,
    reset,
    selectAll,
    clearSelection,
  } = useSubsStore();

  const [shiftMs, setShiftMs] = useState("1000");
  const [shiftError, setShiftError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy text");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSelection = selectedIds.size > 0;
  const allSelected = cues.length > 0 && selectedIds.size === cues.length;
  const canUndo = history.length > 0;

  function parsedDelta(): number | null {
    const n = Number(shiftMs);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }

  function handleShiftAll(sign: 1 | -1) {
    const delta = parsedDelta();
    if (delta === null) {
      setShiftError(true);
      return;
    }
    setShiftError(false);
    shiftAll(delta * sign);
    const dir = sign > 0 ? "Later" : "Earlier";
    setToast(`All cues shifted ${dir} by ${Math.abs(delta)}ms`);
  }

  function handleShiftSel(sign: 1 | -1) {
    const delta = parsedDelta();
    if (delta === null) {
      setShiftError(true);
      return;
    }
    setShiftError(false);
    shiftSel(delta * sign);
    const dir = sign > 0 ? "Later" : "Earlier";
    setToast(
      `${selectedIds.size} cue${selectedIds.size !== 1 ? "s" : ""} shifted ${dir} by ${Math.abs(delta)}ms`
    );
  }

  function handleFixAll() {
    fixAll();
    setToast("Overlaps fixed");
  }

  function handleUndo() {
    undo();
    setToast("Undone");
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(serialised());
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      setCopyLabel("Copied!");
      copyTimerRef.current = setTimeout(() => setCopyLabel("Copy text"), TOAST_MS);
    } catch {
      // clipboard not available (non-https dev, etc.) -- silently fall back
    }
  }

  // Cmd/Ctrl+Enter triggers download (the primary action when loaded)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        // Don't intercept if a panel is open (they handle their own shortcut)
        if (showFindReplace || showSync) return;
        e.preventDefault();
        download();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [download, showFindReplace, showSync]);

  // Clean up copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const outputExt = format;
  const outputName = fileName.replace(/\.(srt|vtt|ass|ssa|sbv)$/i, `.${outputExt}`);

  return (
    <>
      <div className="toolbar card">
        {/* File info row */}
        <div className="toolbar__row toolbar__file-row">
          <span className="mono-label">File</span>
          <span className="toolbar__filename">{fileName}</span>
          <span className="toolbar__cue-count">{cues.length} cues</span>
          <button type="button" className="btn-secondary toolbar__reset" onClick={reset}>
            Close
          </button>
        </div>

        {/* Output format toggle */}
        <div className="toolbar__row">
          <span className="mono-label">Output</span>
          <div className="space-toggle" aria-label="Output format">
            {ALL_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                className={`space-btn${format === f ? " space-btn--active" : ""}`}
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
              >
                .{f}
              </button>
            ))}
          </div>
        </div>

        {/* Time shift row */}
        <div className="toolbar__row toolbar__shift-row">
          <span className="mono-label">Shift (ms)</span>
          <div className="toolbar__shift-inputs">
            <input
              type="number"
              className={`toolbar__shift-input${shiftError ? " toolbar__shift-input--error" : ""}`}
              value={shiftMs}
              onChange={(e) => {
                setShiftMs(e.target.value);
                setShiftError(false);
              }}
              aria-label="Shift amount in milliseconds"
              aria-invalid={shiftError}
            />
            <div className="toolbar__shift-btns">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleShiftAll(-1)}
                title="Shift all cues earlier (subtract)"
                aria-label="Shift all cues earlier"
              >
                Earlier all
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleShiftAll(1)}
                title="Shift all cues later (add)"
                aria-label="Shift all cues later"
              >
                Later all
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleShiftSel(-1)}
                disabled={!hasSelection}
                title="Shift selected cues earlier"
                aria-label="Shift selected cues earlier"
              >
                Earlier sel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleShiftSel(1)}
                disabled={!hasSelection}
                title="Shift selected cues later"
                aria-label="Shift selected cues later"
              >
                Later sel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo last shift or fix"
                aria-label="Undo last shift or fix"
              >
                Undo
              </button>
            </div>
          </div>
          {shiftError && (
            <span className="toolbar__shift-err" role="alert">
              Enter a valid number
            </span>
          )}
          {toast && <ShiftToast message={toast} onDone={() => setToast(null)} />}
        </div>

        {/* Select + fix + tools row */}
        <div className="toolbar__row">
          <span className="mono-label">Tools</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={allSelected ? clearSelection : selectAll}
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          {hasSelection && (
            <button type="button" className="btn-secondary" onClick={clearSelection}>
              Clear ({selectedIds.size})
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleFixAll}
            title="Fix overlapping cues"
          >
            Fix overlaps
          </button>
          <button
            type="button"
            className={`btn-secondary${showFindReplace ? " btn-secondary--active" : ""}`}
            onClick={() => {
              setShowFindReplace((v) => !v);
              setShowSync(false);
            }}
            aria-pressed={showFindReplace}
            title="Find and replace text in cues"
          >
            Find &amp; replace
          </button>
          <button
            type="button"
            className={`btn-secondary${showSync ? " btn-secondary--active" : ""}`}
            onClick={() => {
              setShowSync((v) => !v);
              setShowFindReplace(false);
            }}
            aria-pressed={showSync}
            title="Two-point linear sync"
          >
            Sync
          </button>
        </div>

        {/* Download + copy */}
        <div className="toolbar__row toolbar__actions-row">
          <button
            type="button"
            className="btn-primary toolbar__download"
            onClick={download}
            title="Download (Ctrl+Enter)"
          >
            Download {outputName}
          </button>
          <button
            type="button"
            className={`btn-secondary toolbar__copy${copyLabel === "Copied!" ? " toolbar__copy--done" : ""}`}
            onClick={handleCopyText}
            title="Copy subtitle text to clipboard"
          >
            {copyLabel}
          </button>
        </div>
      </div>

      {showFindReplace && <FindReplacePanel onClose={() => setShowFindReplace(false)} />}
      {showSync && <SyncPanel onClose={() => setShowSync(false)} />}
    </>
  );
}
