import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  COMMON_PATTERNS,
  SUBSTITUTION_REFS,
  explainPattern,
  formatCaptureGroupsForCopy,
  formatMatchTextsForCopy,
  formatMatchesForCopy,
  generateCodeExport,
} from "./lib/regex";
import type { CodeLang, RegexFlag } from "./lib/regex";
import { useRegexStore } from "./store/regexStore";

// ── Brand glyph: slash / dot . asterisk * in teal/amber/coral ────────────────

function RegexBrandGlyph() {
  return (
    <>
      {/* Forward slash, teal */}
      <line
        x1="20"
        y1="4"
        x2="12"
        y2="28"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Dot, amber */}
      <circle cx="8" cy="22" r="2.2" fill="#e8b04b" />
      {/* Asterisk, coral */}
      <line
        x1="25"
        y1="11"
        x2="25"
        y2="19"
        stroke="#d9594c"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="21.5"
        y1="12.5"
        x2="28.5"
        y2="17.5"
        stroke="#d9594c"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="28.5"
        y1="12.5"
        x2="21.5"
        y2="17.5"
        stroke="#d9594c"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  );
}

// ── Flag definitions ──────────────────────────────────────────────────────────

const FLAG_DEFS: { flag: RegexFlag; label: string; title: string; locked?: boolean }[] = [
  { flag: "g", label: "g", title: "global, find all matches", locked: true },
  { flag: "i", label: "i", title: "case-insensitive" },
  { flag: "m", label: "m", title: "multiline, ^ and $ match line start/end" },
  { flag: "s", label: "s", title: "dotAll, . matches newlines too" },
  { flag: "u", label: "u", title: "unicode, full unicode support" },
];

// ── Highlighted text renderer ─────────────────────────────────────────────────
// Splits testText by match spans and renders coloured highlights.

const MATCH_COLORS = 5;

interface HighlightedTextProps {
  text: string;
  matches: { start: number; end: number; matchIndex: number }[];
}

function HighlightedText({ text, matches }: HighlightedTextProps) {
  if (matches.length === 0) {
    return <div className="rx-highlight-root">{text}</div>;
  }

  // Build an array of segments: plain text + highlighted spans
  const segments: { text: string; matchIndex: number | null; offset: number }[] = [];
  let cursor = 0;

  for (const m of matches) {
    if (m.start > cursor) {
      segments.push({ text: text.slice(cursor, m.start), matchIndex: null, offset: cursor });
    }
    segments.push({ text: text.slice(m.start, m.end), matchIndex: m.matchIndex, offset: m.start });
    cursor = m.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matchIndex: null, offset: cursor });
  }

  return (
    <div className="rx-highlight-root" aria-label="Test text with matches highlighted">
      {segments.map((seg) => {
        if (seg.matchIndex === null) {
          return <span key={seg.offset}>{seg.text}</span>;
        }
        const colorClass = `rx-match-${seg.matchIndex % MATCH_COLORS}`;
        return (
          <mark key={seg.offset} className={colorClass}>
            {seg.text}
          </mark>
        );
      })}
    </div>
  );
}

// ── Seed example: first library pattern ──────────────────────────────────────

const SEED_PATTERN = COMMON_PATTERNS[0]; // Email address

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({
  text,
  label = "Copy",
  title,
}: {
  text: string;
  label?: string;
  title?: string;
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
      className="btn-secondary"
      onClick={handleCopy}
      disabled={!text}
      title={title}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    pattern,
    flags,
    testText,
    replacement,
    activeTab,
    result,
    replaceOutput,
    setPattern,
    toggleFlag,
    setTestText,
    setReplacement,
    setActiveTab,
    loadCommonPattern,
    clearAll,
  } = useRegexStore();

  const matchCount = result.ok ? result.matchCount : 0;
  const matches = result.ok ? result.matches : [];
  const hasPattern = pattern.trim().length > 0;
  const hasError = !result.ok;
  const hasCaptures = matches.some((m) => m.groups.length > 0);

  const explanation = hasPattern ? explainPattern(pattern) : [];

  // Code-gen export language selector
  const [codeLang, setCodeLang] = useState<CodeLang>("javascript");
  const codeSnippet = generateCodeExport(pattern, flags, testText, codeLang);

  const TAB_DEFS = [
    {
      id: "matches" as const,
      label: `Matches${hasPattern && result.ok ? ` (${matchCount})` : ""}`,
    },
    { id: "replace" as const, label: "Replace" },
    { id: "explain" as const, label: "Explain" },
    { id: "export" as const, label: "Export" },
    { id: "library" as const, label: "Library" },
  ];

  // Cmd/Ctrl+Enter: copy match texts to clipboard (fleet-wide power-user shortcut)
  const patternInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (matches.length > 0) {
          void navigator.clipboard.writeText(formatMatchTextsForCopy(matches));
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [matches]);

  return (
    <div className="app-root">
      <Header
        title="Regex Tester"
        subtitle="live match highlighting, plain-english explanations"
        brandMark={
          <BrandMark label="Regex Tester">
            <RegexBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* ── Pattern input ── */}
        <div className="card rx-panel">
          <div
            className={`rx-pattern-row${hasError && hasPattern ? " rx-pattern-row--error" : ""}`}
          >
            <span className="rx-slash" aria-hidden="true">
              /
            </span>
            <input
              ref={patternInputRef}
              className="rx-pattern-input"
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Enter a regex pattern..."
              aria-label="Regex pattern"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <span className="rx-slash rx-slash--right" aria-hidden="true">
              /
            </span>
            <fieldset
              className="rx-flags-inline"
              aria-label="Regex flags"
              style={{ border: "none", padding: 0, margin: 0 }}
            >
              {FLAG_DEFS.map(({ flag, label, title, locked }) => (
                <button
                  key={flag}
                  type="button"
                  className={`rx-flag-btn${flags.has(flag) ? " rx-flag-btn--active" : ""}`}
                  onClick={() => toggleFlag(flag)}
                  aria-pressed={flags.has(flag)}
                  title={title}
                  disabled={locked}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </div>

          {/* Action row: seed example + clear */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {!hasPattern && (
              <button
                type="button"
                className="rx-seed-btn"
                onClick={() => loadCommonPattern(SEED_PATTERN)}
                aria-label="Load an example pattern"
              >
                Try an example
              </button>
            )}
            {(hasPattern || testText) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={clearAll}
                aria-label="Clear pattern and test string"
              >
                Clear
              </button>
            )}
          </div>

          {hasError && hasPattern && (
            <div className="rx-error" role="alert" aria-live="polite">
              <span style={{ flexShrink: 0, fontWeight: 700 }}>Error</span>
              <span>{result.message}</span>
            </div>
          )}
        </div>

        {/* ── Two-panel layout: test text + output ── */}
        <div className="rx-layout">
          {/* Left: test text input */}
          <div className="card rx-panel">
            <div className="rx-panel-header">
              <span className="rx-panel-label">Test string</span>
              {hasPattern && result.ok && matchCount > 0 && (
                <span className="rx-stat rx-stat--matches">
                  {matchCount} {matchCount === 1 ? "match" : "matches"}
                </span>
              )}
              {hasPattern && result.ok && matchCount === 0 && (
                <span className="rx-stat">no matches</span>
              )}
            </div>

            <textarea
              className="rx-textarea"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter test string..."
              aria-label="Test string"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />

            {/* Highlighted view below the textarea */}
            {hasPattern && result.ok && matches.length > 0 && (
              <>
                <span className="rx-panel-label" style={{ marginTop: "0.25rem" }}>
                  Highlighted
                </span>
                <HighlightedText text={testText} matches={matches} />
              </>
            )}
          </div>

          {/* Right: tabbed output */}
          <div className="card rx-panel">
            <div className="rx-output-tabs">
              {/* Tab bar */}
              <div className="rx-tabs" role="tablist" aria-label="Output tabs">
                {TAB_DEFS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === id}
                    className={`space-btn${activeTab === id ? " space-btn--active" : ""}`}
                    onClick={() => setActiveTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Matches tab */}
              {activeTab === "matches" && (
                <div role="tabpanel" aria-label="Matches">
                  {!hasPattern && (
                    <p className="rx-empty">Enter a pattern above to see matches here.</p>
                  )}
                  {hasPattern && hasError && (
                    <p className="rx-empty">Fix the pattern error to see matches.</p>
                  )}
                  {hasPattern && result.ok && matchCount === 0 && (
                    <p className="rx-empty">No matches found.</p>
                  )}
                  {hasPattern && result.ok && matchCount > 0 && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.4rem",
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <CopyButton
                          text={formatMatchTextsForCopy(matches)}
                          label="Copy texts"
                          title="Copy matched values, one per line"
                        />
                        {hasCaptures && (
                          <CopyButton
                            text={formatCaptureGroupsForCopy(matches)}
                            label="Copy groups"
                            title="Copy capture group values, one per line"
                          />
                        )}
                        <CopyButton
                          text={formatMatchesForCopy(matches)}
                          label="Copy all"
                          title="Copy matches with positions and groups"
                        />
                      </div>
                      <div className="rx-match-list">
                        {matches.map((m) => (
                          <div key={m.matchIndex} className="rx-match-item">
                            <div className="rx-match-header">
                              <span className="rx-match-badge">#{m.matchIndex + 1}</span>
                              <span className="rx-match-text">{m.text || "(empty match)"}</span>
                              <span className="rx-match-pos">
                                {m.start}..{m.end}
                              </span>
                            </div>
                            {m.groups.length > 0 && (
                              <div className="rx-capture-list">
                                {m.groups.map((g) => (
                                  <span
                                    key={g.index}
                                    className="rx-capture-chip"
                                    title={
                                      g.name ? `Group ${g.index}: ${g.name}` : `Group ${g.index}`
                                    }
                                  >
                                    {g.name ? `${g.name}: ` : `$${g.index}: `}
                                    {g.value ?? "(unmatched)"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Replace tab */}
              {activeTab === "replace" && (
                <div role="tabpanel" aria-label="Replace">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div>
                      <p className="rx-replace-label">Replacement string</p>
                      <input
                        className="rx-replace-input"
                        type="text"
                        value={replacement}
                        onChange={(e) => setReplacement(e.target.value)}
                        placeholder="e.g. [$&] or $1-$2 or $<name>"
                        aria-label="Replacement string"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <p className="rx-replace-label" style={{ margin: 0 }}>
                          Result
                        </p>
                        <CopyButton text={replaceOutput} />
                      </div>
                      <div className="rx-replace-output">{replaceOutput}</div>
                    </div>
                    {/* Substitution reference */}
                    <div>
                      <p className="rx-replace-label" style={{ marginBottom: "0.4rem" }}>
                        Substitution reference
                      </p>
                      <div className="rx-subst-table">
                        {SUBSTITUTION_REFS.map((ref) => (
                          <div key={ref.token} className="rx-subst-row">
                            <span className="rx-subst-token">{ref.token}</span>
                            <span className="rx-subst-meaning">{ref.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Explain tab */}
              {activeTab === "explain" && (
                <div role="tabpanel" aria-label="Explain">
                  {!hasPattern && (
                    <p className="rx-empty">Enter a pattern to see a plain-English breakdown.</p>
                  )}
                  {hasPattern && explanation.length === 0 && (
                    <p className="rx-empty">Nothing to explain yet.</p>
                  )}
                  {hasPattern && explanation.length > 0 && (
                    <div className="rx-explain-list">
                      {explanation.map((tok, idx) => (
                        // idx is stable here: explanation is a pure function of pattern string
                        // and tokens at same position can share raw text; compound key is safe.
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: explanation tokens have no stable identity; idx is safe here because pattern drives a pure transform
                          key={idx}
                          className={`rx-explain-row rx-explain-row--${tok.kind}`}
                        >
                          <span className="rx-explain-token">{tok.raw}</span>
                          <span className="rx-explain-desc">{tok.explanation}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Export tab */}
              {activeTab === "export" && (
                <div role="tabpanel" aria-label="Code export">
                  {!hasPattern && <p className="rx-empty">Enter a pattern to generate code.</p>}
                  {hasPattern && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {(
                          [
                            ["javascript", "JavaScript"],
                            ["python", "Python"],
                            ["go", "Go"],
                            ["php", "PHP"],
                          ] as [CodeLang, string][]
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={`rx-lang-btn${codeLang === id ? " rx-lang-btn--active" : ""}`}
                            onClick={() => setCodeLang(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div style={{ position: "relative" }}>
                        <pre className="rx-code-block">{codeSnippet}</pre>
                        <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}>
                          <CopyButton text={codeSnippet} label="Copy code" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Library tab */}
              {activeTab === "library" && (
                <div role="tabpanel" aria-label="Common patterns library">
                  <div className="rx-library-grid">
                    {COMMON_PATTERNS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="rx-library-card"
                        onClick={() => {
                          loadCommonPattern(p);
                          setActiveTab("matches");
                        }}
                        aria-label={`Load pattern: ${p.label}`}
                      >
                        <div className="rx-library-label">{p.label}</div>
                        <div className="rx-library-desc">{p.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="rx-privacy-note">
          Runs entirely in your browser. No data is uploaded or stored. A free regex101 alternative.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
