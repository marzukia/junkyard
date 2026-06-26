import { useCallback, useEffect, useRef, useState } from "react";
import { useCmdEnter } from "./components/useCmdEnter";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  type BatchRow,
  COMMON_TIMEZONES,
  type DiffResult,
  FORMAT_EXAMPLES,
  applyCustomFormat,
  batchConvert,
  computeDiff,
  detectUnit,
  hasExplicitTimezone,
  parseDiffInput,
} from "./lib/timestamp";
import { useTimestampStore } from "./store/timestampStore";

// ── Brand glyph: clock face with teal circle, amber hands, coral tick ────────

function TimestampBrandGlyph() {
  return (
    <>
      {/* Outer clock circle */}
      <circle cx="16" cy="16" r="12" stroke="#2f9d8d" strokeWidth="2.5" />
      {/* Hour hand pointing up-right (teal) */}
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="8"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Minute hand pointing right (amber) */}
      <line
        x1="16"
        y1="16"
        x2="22"
        y2="16"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx="16" cy="16" r="1.5" fill="#d9594c" />
      {/* 12 o-clock tick */}
      <line x1="16" y1="5" x2="16" y2="7" stroke="#2f9d8d" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// ── Copy row ──────────────────────────────────────────────────────────────────

function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    });
  }, [text]);

  return (
    <button type="button" className="ts-copy-btn" onClick={handleCopy} aria-label={`Copy ${text}`}>
      {copied ? "copied" : label}
    </button>
  );
}

interface ResultRowProps {
  label: string;
  value: string;
  accent?: "accent" | "amber" | "coral";
}

function ResultRow({ label, value, accent }: ResultRowProps) {
  return (
    <div className="ts-row">
      <span className="ts-row-label">{label}</span>
      <span className={`ts-row-value${accent ? ` ts-row-value--${accent}` : ""}`}>{value}</span>
      <CopyButton text={value} />
    </div>
  );
}

// ── Custom format panel ───────────────────────────────────────────────────────

interface CustomFormatPanelProps {
  epochMs: number | null;
  timezone: string;
}

function CustomFormatPanel({ epochMs, timezone }: CustomFormatPanelProps) {
  const [fmt, setFmt] = useState("YYYY-MM-DD HH:mm:ss");
  const output = epochMs != null ? applyCustomFormat(new Date(epochMs), fmt, timezone) : null;

  return (
    <div className="card ts-custom-fmt-card">
      <div className="ts-results-header">Custom format</div>
      <div className="ts-custom-fmt-examples">
        {FORMAT_EXAMPLES.map((ex) => (
          <button
            key={ex.fmt}
            type="button"
            className={`ts-fmt-chip${fmt === ex.fmt ? " ts-fmt-chip--active" : ""}`}
            onClick={() => setFmt(ex.fmt)}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <div className="ts-input-row" style={{ marginTop: "0.75rem" }}>
        <label htmlFor="ts-fmt-input" className="ts-tz-label">
          Format
        </label>
        <input
          id="ts-fmt-input"
          type="text"
          className="ts-input-field"
          value={fmt}
          onChange={(e) => setFmt(e.target.value)}
          placeholder="YYYY-MM-DD HH:mm:ss"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div className="ts-custom-fmt-output">
        {output != null ? (
          <>
            <span className="ts-custom-fmt-value">{output}</span>
            <CopyButton text={output} />
          </>
        ) : (
          <span className="ts-empty" style={{ padding: "0.5rem 0" }}>
            Enter an epoch or date above to see output
          </span>
        )}
      </div>
      <div className="ts-fmt-token-hint">
        Tokens: <code>YYYY</code> <code>MM</code> <code>DD</code> <code>HH</code> <code>mm</code>{" "}
        <code>ss</code> <code>SSS</code> <code>ddd</code> <code>MMM</code> <code>Z</code>{" "}
        <code>X</code> (unix s) <code>x</code> (unix ms)
      </div>
    </div>
  );
}

// ── Batch conversion panel ────────────────────────────────────────────────────

function BatchPanel() {
  const [input, setInput] = useState("");
  const rows: BatchRow[] = input.trim() ? batchConvert(input) : [];
  const validCount = rows.filter((r) => r.error === null).length;

  const csvContent =
    rows.length > 0
      ? [
          "raw,epochMs,unit,iso8601,error",
          ...rows.map((r) =>
            [r.raw, r.epochMs ?? "", r.unit ?? "", r.iso8601 ?? "", r.error ?? ""].join(",")
          ),
        ].join("\n")
      : "";

  return (
    <div className="card">
      <div className="ts-results-header">Batch convert</div>
      <p className="ts-batch-hint">
        Paste one timestamp per line (seconds or ms). Blanks are skipped.
      </p>
      <textarea
        className="ts-batch-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={"1700000000\n1700000000000\n1750000000"}
        rows={5}
        spellCheck={false}
        aria-label="Batch timestamp input"
      />
      {rows.length > 0 && (
        <>
          <div className="ts-batch-summary">
            {validCount} / {rows.length} parsed
            {csvContent && <CopyButton text={csvContent} label="copy CSV" />}
          </div>
          <div className="ts-batch-table-wrap">
            <table className="ts-batch-table">
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Unit</th>
                  <th>ISO 8601</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
                  <tr key={i} className={row.error ? "ts-batch-row--error" : ""}>
                    <td className="ts-batch-cell-raw">{row.raw}</td>
                    <td className="ts-batch-cell-unit">
                      {row.unit ? (
                        <span className="ts-unit-badge">{row.unit === "s" ? "sec" : "ms"}</span>
                      ) : (
                        <span className="ts-batch-err-label">{row.error}</span>
                      )}
                    </td>
                    <td className="ts-batch-cell-iso">{row.iso8601 ?? "-"}</td>
                    <td>{row.iso8601 && <CopyButton text={row.iso8601} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Date diff panel ───────────────────────────────────────────────────────────

function DiffPanel() {
  const [aInput, setAInput] = useState("");
  const [bInput, setBInput] = useState("");

  const aMs = parseDiffInput(aInput);
  const bMs = parseDiffInput(bInput);

  const diff: DiffResult | null = aMs != null && bMs != null ? computeDiff(aMs, bMs) : null;

  const aError = aInput.trim() !== "" && aMs === null ? "Cannot parse" : null;
  const bError = bInput.trim() !== "" && bMs === null ? "Cannot parse" : null;

  const loadNowA = () => setAInput(String(Math.floor(Date.now() / 1000)));
  const loadNowB = () => setBInput(String(Math.floor(Date.now() / 1000)));

  const humanDiff = diff
    ? (() => {
        const parts: string[] = [];
        if (diff.years) parts.push(`${diff.years}y`);
        if (diff.months) parts.push(`${diff.months}mo`);
        if (diff.days) parts.push(`${diff.days}d`);
        if (diff.hours) parts.push(`${diff.hours}h`);
        if (diff.minutes) parts.push(`${diff.minutes}m`);
        if (diff.seconds || parts.length === 0) parts.push(`${diff.seconds}s`);
        return parts.join(" ");
      })()
    : null;

  return (
    <div className="card">
      <div className="ts-results-header">Date diff / duration</div>
      <div className="ts-diff-inputs">
        <div className="ts-diff-field">
          <label htmlFor="ts-diff-a" className="ts-tz-label">
            From
          </label>
          <input
            id="ts-diff-a"
            type="text"
            className={`ts-input-field${aError ? " ts-input-field--error" : ""}`}
            value={aInput}
            onChange={(e) => setAInput(e.target.value)}
            placeholder="epoch or date string"
            spellCheck={false}
            autoComplete="off"
          />
          <button type="button" className="btn-secondary" onClick={loadNowA}>
            now
          </button>
        </div>
        <div className="ts-diff-field">
          <label htmlFor="ts-diff-b" className="ts-tz-label">
            To
          </label>
          <input
            id="ts-diff-b"
            type="text"
            className={`ts-input-field${bError ? " ts-input-field--error" : ""}`}
            value={bInput}
            onChange={(e) => setBInput(e.target.value)}
            placeholder="epoch or date string"
            spellCheck={false}
            autoComplete="off"
          />
          <button type="button" className="btn-secondary" onClick={loadNowB}>
            now
          </button>
        </div>
      </div>
      {(aError || bError) && (
        <div className="ts-input-error" role="alert">
          <span>&#x2715;</span>
          <span>{aError ?? bError}</span>
        </div>
      )}
      {diff && humanDiff && (
        <div className="ts-diff-results">
          <div className="ts-diff-hero">
            <span className="ts-diff-hero-value">{humanDiff}</span>
            <span className={`ts-diff-direction ts-diff-direction--${diff.sign}`}>
              {diff.sign === "future"
                ? "B is after A"
                : diff.sign === "past"
                  ? "B is before A"
                  : "same instant"}
            </span>
            <CopyButton text={humanDiff} />
          </div>
          <div className="ts-diff-rows">
            <ResultRow label="Total days" value={String(diff.totalDays)} />
            <ResultRow label="Total hours" value={String(diff.totalHours)} />
            <ResultRow label="Total mins" value={String(diff.totalMinutes)} />
            <ResultRow label="Total secs" value={String(diff.totalSeconds)} />
            <ResultRow label="Total ms" value={String(diff.totalMs)} />
          </div>
        </div>
      )}
      {diff === null && aInput.trim() === "" && bInput.trim() === "" && (
        <p className="ts-empty">Enter two dates or epoch values above</p>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    inputMode,
    epochInput,
    dateInput,
    timezone,
    result,
    parseError,
    nowMs,
    setInputMode,
    setEpochInput,
    setDateInput,
    setTimezone,
    setNow,
    loadNow,
  } = useTimestampStore();

  // Tick the live clock every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [setNow]);

  const nowS = Math.floor(nowMs / 1000);

  const rawDetectedUnit =
    inputMode === "epoch" && epochInput.trim() !== "" ? detectUnit(epochInput) : null;

  // If user entered a 10-digit number, show a prompt to switch to ms
  const epochNum = epochInput.trim() !== "" ? Number(epochInput.trim()) : null;
  const showMsSuggestion =
    rawDetectedUnit === "s" && epochNum !== null && Number.isFinite(epochNum) && epochNum > 1e9; // looks like a plausible unix second but could also be ms

  // Keyboard shortcut: Cmd/Ctrl+Enter loads "use now" (primary action) in epoch mode
  useCmdEnter(() => {
    loadNow();
  });

  return (
    <div className="app-root">
      <Header
        title="Timestamp"
        subtitle="unix epoch converter, free, in-browser, no signup"
        brandMark={
          <BrandMark label="Timestamp Converter">
            <TimestampBrandGlyph />
          </BrandMark>
        }
        controls={
          <div className="space-toggle-wrapper">
            <span className="space-toggle-label">Mode</span>
            <div className="space-toggle" role="group" aria-label="Input mode">
              <button
                type="button"
                className={`space-btn${inputMode === "epoch" ? " space-btn--active" : ""}`}
                onClick={() => setInputMode("epoch")}
                aria-pressed={inputMode === "epoch"}
              >
                Epoch to date
              </button>
              <button
                type="button"
                className={`space-btn${inputMode === "date" ? " space-btn--active" : ""}`}
                onClick={() => setInputMode("date")}
                aria-pressed={inputMode === "date"}
              >
                Date to epoch
              </button>
            </div>
          </div>
        }
      />

      <main className="site-main">
        {/* ── Live clock ── */}
        <div className="card ts-clock-bar">
          <div>
            <div className="ts-clock-label">Current Unix epoch</div>
            <div className="ts-clock-value" aria-live="polite" aria-atomic="true">
              {nowS}
              <span className="ts-clock-ms">.{String(nowMs % 1000).padStart(3, "0")}</span>
            </div>
            <div className="ts-clock-hint">
              <span className="ts-unit-badge">seconds</span>
              <span className="ts-unit-badge ts-unit-badge--dim">{nowMs} ms</span>
            </div>
          </div>
          <div className="ts-clock-right">
            <button
              type="button"
              className="btn-primary"
              onClick={loadNow}
              aria-label="Use current timestamp (Cmd+Enter)"
              title="Cmd/Ctrl+Enter"
            >
              Use now
            </button>
            <CopyButton text={String(nowS)} />
            <CopyButton text={String(nowMs)} label="copy ms" />
          </div>
        </div>

        {/* ── Input ── */}
        <div className="card ts-input-section">
          {inputMode === "epoch" ? (
            <>
              <div className="ts-input-row">
                <label htmlFor="ts-epoch-input" className="ts-tz-label">
                  Epoch
                </label>
                <input
                  id="ts-epoch-input"
                  type="text"
                  className="ts-input-field"
                  value={epochInput}
                  onChange={(e) => setEpochInput(e.target.value)}
                  placeholder="e.g. 1700000000 or 1700000000000"
                  aria-label="Unix epoch input (seconds or milliseconds)"
                  spellCheck={false}
                  autoComplete="off"
                  inputMode="numeric"
                />
                {rawDetectedUnit && (
                  <span className="ts-unit-badge ts-unit-badge--loud">
                    {rawDetectedUnit === "s"
                      ? "interpreted as seconds"
                      : "interpreted as milliseconds"}
                  </span>
                )}
              </div>
              {showMsSuggestion && (
                <output className="ts-unit-suggest">
                  <span>Treating as seconds. If this is a ms timestamp,</span>
                  <button
                    type="button"
                    className="ts-unit-suggest-btn"
                    onClick={() => setEpochInput(String(epochNum * 1000))}
                  >
                    switch to ms
                  </button>
                </output>
              )}
              {parseError && (
                <div className="ts-input-error" role="alert" aria-live="polite">
                  <span>&#x2715;</span>
                  <span>{parseError}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="ts-input-row">
                <label htmlFor="ts-date-input" className="ts-tz-label">
                  Date
                </label>
                <input
                  id="ts-date-input"
                  type="text"
                  className="ts-input-field"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  placeholder="e.g. 2024-01-15T12:30:00Z or Jan 15 2024"
                  aria-label="Date string input"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              {/* TZ notice */}
              {inputMode === "date" && dateInput.trim() !== "" && !hasExplicitTimezone(dateInput) && (
                <output className="ts-tz-notice" role="status" aria-live="polite">
                  <span>⚠ No timezone offset detected — parsed in your browser's local timezone, not the selected "{timezone}" timezone. Add Z (UTC) or +HH:MM for explicit timezone.</span>
                </output>
              )}
              {parseError && (
                <div className="ts-input-error" role="alert" aria-live="polite">
                  <span>&#x2715;</span>
                  <span>{parseError}</span>
                </div>
              )}
            </>
          )}

          {/* Timezone selector */}
          <div className="ts-tz-row">
            <label htmlFor="ts-tz-select" className="ts-tz-label">
              Timezone
            </label>
            <select
              id="ts-tz-select"
              className="ts-tz-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label="Timezone"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Results (pinned at top, flashed on change) ── */}
        <div className="ts-results-grid">
          {/* Formats card */}
          <div className="card ts-results">
            <div className="ts-results-header">Formats</div>
            {result ? (
              <>
                <ResultRow label="Epoch (s)" value={String(result.epochS)} accent="accent" />
                <ResultRow label="Epoch (ms)" value={String(result.epochMs)} />
                <ResultRow label="Hex" value={result.unixHex} />
                <ResultRow label="ISO 8601" value={result.iso8601} />
                <ResultRow label="RFC 3339" value={result.rfc3339} />
                <ResultRow label="RFC 2822" value={result.rfc2822} />
                <ResultRow label="UTC string" value={result.utcString} />
                <ResultRow label={result.tzString} value={result.localString} accent="amber" />
              </>
            ) : (
              <p className="ts-empty">Enter an epoch or date above</p>
            )}
          </div>

          {/* Relative / facts card */}
          <div className="card ts-results">
            <div className="ts-results-header">Details</div>
            {result ? (
              <>
                <ResultRow label="Relative" value={result.relative} accent="coral" />
                <ResultRow label="Day of week" value={result.dayOfWeek} />
                <ResultRow label="Day of year" value={String(result.dayOfYear)} />
                <ResultRow
                  label="ISO week"
                  value={`W${String(result.weekOfYear).padStart(2, "0")}`}
                />
                <ResultRow label="Leap year" value={result.leapYear ? "Yes" : "No"} />
              </>
            ) : (
              <p className="ts-empty">Details appear here</p>
            )}
          </div>
        </div>

        {/* ── Custom format ── */}
        <CustomFormatPanel epochMs={result?.epochMs ?? null} timezone={timezone} />

        {/* ── Batch conversion ── */}
        <BatchPanel />

        {/* ── Date diff ── */}
        <DiffPanel />

        <p className="ts-privacy-note">
          Runs entirely in your browser. No data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
