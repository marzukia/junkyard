import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import type { Delimiter, OutputFormat } from "./lib/csv";
import { useCsvStore } from "./store/csvStore";

// ── CSV brand glyph: grid of cells ───────────────────────────────────────────
// Three rows of cells with teal/amber/coral accents, evokes a spreadsheet.

function CsvBrandGlyph() {
  return (
    <>
      {/* Grid lines */}
      <rect x="4" y="4" width="24" height="24" rx="3" stroke="#2f9d8d" strokeWidth="2" />
      {/* Vertical divider */}
      <line x1="13" y1="4" x2="13" y2="28" stroke="#2f9d8d" strokeWidth="1.5" />
      <line x1="22" y1="4" x2="22" y2="28" stroke="#2f9d8d" strokeWidth="1.5" />
      {/* Horizontal dividers */}
      <line x1="4" y1="12" x2="28" y2="12" stroke="#2f9d8d" strokeWidth="1.5" />
      <line x1="4" y1="20" x2="28" y2="20" stroke="#2f9d8d" strokeWidth="1.5" />
      {/* Header row accent, teal fill */}
      <rect x="4.75" y="4.75" width="7.5" height="6.5" rx="1.5" fill="#2f9d8d" opacity="0.35" />
      <rect x="13.75" y="4.75" width="7.5" height="6.5" rx="1.5" fill="#2f9d8d" opacity="0.35" />
      <rect x="22.75" y="4.75" width="4.5" height="6.5" rx="1.5" fill="#2f9d8d" opacity="0.35" />
      {/* Data cell accents, amber */}
      <rect x="4.75" y="12.75" width="7.5" height="6.5" rx="1.5" fill="#e8b04b" opacity="0.4" />
      {/* Data cell accents, coral */}
      <rect x="13.75" y="20.75" width="7.5" height="6.5" rx="1.5" fill="#d9594c" opacity="0.4" />
    </>
  );
}

// ── Sample data ───────────────────────────────────────────────────────────────

const EXAMPLE_CSV = `name,age,city,active
Alice,30,Auckland,true
Bob,25,Wellington,false
Carol,35,Christchurch,true`;

const EXAMPLE_JSON = `[
  { "name": "Alice", "age": 30, "city": "Auckland" },
  { "name": "Bob", "age": 25, "city": "Wellington" },
  { "name": "Carol", "age": 35, "city": "Christchurch" }
]`;

// ── Delimiter labels ──────────────────────────────────────────────────────────

const DELIMITER_OPTIONS: { value: Delimiter; label: string }[] = [
  { value: ",", label: "Comma" },
  { value: "\t", label: "Tab" },
  { value: ";", label: "Semi" },
  { value: "|", label: "Pipe" },
];

// ── Output format options (csv-to-X) ─────────────────────────────────────────

const OUTPUT_FORMAT_OPTIONS: { value: OutputFormat; label: string; ext: string; mime: string }[] = [
  { value: "json", label: "JSON", ext: "json", mime: "application/json" },
  { value: "markdown", label: "MD", ext: "md", mime: "text/markdown" },
  { value: "sql", label: "SQL", ext: "sql", mime: "text/plain" },
  { value: "xml", label: "XML", ext: "xml", mime: "application/xml" },
  { value: "yaml", label: "YAML", ext: "yaml", mime: "text/yaml" },
];

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

function DownloadButton({
  text,
  filename,
  mimeType,
}: {
  text: string;
  filename: string;
  mimeType: string;
}) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [text, filename, mimeType]);

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

// ── File upload ───────────────────────────────────────────────────────────────

function FileUpload({
  onLoad,
  onError,
}: {
  onLoad: (text: string) => void;
  onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reject obviously non-text files (images, PDFs, etc.)
    if (
      file.type &&
      !file.type.startsWith("text/") &&
      file.type !== "application/json" &&
      !["", "application/csv"].includes(file.type)
    ) {
      onError(`Cannot read "${file.name}" — only CSV, TSV, JSON, or plain-text files are supported.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        onError("");
        onLoad(text);
      }
    };
    reader.onerror = () => {
      onError(`Failed to read "${file.name}".`);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-loaded
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => inputRef.current?.click()}
        aria-label="Upload a file"
      >
        Upload file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.json"
        style={{ display: "none" }}
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}

// ── Table viewer ──────────────────────────────────────────────────────────────

interface TableViewerProps {
  headers: string[];
  rows: string[][];
  sortCol: number;
  sortDir: "asc" | "desc" | null;
  onSort: (col: number) => void;
}

function TableViewer({ headers, rows, sortCol, sortDir, onSort }: TableViewerProps) {
  const displayRows =
    sortCol >= 0 && sortDir !== null
      ? [...rows].sort((a, b) => {
          const av = a[sortCol] ?? "";
          const bv = b[sortCol] ?? "";
          const numA = Number(av);
          const numB = Number(bv);
          const isNum = !Number.isNaN(numA) && !Number.isNaN(numB);
          const cmp = isNum ? numA - numB : av.localeCompare(bv);
          return sortDir === "asc" ? cmp : -cmp;
        })
      : rows;

  return (
    <section className="csv-table-wrapper" aria-label="Data table">
      <table className="csv-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                // biome-ignore lint/suspicious/noArrayIndexKey: column position is the stable identity for display
                key={`h-${i}`}
                scope="col"
                aria-sort={
                  sortCol === i ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                }
              >
                <button type="button" className="csv-th-btn" onClick={() => onSort(i)}>
                  <span className="csv-th-label">
                    {h || <em className="csv-th-empty">(empty)</em>}
                  </span>
                  <span
                    className={`csv-sort-icon${sortCol === i ? " csv-sort-icon--active" : ""}`}
                    aria-hidden="true"
                  >
                    {sortCol === i && sortDir === "asc"
                      ? "↑"
                      : sortCol === i && sortDir === "desc"
                        ? "↓"
                        : "↕"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, ri) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: row position is the stable identity for display
            <tr key={`r-${ri}`}>
              {headers.map((_, ci) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: column position is the stable identity
                <td key={`c-${ci}`}>{row[ci] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    mode,
    input,
    delimiter,
    autoDelimiter,
    hasHeader,
    outputFormat,
    parsed,
    parseError,
    output,
    outputError,
    sort,
    setMode,
    setInput,
    setDelimiter,
    setAutoDelimiter,
    setHasHeader,
    setOutputFormat,
    setSort,
  } = useCsvStore();

  const [viewMode, setViewMode] = useState<"table" | "raw">("table");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadExample = useCallback(() => {
    setInput(mode === "csv-to-json" ? EXAMPLE_CSV : EXAMPLE_JSON);
  }, [mode, setInput]);

  // Cmd/Ctrl+Enter: load example if input is empty, otherwise a no-op
  // (conversion is reactive; this gives keyboard users a shortcut to seed data).
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!input.trim()) {
          loadExample();
        }
        // When there is input, conversion is already live; nothing extra to trigger.
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [input, loadExample]);

  const currentFormat =
    OUTPUT_FORMAT_OPTIONS.find((f) => f.value === outputFormat) ?? OUTPUT_FORMAT_OPTIONS[0];

  const hasOutput = output.trim().length > 0;
  const showTable =
    mode === "csv-to-json" && viewMode === "table" && outputFormat === "json" && parsed !== null;

  const outputLabel = mode === "csv-to-json" ? currentFormat.label : "CSV";
  const outputFilename = mode === "csv-to-json" ? `output.${currentFormat.ext}` : "output.csv";
  const outputMime = mode === "csv-to-json" ? currentFormat.mime : "text/csv";

  const inputLabel = mode === "csv-to-json" ? "CSV input" : "JSON input";
  const inputPlaceholder =
    mode === "csv-to-json"
      ? "Paste CSV here or upload a file...\n\nname,age,city\nAlice,30,Auckland\nBob,25,Wellington"
      : 'Paste JSON here or upload a file...\n\n[\n  { "name": "Alice", "age": 30 },\n  { "name": "Bob", "age": 25 }\n]';

  // Ragged row warnings: cap display at 3 to avoid overwhelming the panel.
  const raggedWarnings = parsed?.raggedWarnings ?? [];
  const showRaggedWarnings = raggedWarnings.length > 0;
  const raggedPreview = raggedWarnings.slice(0, 3);
  const raggedExtra = raggedWarnings.length - raggedPreview.length;

  return (
    <div className="app-root">
      <Header
        title="CSV Converter"
        subtitle="csv to json. json to csv. free, private, no upload."
        brandMark={
          <BrandMark label="CSV Converter">
            <CsvBrandGlyph />
          </BrandMark>
        }
        controls={
          <div className="csv-header-controls">
            {/* Mode toggle */}
            <div className="space-toggle-wrapper">
              <span className="space-toggle-label">Mode</span>
              <div className="space-toggle" role="group" aria-label="Conversion mode">
                <button
                  type="button"
                  className={`space-btn${mode === "csv-to-json" ? " space-btn--active" : ""}`}
                  onClick={() => setMode("csv-to-json")}
                  aria-pressed={mode === "csv-to-json"}
                >
                  CSV to X
                </button>
                <button
                  type="button"
                  className={`space-btn${mode === "json-to-csv" ? " space-btn--active" : ""}`}
                  onClick={() => setMode("json-to-csv")}
                  aria-pressed={mode === "json-to-csv"}
                >
                  JSON to CSV
                </button>
              </div>
            </div>

            {/* Delimiter controls (CSV-relevant in both modes) */}
            <div className="space-toggle-wrapper">
              <span className="space-toggle-label">Delim</span>
              <div className="space-toggle" role="group" aria-label="CSV delimiter">
                {mode === "csv-to-json" && (
                  <button
                    type="button"
                    className={`space-btn${autoDelimiter ? " space-btn--active" : ""}`}
                    onClick={() => setAutoDelimiter(true)}
                    aria-pressed={autoDelimiter}
                  >
                    Auto
                  </button>
                )}
                {DELIMITER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={label}
                    type="button"
                    className={`space-btn${!autoDelimiter && delimiter === value ? " space-btn--active" : ""}`}
                    onClick={() => setDelimiter(value)}
                    aria-pressed={!autoDelimiter && delimiter === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Header toggle, only relevant for CSV input */}
            {mode === "csv-to-json" && (
              <div className="space-toggle-wrapper">
                <span className="space-toggle-label">Header</span>
                <div className="space-toggle" role="group" aria-label="Header row">
                  <button
                    type="button"
                    className={`space-btn${hasHeader ? " space-btn--active" : ""}`}
                    onClick={() => setHasHeader(true)}
                    aria-pressed={hasHeader}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`space-btn${!hasHeader ? " space-btn--active" : ""}`}
                    onClick={() => setHasHeader(false)}
                    aria-pressed={!hasHeader}
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      />

      <main className="site-main">
        <div className="csv-layout">
          {/* Input panel */}
          <div className="card csv-panel">
            <div className="csv-panel-header">
              <span className="csv-panel-label">{inputLabel}</span>
              {input.trim() && !parseError && parsed && (
                <span className="csv-stat">
                  {parsed.rowCount} row{parsed.rowCount !== 1 ? "s" : ""} of{" "}
                  {parsed.nonEmptyLineCount} line{parsed.nonEmptyLineCount !== 1 ? "s" : ""}
                  {", "}
                  {parsed.colCount} col{parsed.colCount !== 1 ? "s" : ""}
                </span>
              )}
              <div className="csv-panel-actions">
                <FileUpload onLoad={(t) => { setUploadError(null); setInput(t); }} onError={(m) => setUploadError(m || null)} />
                {!input.trim() && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={loadExample}
                    aria-label="Load example data"
                  >
                    Example
                  </button>
                )}
                {input.trim() && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setInput("")}
                    aria-label="Clear input"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="csv-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={inputPlaceholder}
              aria-label={inputLabel}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            {uploadError && (
              <div className="csv-error" role="alert" aria-live="polite">
                <span className="csv-error-icon">!</span>
                <span className="csv-error-msg">{uploadError}</span>
              </div>
            )}
            {parseError && (
              <div className="csv-error" role="alert" aria-live="polite">
                <span className="csv-error-icon">!</span>
                <span className="csv-error-msg">{parseError}</span>
              </div>
            )}
            {mode === "csv-to-json" && parsed && !parseError && (
              <p className="csv-valid" aria-live="polite">
                <span className="csv-valid-icon">&#x2713;</span>
                <span>
                  Parsed {parsed.rowCount} row{parsed.rowCount !== 1 ? "s" : ""} of{" "}
                  {parsed.nonEmptyLineCount} non-empty line
                  {parsed.nonEmptyLineCount !== 1 ? "s" : ""}
                  {autoDelimiter ? ` (detected: ${delimiter === "\t" ? "tab" : delimiter})` : ""}
                </span>
              </p>
            )}
            {showRaggedWarnings && (
              <div className="csv-warn" role="alert" aria-live="polite">
                <span className="csv-warn-icon">!</span>
                <span className="csv-warn-msg">
                  Inconsistent column counts:
                  {raggedPreview.map((w) => (
                    <span key={w.rowIndex} className="csv-warn-item">
                      {" "}
                      Row {w.rowIndex} has {w.actual} field{w.actual !== 1 ? "s" : ""}, expected{" "}
                      {w.expected}.
                    </span>
                  ))}
                  {raggedExtra > 0 && (
                    <span className="csv-warn-item">
                      {" "}
                      +{raggedExtra} more row{raggedExtra !== 1 ? "s" : ""}.
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Output panel */}
          <div className="card csv-panel">
            <div className="csv-panel-header">
              <span className="csv-panel-label">{outputLabel} output</span>
              {mode === "csv-to-json" && (
                <div className="space-toggle-wrapper">
                  <div className="space-toggle" role="group" aria-label="Output format">
                    {OUTPUT_FORMAT_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        className={`space-btn${outputFormat === value ? " space-btn--active" : ""}`}
                        onClick={() => setOutputFormat(value)}
                        aria-pressed={outputFormat === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mode === "csv-to-json" && parsed && outputFormat === "json" && (
                <div className="space-toggle-wrapper">
                  <div className="space-toggle" role="group" aria-label="Output view">
                    <button
                      type="button"
                      className={`space-btn${viewMode === "table" ? " space-btn--active" : ""}`}
                      onClick={() => setViewMode("table")}
                      aria-pressed={viewMode === "table"}
                    >
                      Table
                    </button>
                    <button
                      type="button"
                      className={`space-btn${viewMode === "raw" ? " space-btn--active" : ""}`}
                      onClick={() => setViewMode("raw")}
                      aria-pressed={viewMode === "raw"}
                    >
                      Raw
                    </button>
                  </div>
                </div>
              )}
              {hasOutput && (
                <div className="csv-output-actions">
                  <CopyButton text={output} label={`Copy ${outputLabel} to clipboard`} />
                  <DownloadButton text={output} filename={outputFilename} mimeType={outputMime} />
                </div>
              )}
            </div>

            {outputError && (
              <div className="csv-error" role="alert" aria-live="polite">
                <span className="csv-error-icon">!</span>
                <span className="csv-error-msg">{outputError}</span>
              </div>
            )}

            {showTable && parsed ? (
              <TableViewer
                headers={parsed.headers}
                rows={parsed.rows}
                sortCol={sort.col}
                sortDir={sort.dir}
                onSort={setSort}
              />
            ) : (
              <textarea
                className="csv-textarea"
                value={hasOutput ? output : ""}
                readOnly
                placeholder={
                  outputError ? "Fix the error to see output" : "Output will appear here"
                }
                aria-label={`${outputLabel} output`}
                aria-readonly="true"
                spellCheck={false}
              />
            )}
          </div>
        </div>

        <p className="csv-privacy-note">
          Runs entirely in your browser. No data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
