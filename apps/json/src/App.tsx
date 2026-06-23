import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { byteSize, formatBytes, repairJson } from "./lib/json";
import type { IndentOption, TreeNode } from "./lib/json";
import { useJsonStore } from "./store/jsonStore";
import type { ViewMode } from "./store/jsonStore";

// ── Sample JSON for the "Load sample" button ──────────────────────────────────

const SAMPLE_JSON = JSON.stringify(
  {
    name: "Alice",
    age: 30,
    active: true,
    tags: ["admin", "editor"],
    address: {
      city: "Wellington",
      country: "NZ",
      postcode: "6011",
    },
    notes: null,
  },
  null,
  2
);

// ── JSON brand glyph: curly-brace mark in teal/amber/coral ───────────────────

function JsonBrandGlyph() {
  return (
    <>
      {/* Left brace, teal */}
      <path
        d="M12 3 C9.5 3 8 4.5 8 7 L8 13 C8 14.5 6.5 15.5 5 16 C6.5 16.5 8 17.5 8 19 L8 25 C8 27.5 9.5 29 12 29"
        stroke="#2f9d8d"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Right brace, coral */}
      <path
        d="M20 3 C22.5 3 24 4.5 24 7 L24 13 C24 14.5 25.5 15.5 27 16 C25.5 16.5 24 17.5 24 19 L24 25 C24 27.5 22.5 29 20 29"
        stroke="#d9594c"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Colon dots, amber */}
      <circle cx="16" cy="13" r="1.5" fill="#e8b04b" />
      <circle cx="16" cy="19" r="1.5" fill="#e8b04b" />
    </>
  );
}

// ── Indent toggle ─────────────────────────────────────────────────────────────

const INDENT_OPTIONS: { value: IndentOption; label: string }[] = [
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: "tab", label: "Tab" },
];

// ── View mode toggle ──────────────────────────────────────────────────────────

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "formatted", label: "Format" },
  { value: "minified", label: "Minify" },
  { value: "tree", label: "Tree" },
];

// ── Tree node renderer ────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
}

function TreeNodeView({ node, depth }: TreeNodeProps) {
  const [collapsed, setCollapsed] = useState(depth > 3);

  const indent = depth * 16;

  if (node.kind === "primitive") {
    return (
      <div className="json-tree-row" style={{ paddingLeft: `${indent + 20}px` }}>
        {node.key !== null && (
          <>
            <span className="json-tree-key">{JSON.stringify(node.key)}</span>
            <span className="json-tree-colon">: </span>
          </>
        )}
        <span className={`json-tree-val json-tree-val--${node.valueKind}`}>{node.value}</span>
      </div>
    );
  }

  const isArray = node.kind === "array";
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const label = node.count === 1 ? "1 item" : `${node.count} items`;

  return (
    <div>
      <button
        type="button"
        className="json-tree-row json-tree-row--collapsible"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className={`json-tree-chevron${collapsed ? "" : " json-tree-chevron--open"}`}>▶</span>
        {node.key !== null && (
          <>
            <span className="json-tree-key">{JSON.stringify(node.key)}</span>
            <span className="json-tree-colon">: </span>
          </>
        )}
        <span className="json-tree-bracket">{openBracket}</span>
        {collapsed && (
          <>
            <span className="json-tree-collapsed-hint"> {label} </span>
            <span className="json-tree-bracket">{closeBracket}</span>
          </>
        )}
      </button>
      {!collapsed && (
        <>
          {node.children.map((child, idx) => (
            // key uses idx because tree children at same level are stable positionally
            // eslint-disable-next-line react/no-array-index-key
            <TreeNodeView key={`${child.key ?? ""}:${idx}`} node={child} depth={depth + 1} />
          ))}
          <div className="json-tree-row" style={{ paddingLeft: `${indent + 4}px` }}>
            <span className="json-tree-bracket">{closeBracket}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
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
      aria-label={label}
      disabled={!text}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Download button ───────────────────────────────────────────────────────────

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [text, filename]);

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={handleDownload}
      disabled={!text}
      aria-label={`Download as ${filename}`}
    >
      Download
    </button>
  );
}

// ── File open / drag-drop ─────────────────────────────────────────────────────

function useFileDrop(onContent: (text: string) => void) {
  const [dragging, setDragging] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === "string") {
          onContent(ev.target.result);
        }
      };
      reader.readAsText(file);
    },
    [onContent]
  );

  return { dragging, onDragOver, onDragLeave, onDrop };
}

// ── JSONPath query panel ──────────────────────────────────────────────────────

function QueryPanel() {
  const { queryExpr, queryResults, queryError, setQueryExpr, input } = useJsonStore();
  const hasInput = input.trim().length > 0;

  if (!hasInput) return null;

  const resultText =
    queryResults !== null
      ? JSON.stringify(
          queryResults.map((r) => r.value),
          null,
          2
        )
      : "";

  return (
    <div className="card json-query-panel">
      <div className="json-panel-header">
        <span className="json-panel-label">JSONPath Query</span>
        {queryResults !== null && (
          <span className="json-stat">
            {queryResults.length} {queryResults.length === 1 ? "match" : "matches"}
          </span>
        )}
        {queryResults !== null && resultText && (
          <div className="json-output-actions">
            <CopyButton text={resultText} label="Copy query results" />
          </div>
        )}
      </div>
      <div className="json-query-input-row">
        <input
          className="json-query-input"
          type="text"
          value={queryExpr}
          onChange={(e) => setQueryExpr(e.target.value)}
          placeholder="$.address.city  or  $.tags[*]  or  $..name"
          aria-label="JSONPath expression"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        {queryExpr && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setQueryExpr("")}
            aria-label="Clear query"
          >
            Clear
          </button>
        )}
      </div>
      {queryError && (
        <div className="json-error" role="alert">
          <span className="json-error-icon">!</span>
          <span className="json-error-msg">{queryError}</span>
        </div>
      )}
      {queryResults !== null && queryResults.length === 0 && !queryError && (
        <p className="json-query-empty">No matches found.</p>
      )}
      {queryResults !== null && queryResults.length > 0 && (
        <textarea
          className="json-textarea json-query-results"
          value={resultText}
          readOnly
          aria-label="Query results"
          aria-readonly="true"
          spellCheck={false}
        />
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    input,
    output,
    viewMode,
    indent,
    sortKeysEnabled,
    parseError,
    tree,
    processing,
    setInput,
    setViewMode,
    setIndent,
    setSortKeys,
    clearInput,
  } = useJsonStore();

  const hasInput = input.trim().length > 0;
  const isValid = hasInput && !parseError;

  const inputBytes = byteSize(input);
  const outputBytes = output ? byteSize(output) : 0;

  const loadSample = useCallback(() => {
    setInput(SAMPLE_JSON);
  }, [setInput]);

  // File open via picker
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileOpen = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === "string") {
          setInput(ev.target.result);
        }
      };
      reader.readAsText(file);
      // Reset so same file can be opened again
      e.target.value = "";
    },
    [setInput]
  );

  // Drag-drop on input panel
  const { dragging, onDragOver, onDragLeave, onDrop } = useFileDrop(setInput);

  // JSON repair button
  const [repairError, setRepairError] = useState<string | null>(null);
  const handleRepair = useCallback(() => {
    try {
      const repaired = repairJson(input);
      setInput(repaired);
      setRepairError(null);
    } catch {
      setRepairError("Could not repair automatically. Check for deeply malformed JSON.");
    }
  }, [input, setInput]);

  // Cmd/Ctrl+Enter triggers format (primary action)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        // Re-process the current input (triggers reformat)
        if (hasInput) {
          setViewMode(viewMode === "minified" ? "minified" : "formatted");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasInput, viewMode, setViewMode]);

  return (
    <div className="app-root">
      <Header
        title="JSON Formatter"
        subtitle="format, validate &amp; minify json"
        brandMark={
          <BrandMark label="JSON Formatter">
            <JsonBrandGlyph />
          </BrandMark>
        }
        controls={
          <div className="json-header-controls">
            {/* View mode toggle */}
            <div className="space-toggle-wrapper">
              <span className="space-toggle-label">Mode</span>
              <div className="space-toggle" role="radiogroup" aria-label="Output mode">
                {VIEW_MODES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`space-btn${viewMode === value ? " space-btn--active" : ""}`}
                    onClick={() => setViewMode(value)}
                    aria-pressed={viewMode === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Indent toggle, only relevant in formatted/tree mode */}
            {viewMode !== "minified" && (
              <div className="space-toggle-wrapper">
                <span className="space-toggle-label">Indent</span>
                <div className="space-toggle" role="radiogroup" aria-label="Indent size">
                  {INDENT_OPTIONS.map(({ value, label }) => (
                    <button
                      key={String(value)}
                      type="button"
                      className={`space-btn${indent === value ? " space-btn--active" : ""}`}
                      onClick={() => setIndent(value)}
                      aria-pressed={indent === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort keys toggle */}
            <div className="space-toggle-wrapper">
              <span className="space-toggle-label">Sort keys</span>
              <button
                type="button"
                className={`space-btn json-sort-btn${sortKeysEnabled ? " space-btn--active" : ""}`}
                onClick={() => setSortKeys(!sortKeysEnabled)}
                aria-pressed={sortKeysEnabled}
              >
                {sortKeysEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>
        }
      />

      <main className="site-main">
        {/* ── Input / Output panels ── */}
        <div className="json-layout">
          {/* Input panel */}
          <div
            className={`card json-panel${dragging ? " json-panel--dragover" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="json-panel-header">
              <span className="json-panel-label">Input</span>
              {hasInput && <span className="json-stat">{formatBytes(inputBytes)}</span>}
              <div className="json-input-actions">
                {!hasInput && (
                  <>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleFileOpen}
                      aria-label="Open JSON file"
                    >
                      Open file
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={loadSample}
                      aria-label="Load sample JSON"
                    >
                      Sample
                    </button>
                  </>
                )}
                {hasInput && parseError && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRepair}
                    aria-label="Attempt to repair JSON"
                  >
                    Repair
                  </button>
                )}
                {hasInput && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={clearInput}
                    aria-label="Clear input"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              style={{ display: "none" }}
              onChange={handleFileChange}
              aria-label="File picker for JSON"
            />
            <textarea
              className="json-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={'Paste your JSON here, or open/drop a file\n\n{\n  "example": true\n}'}
              aria-label="JSON input"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            {dragging && (
              <div className="json-drop-hint" aria-hidden>
                Drop .json file here
              </div>
            )}
            {repairError && (
              <div className="json-error" role="alert" aria-live="polite">
                <span className="json-error-icon">!</span>
                <span className="json-error-msg">{repairError}</span>
              </div>
            )}
            {parseError && !repairError && (
              <div className="json-error" role="alert" aria-live="polite">
                <span className="json-error-icon">✕</span>
                <span className="json-error-loc">
                  Line {parseError.line}, Col {parseError.col}
                </span>
                <span className="json-error-msg">{parseError.message}</span>
              </div>
            )}
            {isValid && (
              <p className="json-valid" aria-live="polite">
                <span className="json-valid-icon">✓</span>
                <span>Valid JSON</span>
              </p>
            )}
          </div>

          {/* Output panel */}
          <div className="card json-panel">
            <div className="json-panel-header">
              <span className="json-panel-label">
                {processing
                  ? "Processing..."
                  : viewMode === "formatted"
                    ? "Formatted"
                    : viewMode === "minified"
                      ? "Minified"
                      : "Tree View"}
              </span>
              {isValid && output && !processing && (
                <span className="json-stat">{formatBytes(outputBytes)}</span>
              )}
              {isValid && !processing && (
                <div className="json-output-actions">
                  {viewMode === "tree" && tree ? (
                    <CopyButton text={output} label="Copy formatted JSON to clipboard" />
                  ) : output ? (
                    <>
                      <CopyButton text={output} label="Copy output to clipboard" />
                      <DownloadButton
                        text={output}
                        filename={viewMode === "minified" ? "output.min.json" : "output.json"}
                      />
                    </>
                  ) : null}
                </div>
              )}
            </div>

            {processing ? (
              <div className="json-processing" aria-live="polite">
                <span className="json-processing-spinner" aria-hidden />
                <span>Formatting large document...</span>
              </div>
            ) : viewMode === "tree" && tree ? (
              <div className="json-tree-root" aria-label="JSON tree view">
                <TreeNodeView node={tree} depth={0} />
              </div>
            ) : (
              <textarea
                className="json-textarea"
                value={isValid ? output : ""}
                readOnly
                placeholder={parseError ? "Fix the error to see output" : "Output will appear here"}
                aria-label="JSON output"
                aria-readonly="true"
                spellCheck={false}
              />
            )}
          </div>
        </div>

        {/* JSONPath query panel */}
        <QueryPanel />

        <p className="json-privacy-note">
          Runs entirely in your browser, no data is uploaded or stored. Cmd+Enter to reformat.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
