import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  FIELD_ORDER,
  FIELD_SPECS,
  PRESETS,
  TZ_OPTIONS,
  fieldLabel,
  formatRunTime,
  nextRuns,
  resolveTzLabel,
} from "./lib/cron";
import type { CronFields } from "./lib/cron";
import { useCronStore } from "./store/cronStore";

// ─── Cron brand glyph: clock face with tick marks in teal/amber/coral ─────────

function CronBrandGlyph() {
  return (
    <>
      {/* Outer circle, teal */}
      <circle cx="16" cy="16" r="12" stroke="#2f9d8d" strokeWidth="2.2" />
      {/* Hour hand, teal */}
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="8"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Minute hand, coral, pointing to ~:42 */}
      <line
        x1="16"
        y1="16"
        x2="21"
        y2="20"
        stroke="#d9594c"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Center dot, amber */}
      <circle cx="16" cy="16" r="1.8" fill="#e8b04b" />
      {/* Tick at 12 */}
      <line
        x1="16"
        y1="5"
        x2="16"
        y2="7.5"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Tick at 3 */}
      <line
        x1="27"
        y1="16"
        x2="24.5"
        y2="16"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Tick at 6 */}
      <line
        x1="16"
        y1="27"
        x2="16"
        y2="24.5"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Tick at 9 */}
      <line
        x1="5"
        y1="16"
        x2="7.5"
        y2="16"
        stroke="#2f9d8d"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  );
}

// ─── Field helper labels ───────────────────────────────────────────────────────

const FIELD_PLACEHOLDERS: Record<keyof CronFields, string> = {
  minute: "0-59",
  hour: "0-23",
  dom: "1-31",
  month: "1-12",
  dow: "0-6",
};

const FIELD_HINTS: Record<keyof CronFields, string> = {
  minute: "0-59, */15, 0,30",
  hour: "0-23, 9-17, */2",
  dom: "1-31, */7, 1,15",
  month: "1-12, Jan-Jun, */3",
  dow: "0-6, Mon-Fri, 1-5",
};

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
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
      aria-label={copied ? "Copied to clipboard" : "Copy expression"}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: keyof CronFields;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}

function FieldRow({ field, value, error, onChange }: FieldRowProps) {
  const spec = FIELD_SPECS[field];
  const label = fieldLabel(field);
  const id = `cron-field-${field}`;

  return (
    <div className={`cron-field-row${error ? " cron-field-row--error" : ""}`}>
      <label htmlFor={id} className="cron-field-label">
        {label}
        <span className="cron-field-range">
          {spec.names
            ? `${spec.names[0]}..${spec.names[spec.names.length - 1]}`
            : `${spec.min}..${spec.max}`}
        </span>
      </label>
      <input
        id={id}
        type="text"
        className="cron-field-input"
        value={value}
        placeholder={FIELD_PLACEHOLDERS[field]}
        aria-label={label}
        aria-describedby={error ? `${id}-err` : `${id}-hint`}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
      {error ? (
        <span id={`${id}-err`} className="cron-field-error" role="alert">
          {error}
        </span>
      ) : (
        <span id={`${id}-hint`} className="cron-field-hint">
          {FIELD_HINTS[field]}
        </span>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function App() {
  const { expression, fields, description, fieldErrors, globalError, setExpression, setField } =
    useCronStore();

  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return localStorage.getItem("cron-timezone") ?? "local";
    } catch {
      return "local";
    }
  });

  const handleTimezoneChange = useCallback((tz: string) => {
    setTimezone(tz);
    try {
      localStorage.setItem("cron-timezone", tz);
    } catch {
      // ignore
    }
  }, []);

  const isValid = globalError === null;

  // Recompute run times in the selected timezone so that e.g. `0 0 * * *`
  // shows midnight in Tokyo when Tokyo is selected, not midnight local.
  const runs = useMemo(
    () => (isValid ? nextRuns(fields, 5, undefined, timezone) : []),
    [fields, isValid, timezone]
  );

  return (
    <div className="app-root">
      <Header
        title="Cron Expression Builder"
        subtitle="build, decode and preview cron schedules"
        brandMark={
          <BrandMark label="Cron Expression Builder">
            <CronBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* ── Expression bar ── */}
        <div className="card cron-expr-card">
          <label htmlFor="cron-expr" className="cron-expr-label">
            Expression
          </label>
          <div className="cron-expr-row">
            <input
              id="cron-expr"
              type="text"
              className={`cron-expr-input${!isValid ? " cron-expr-input--error" : ""}`}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                  setExpression(expression);
                }
              }}
              placeholder="* * * * * or @daily"
              aria-label="Cron expression"
              aria-invalid={!isValid}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <CopyButton text={expression} />
          </div>
          <p
            className={`cron-description${isValid ? " cron-description--valid" : " cron-description--error"}`}
            aria-live="polite"
          >
            {description}
          </p>
          <p className="cron-expr-hint">
            5 fields: <span className="cron-expr-hint-fields">minute</span>{" "}
            <span className="cron-expr-hint-fields">hour</span>{" "}
            <span className="cron-expr-hint-fields">day-of-month</span>{" "}
            <span className="cron-expr-hint-fields">month</span>{" "}
            <span className="cron-expr-hint-fields">day-of-week</span> or{" "}
            <span className="cron-expr-hint-fields">@daily</span>{" "}
            <span className="cron-expr-hint-fields">@hourly</span>{" "}
            <span className="cron-expr-hint-fields">@weekly</span>{" "}
            <span className="cron-expr-hint-fields">@monthly</span>
          </p>
        </div>

        {/* ── Field builders + schedule ── */}
        <div className="cron-main-grid">
          {/* Field builders */}
          <div className="card cron-fields-card">
            <p className="cron-section-label">Field editor</p>
            <div className="cron-fields-list">
              {FIELD_ORDER.map((f) => (
                <FieldRow
                  key={f}
                  field={f}
                  value={fields[f]}
                  error={fieldErrors[f]}
                  onChange={(v) => setField(f, v)}
                />
              ))}
            </div>
          </div>

          {/* Next runs */}
          <div className="card cron-schedule-card">
            <div className="cron-schedule-header">
              <div className="cron-schedule-header-left">
                <p className="cron-section-label">Next 5 runs</p>
                <span className="cron-tz-badge" aria-live="polite">
                  {resolveTzLabel(timezone, TZ_OPTIONS)}
                </span>
              </div>
              <select
                className="cron-tz-select"
                value={timezone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                aria-label="Timezone for next-run preview"
              >
                {TZ_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            {isValid && runs.length > 0 ? (
              <ol className="cron-runs-list" aria-label="Upcoming scheduled runs">
                {runs.map((r) => (
                  <li key={r.toISOString()} className="cron-run-item">
                    <span className="cron-run-time">{formatRunTime(r, timezone)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="cron-no-runs">
                {isValid ? "No upcoming runs found." : "Fix the expression to see upcoming runs."}
              </p>
            )}
          </div>
        </div>

        {/* ── Presets ── */}
        <div className="card cron-presets-card">
          <p className="cron-section-label">Presets</p>
          <div className="cron-presets-grid">
            {PRESETS.map((p) => (
              <button
                key={p.expression}
                type="button"
                className={`cron-preset-btn${expression === p.expression ? " cron-preset-btn--active" : ""}`}
                onClick={() => setExpression(p.expression)}
                title={p.description}
              >
                <span className="cron-preset-label">{p.label}</span>
                <span className="cron-preset-expr">{p.expression}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Cheatsheet ── */}
        <details className="card cron-cheatsheet">
          <summary className="cron-cheatsheet-summary">Syntax reference</summary>
          <div className="cron-cheatsheet-body">
            <table className="cron-cheat-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Meaning</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>*</code>
                  </td>
                  <td>Any value</td>
                  <td>
                    <code>* * * * *</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>*/n</code>
                  </td>
                  <td>Every nth</td>
                  <td>
                    <code>*/5 * * * *</code> (every 5 min)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>a-b</code>
                  </td>
                  <td>Range</td>
                  <td>
                    <code>0 9-17 * * *</code> (9am to 5pm)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>a-b/n</code>
                  </td>
                  <td>Range with step</td>
                  <td>
                    <code>0 0-23/2 * * *</code> (every 2h)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>a,b,c</code>
                  </td>
                  <td>List</td>
                  <td>
                    <code>0 8,12,18 * * *</code>
                  </td>
                </tr>
                <tr>
                  <td>Names</td>
                  <td>Month / weekday</td>
                  <td>
                    <code>0 9 * Jan-Mar Mon</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>@daily</code>
                  </td>
                  <td>@-macro shorthand</td>
                  <td>
                    <code>@hourly</code> <code>@daily</code> <code>@weekly</code>{" "}
                    <code>@monthly</code> <code>@yearly</code>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="cron-cheatsheet-note">
              Day-of-month and day-of-week are ORed when both are set (non-wildcard). Weekdays:
              0=Sun, 1=Mon ... 6=Sat. @-macros are expanded to standard 5-field form.
            </p>
          </div>
        </details>

        <p className="cron-privacy-note">
          Runs entirely in your browser. No data leaves your device.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
