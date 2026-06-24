import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  applyToolbarAction,
  countStats,
  extractToc,
  printAsPdf,
  renderMarkdown,
  wrapHtmlDocument,
} from "./lib/markdown";
import type { TocEntry, ToolbarAction } from "./lib/markdown";
import { useMarkdownStore } from "./store/markdownStore";

// ── Brand glyph, document + lines in teal/amber/coral ───────────────────

function MarkdownBrandGlyph() {
  return (
    <>
      {/* Document outline with dog-ear, stroke only */}
      <path
        d="M6 3 L18 3 L26 11 L26 29 L6 29 Z"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Dog-ear crease */}
      <path
        d="M18 3 L18 11 L26 11"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* M glyph strokes inside the document */}
      <path
        d="M10 22 L10 17 L13 20.5 L16 17 L16 22"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Down-arrow accent in amber */}
      <path d="M20 17 L20 22" stroke="#e8b04b" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M17.5 20 L20 22.5 L22.5 20"
        stroke="#e8b04b"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────

interface ToolBtnProps {
  label: string;
  title: string;
  action: ToolbarAction;
  onAction: (a: ToolbarAction) => void;
}

function ToolBtn({ label, title, action, onAction }: ToolBtnProps) {
  return (
    <button
      type="button"
      className="md-tool-btn"
      title={title}
      aria-label={title}
      onClick={() => onAction(action)}
    >
      {label}
    </button>
  );
}

// ── Copy feedback type ────────────────────────────────────────────────────

type CopiedTarget = "html" | "md" | null;

// ── TOC panel component ───────────────────────────────────────────────────

interface TocPanelProps {
  entries: TocEntry[];
  onNavigate: (slug: string) => void;
}

function TocPanel({ entries, onNavigate }: TocPanelProps) {
  if (entries.length === 0) return null;
  return (
    <div className="md-toc">
      <div className="md-toc-label">contents</div>
      <nav aria-label="Table of contents">
        {entries.map((e, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: order is stable
            key={i}
            type="button"
            className={`md-toc-entry md-toc-h${e.level}`}
            onClick={() => onNavigate(e.slug)}
            title={e.text}
          >
            {e.text}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────

export function App() {
  const { source, setSource, clearSource } = useMarkdownStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedTarget, setCopiedTarget] = useState<CopiedTarget>(null);
  // mobile tab: "edit" or "preview"
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(false);
  // Prevent scroll-sync feedback loop
  const syncingRef = useRef<"editor" | "preview" | null>(null);

  const renderedHtml = useMemo(() => renderMarkdown(source), [source]);
  const stats = useMemo(() => countStats(source), [source]);
  const toc = useMemo(() => extractToc(source), [source]);

  // Keep a stable ref to current source for toolbar without stale closures
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const handleToolbarAction = useCallback(
    (action: ToolbarAction) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const selStart = ta.selectionStart;
      const selEnd = ta.selectionEnd;
      const result = applyToolbarAction(sourceRef.current, selStart, selEnd, action);
      setSource(result.value);
      // Restore selection after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [setSource]
  );

  // ── Scroll sync: editor -> preview ────────────────────────────────────

  const handleEditorScroll = useCallback(() => {
    if (syncingRef.current === "preview") return;
    const ta = textareaRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    syncingRef.current = "editor";
    const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1);
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight);
    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  const handlePreviewScroll = useCallback(() => {
    if (syncingRef.current === "editor") return;
    const ta = textareaRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    syncingRef.current = "preview";
    const ratio = pv.scrollTop / (pv.scrollHeight - pv.clientHeight || 1);
    ta.scrollTop = ratio * (ta.scrollHeight - ta.clientHeight);
    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  // ── TOC navigation: scroll preview to heading ─────────────────────────

  const handleTocNavigate = useCallback((slug: string) => {
    const pv = previewRef.current;
    if (!pv) return;
    // Find heading by id or by text content matching the slug
    const el =
      pv.querySelector(`#${CSS.escape(slug)}`) ||
      Array.from(pv.querySelectorAll("h1,h2,h3,h4,h5,h6")).find(
        (h) =>
          h.textContent
            ?.toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-") === slug
      );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // ── File import helpers ───────────────────────────────────────────────

  const loadFile = useCallback(
    (file: File) => {
      if (
        !file.name.endsWith(".md") &&
        file.type !== "text/markdown" &&
        file.type !== "text/plain"
      ) {
        setFileError("Only .md or plain-text files can be opened here.");
        return;
      }
      setFileError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          setSource(text);
        }
      };
      reader.onerror = () => {
        setFileError(`Failed to read "${file.name}".`);
      };
      reader.readAsText(file);
    },
    [setSource]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFile(file);
      // Reset so the same file can be re-opened
      e.target.value = "";
    },
    [loadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the split container itself
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  // ── Keyboard: Cmd/Ctrl+Enter copies HTML (primary action) ────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void navigator.clipboard.writeText(renderedHtml).then(() => {
          setCopiedTarget("html");
          setTimeout(() => setCopiedTarget(null), 1800);
        });
      }
    },
    [renderedHtml]
  );

  // ── Export / copy actions ─────────────────────────────────────────────

  const exportHtml = useCallback(() => {
    const doc = wrapHtmlDocument(renderedHtml, "Markdown Export");
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markdown-export.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [renderedHtml]);

  const exportPdf = useCallback(() => {
    printAsPdf(renderedHtml, "Markdown Export");
  }, [renderedHtml]);

  const flashCopied = useCallback((target: CopiedTarget) => {
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(null), 1800);
  }, []);

  const copyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(renderedHtml);
      flashCopied("html");
    } catch {
      // Clipboard API unavailable
    }
  }, [renderedHtml, flashCopied]);

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(source);
      flashCopied("md");
    } catch {
      // Clipboard API unavailable
    }
  }, [source, flashCopied]);

  return (
    <div className="app-root">
      <Header
        title="Markdown Editor"
        subtitle="write markdown, see live html"
        brandMark={
          <BrandMark label="Markdown Editor">
            <MarkdownBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <div className="card">
          {/* Toolbar */}
          <div className="md-toolbar" role="toolbar" aria-label="Markdown formatting">
            <ToolBtn
              label="B"
              title="Bold (wraps selection)"
              action="bold"
              onAction={handleToolbarAction}
            />
            <ToolBtn label="H1" title="Heading 1" action="h1" onAction={handleToolbarAction} />
            <ToolBtn label="H2" title="Heading 2" action="h2" onAction={handleToolbarAction} />
            <ToolBtn label="H3" title="Heading 3" action="h3" onAction={handleToolbarAction} />
            <div className="md-toolbar-sep" aria-hidden="true" />
            <ToolBtn
              label="Link"
              title="Insert link"
              action="link"
              onAction={handleToolbarAction}
            />
            <ToolBtn
              label="`code`"
              title="Inline code"
              action="code"
              onAction={handleToolbarAction}
            />
            <ToolBtn
              label="```"
              title="Code block"
              action="codeblock"
              onAction={handleToolbarAction}
            />

            <div className="md-toolbar-sep" aria-hidden="true" />

            {/* Import file button */}
            <button
              type="button"
              className="md-tool-btn"
              title="Open .md file"
              aria-label="Import markdown file"
              onClick={() => fileInputRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              style={{ display: "none" }}
              onChange={handleFileInputChange}
              tabIndex={-1}
            />

            {/* TOC toggle */}
            {toc.length > 0 && (
              <button
                type="button"
                className={`md-tool-btn${showToc ? " md-tool-btn--active" : ""}`}
                title="Table of contents"
                aria-label="Toggle table of contents"
                aria-pressed={showToc}
                onClick={() => setShowToc((v) => !v)}
              >
                TOC
              </button>
            )}

            {/* Mobile Edit/Preview tab toggle - hidden on desktop */}
            <div className="md-toolbar-sep md-mobile-only" aria-hidden="true" />
            <div className="md-tab-toggle md-mobile-only" aria-label="Switch pane">
              <button
                type="button"
                className={`md-tab-btn${mobileTab === "edit" ? " md-tab-btn--active" : ""}`}
                onClick={() => {
                  setMobileTab("edit");
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                aria-pressed={mobileTab === "edit"}
              >
                Edit
              </button>
              <button
                type="button"
                className={`md-tab-btn${mobileTab === "preview" ? " md-tab-btn--active" : ""}`}
                onClick={() => setMobileTab("preview")}
                aria-pressed={mobileTab === "preview"}
              >
                Preview
              </button>
            </div>
          </div>

          {/* TOC panel (collapsible, above the split) */}
          {showToc && toc.length > 0 && <TocPanel entries={toc} onNavigate={handleTocNavigate} />}

          {/* File-rejection notice */}
          {fileError && (
            <p
              role="alert"
              aria-live="assertive"
              style={{
                color: "var(--error, #c0392b)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                margin: "0.5rem 0",
              }}
            >
              {fileError}
            </p>
          )}

          {/* Split editor / preview */}
          <div
            className={`md-split${isDragOver ? " md-split--dragover" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag-over overlay */}
            {isDragOver && (
              <div className="md-drop-overlay" aria-hidden="true">
                Drop .md file to open
              </div>
            )}

            {/* Editor pane */}
            <div
              className={`md-pane md-editor-pane${mobileTab === "preview" ? " md-pane--hidden-mobile" : ""}`}
            >
              <div className="md-pane-label" aria-hidden="true">
                markdown
              </div>
              <textarea
                ref={textareaRef}
                className="md-textarea"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                onScroll={handleEditorScroll}
                onKeyDown={handleKeyDown}
                placeholder="Start writing markdown here..."
                aria-label="Markdown source editor"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>

            {/* Preview pane */}
            <div className={`md-pane${mobileTab === "edit" ? " md-pane--hidden-mobile" : ""}`}>
              <div className="md-pane-label" aria-hidden="true">
                preview
              </div>
              <div
                ref={previewRef}
                className="md-preview-inner"
                onScroll={handlePreviewScroll}
                aria-live="polite"
                aria-label="Rendered HTML preview"
              >
                {source.trim().length === 0 ? (
                  <div className="md-empty-state">
                    <svg width="36" height="36" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                      <MarkdownBrandGlyph />
                    </svg>
                    <span>Preview will appear here</span>
                    <span className="md-empty-hint">or drop a .md file anywhere</span>
                  </div>
                ) : (
                  <div
                    className="md-prose"
                    // sanitized by DOMPurify in renderMarkdown
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized output
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Meta bar: stats + actions */}
          <div className="md-meta-bar">
            <div className="md-stats" aria-label="Document statistics">
              <div className="md-stat">
                <span className="md-stat-val">{stats.words.toLocaleString()}</span>
                <span className="md-stat-lbl">words</span>
              </div>
              <div className="md-stat">
                <span className="md-stat-val">{stats.chars.toLocaleString()}</span>
                <span className="md-stat-lbl">chars</span>
              </div>
              <div className="md-stat">
                <span className="md-stat-val">{stats.lines.toLocaleString()}</span>
                <span className="md-stat-lbl">lines</span>
              </div>
            </div>

            <div className="copy-actions">
              <span
                className={`md-copied-badge${copiedTarget !== null ? " md-copied-badge--visible" : ""}`}
                aria-live="polite"
              >
                {copiedTarget === "md" ? "markdown copied!" : "html copied!"}
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={clearSource}
                aria-label="Clear editor content"
                title="Clear all content"
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void copyMarkdown()}
                aria-label="Copy raw markdown to clipboard"
              >
                Copy MD
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void copyHtml()}
                aria-label="Copy rendered HTML to clipboard"
                title="Copy HTML (Cmd/Ctrl+Enter)"
              >
                Copy HTML
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={exportPdf}
                aria-label="Print or save as PDF"
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={exportHtml}
                aria-label="Export as HTML file"
              >
                Export HTML
              </button>
            </div>
          </div>
        </div>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            color: "var(--ink-faint)",
            textAlign: "center",
          }}
        >
          Runs entirely in your browser, no data is uploaded or stored on any server.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
