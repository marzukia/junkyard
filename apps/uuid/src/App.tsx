import { BrandMark } from "@junkyardsh/ui";
import { Footer } from "@junkyardsh/ui";
import { Header } from "@junkyardsh/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CopyFormat,
  type InspectResult,
  type NamespaceKey,
  type OutputFormat,
  UUID_NAMESPACES,
  downloadText,
  formatBulk,
  inspectUuid,
} from "./lib/uuid";
import type { ExtendedKind } from "./store/uuidStore";
import { useUuidStore } from "./store/uuidStore";

// ── Brand glyph: document frame + UUID segment lines ─────────────────────────

function UuidBrandGlyph() {
  return (
    <>
      <rect x="4" y="3" width="24" height="26" rx="3" stroke="#2f9d8d" strokeWidth="2.2" />
      <line x1="8" y1="11" x2="24" y2="11" stroke="#e8b04b" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="#2f9d8d" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="21" x2="18" y2="21" stroke="#d9594c" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Single UUID row -- entire row is the tap target ───────────────────────────

function UuidRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [id]);

  return (
    <li className={`uuid-row${copied ? " uuid-row--copied" : ""}`}>
      {/* The whole row is a button for easy mobile tapping */}
      <button
        type="button"
        className="uuid-row-tap"
        onClick={() => void copy()}
        aria-label={`Copy ${id}`}
        title={copied ? "Copied!" : "Tap to copy"}
      >
        <code className="uuid-value">{id}</code>
        <span className="uuid-copy-indicator" aria-hidden="true">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
      </button>
    </li>
  );
}

// ── Kind description ──────────────────────────────────────────────────────────

const KIND_DESC: Record<ExtendedKind, string> = {
  v4: "UUID v4. 122 bits of cryptographic random. The standard choice.",
  v7: "UUID v7. 48-bit Unix millisecond timestamp + 74 bits random. Sortable by creation time (RFC 9562).",
  v1: "UUID v1. 60-bit Gregorian timestamp + clock sequence + random node. Time-based, RFC 4122.",
  v3: "UUID v3. MD5 hash of a namespace UUID + name. Same inputs always produce the same UUID.",
  v5: "UUID v5. SHA-1 hash of a namespace UUID + name. Deterministic, preferred over v3.",
  nanoid: "Nano ID. 21-character URL-safe string, 126 bits random. Compact alternative to UUID.",
  ulid: "ULID. 26-character Crockford base32. 48-bit ms timestamp prefix + 80 bits random. Lexicographically sortable.",
};

const KIND_LABELS: Record<ExtendedKind, string> = {
  v4: "UUID v4",
  v7: "UUID v7",
  v1: "UUID v1",
  v3: "UUID v3",
  v5: "UUID v5",
  nanoid: "Nano ID",
  ulid: "ULID",
};

const ALL_KINDS: ExtendedKind[] = ["v4", "v7", "v1", "v3", "v5", "nanoid", "ulid"];

const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  plain: "plain",
  braces: "{braces}",
  urn: "urn:uuid:",
  base64: "base64",
};

const COPY_FORMAT_LABELS: Record<CopyFormat, string> = {
  newline: "newline",
  comma: "comma",
  json: "JSON array",
  quoted: "quoted",
};

const NAMESPACE_LABELS: Record<NamespaceKey, string> = {
  DNS: "DNS",
  URL: "URL",
  OID: "OID",
  X500: "X.500",
};

// ── Inspector panel ───────────────────────────────────────────────────────────

function InspectorPanel() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<InspectResult | null>(null);

  const inspect = useCallback(() => {
    if (!input.trim()) return;
    setResult(inspectUuid(input));
  }, [input]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        inspect();
      }
    },
    [inspect]
  );

  return (
    <div className="card">
      <div className="uuid-section-label">Inspect a UUID</div>
      <div className="uuid-inspect-row">
        <input
          type="text"
          className="uuid-inspect-input"
          placeholder="Paste a UUID to inspect..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          spellCheck={false}
          aria-label="UUID to inspect"
        />
        <button
          type="button"
          className="btn-primary uuid-inspect-btn"
          onClick={inspect}
          disabled={!input.trim()}
        >
          <SearchIcon />
          Inspect
        </button>
      </div>
      {result && (
        <section className="uuid-inspect-result" aria-label="Inspection result">
          {!result.valid ? (
            <p className="uuid-inspect-invalid">
              Not a valid UUID. Check the format and try again.
            </p>
          ) : (
            <dl className="uuid-inspect-fields">
              {result.fields?.map((f) => (
                <div key={f.label} className="uuid-inspect-field">
                  <dt className="uuid-inspect-dt">{f.label}</dt>
                  <dd className="uuid-inspect-dd">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const kind = useUuidStore((s) => s.kind);
  const count = useUuidStore((s) => s.count);
  const uppercase = useUuidStore((s) => s.uppercase);
  const noDashes = useUuidStore((s) => s.noDashes);
  const outputFormat = useUuidStore((s) => s.outputFormat);
  const copyFormat = useUuidStore((s) => s.copyFormat);
  const namespaceName = useUuidStore((s) => s.namespaceName);
  const nameValue = useUuidStore((s) => s.nameValue);
  const ids = useUuidStore((s) => s.ids);
  const isGenerating = useUuidStore((s) => s.isGenerating);
  const setKind = useUuidStore((s) => s.setKind);
  const setCount = useUuidStore((s) => s.setCount);
  const setUppercase = useUuidStore((s) => s.setUppercase);
  const setNoDashes = useUuidStore((s) => s.setNoDashes);
  const setOutputFormat = useUuidStore((s) => s.setOutputFormat);
  const setCopyFormat = useUuidStore((s) => s.setCopyFormat);
  const setNamespaceName = useUuidStore((s) => s.setNamespaceName);
  const setNameValue = useUuidStore((s) => s.setNameValue);
  const generate = useUuidStore((s) => s.generate);

  const [copyAllDone, setCopyAllDone] = useState(false);
  const countInputRef = useRef<HTMLInputElement>(null);

  // Generate on first mount (ids are never persisted, always start fresh)
  const hasGeneratedRef = useRef(false);
  useEffect(() => {
    if (!hasGeneratedRef.current) {
      hasGeneratedRef.current = true;
      generate();
    }
  }, [generate]);

  // Cmd/Ctrl+Enter global hotkey for generate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire if focused inside the inspector input
      const target = e.target as HTMLElement;
      if (target.closest(".uuid-inspect-row")) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [generate]);

  const handleCount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(1, Math.min(1000, Number.parseInt(e.target.value, 10) || 1));
    setCount(v);
  };

  const handleCopyAll = useCallback(async () => {
    if (!ids.length) return;
    await navigator.clipboard.writeText(formatBulk(ids, copyFormat));
    setCopyAllDone(true);
    setTimeout(() => setCopyAllDone(false), 1500);
  }, [ids, copyFormat]);

  const handleDownload = useCallback(() => {
    if (!ids.length) return;
    downloadText(ids.join("\n"), `uuids-${kind}-${ids.length}.txt`);
  }, [ids, kind]);

  const isNameBased = kind === "v3" || kind === "v5";
  // nanoid and ulid don't support dashes or uppercase options meaningfully
  const isAlternateFormat = kind === "nanoid" || kind === "ulid";
  // base64/urn only apply to real UUIDs
  const canUseOutputFormat = !isAlternateFormat;

  return (
    <div className="app-root">
      <Header
        title="UUID Generator"
        subtitle="v4 v7 v1 v3 v5 nano ulid. private, runs in your browser"
        brandMark={
          <BrandMark label="UUID Generator">
            <UuidBrandGlyph />
          </BrandMark>
        }
        controls={
          <div className="uuid-header-controls">
            {!isAlternateFormat && (
              <>
                <div className="space-toggle-wrapper">
                  <span className="space-toggle-label">Case</span>
                  <div className="space-toggle" aria-label="UUID case">
                    <button
                      type="button"
                      className={`space-btn${!uppercase ? " space-btn--active" : ""}`}
                      onClick={() => setUppercase(false)}
                      aria-pressed={!uppercase}
                    >
                      lower
                    </button>
                    <button
                      type="button"
                      className={`space-btn${uppercase ? " space-btn--active" : ""}`}
                      onClick={() => setUppercase(true)}
                      aria-pressed={uppercase}
                    >
                      UPPER
                    </button>
                  </div>
                </div>
                <div className="space-toggle-wrapper">
                  <span className="space-toggle-label">Dashes</span>
                  <div className="space-toggle" aria-label="UUID dashes">
                    <button
                      type="button"
                      className={`space-btn${!noDashes ? " space-btn--active" : ""}`}
                      onClick={() => setNoDashes(false)}
                      aria-pressed={!noDashes}
                    >
                      with
                    </button>
                    <button
                      type="button"
                      className={`space-btn${noDashes ? " space-btn--active" : ""}`}
                      onClick={() => setNoDashes(true)}
                      aria-pressed={noDashes}
                    >
                      none
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        }
      />

      <main className="site-main">
        {/* Config card */}
        <div className="card">
          {/* Kind selector */}
          <div className="uuid-config-row">
            <span className="mono-label">Type</span>
            <div className="space-toggle uuid-kind-toggle" role="tablist" aria-label="UUID type">
              {ALL_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  className={`space-btn${kind === k ? " space-btn--active" : ""}`}
                  onClick={() => setKind(k)}
                  aria-selected={kind === k}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Name-based fields for v3/v5 */}
          {isNameBased && (
            <div className="uuid-config-row uuid-namebased-row">
              <span className="mono-label">Namespace</span>
              <div className="space-toggle" aria-label="Namespace">
                {(Object.keys(UUID_NAMESPACES) as NamespaceKey[]).map((ns) => (
                  <button
                    key={ns}
                    type="button"
                    className={`space-btn${namespaceName === ns ? " space-btn--active" : ""}`}
                    onClick={() => setNamespaceName(ns)}
                    aria-pressed={namespaceName === ns}
                  >
                    {NAMESPACE_LABELS[ns]}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="uuid-name-input"
                placeholder="name (e.g. example.com)"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    generate();
                  }
                }}
                aria-label="Name for UUID generation"
                spellCheck={false}
              />
            </div>
          )}

          {/* Output format (plain / braces / urn / base64) */}
          {canUseOutputFormat && (
            <div className="uuid-config-row">
              <span className="mono-label">Format</span>
              <div className="space-toggle" aria-label="Output format">
                {(["plain", "braces", "urn", "base64"] as OutputFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`space-btn${outputFormat === f ? " space-btn--active" : ""}`}
                    onClick={() => setOutputFormat(f)}
                    aria-pressed={outputFormat === f}
                  >
                    {OUTPUT_FORMAT_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Count + regenerate */}
          <div className="uuid-config-row uuid-count-row">
            <label className="mono-label" htmlFor="uuid-count">
              Count
            </label>
            <div className="uuid-count-control">
              <input
                id="uuid-count"
                ref={countInputRef}
                type="number"
                className="uuid-count-input"
                value={count}
                min={1}
                max={1000}
                onChange={handleCount}
                aria-label="Number of UUIDs to generate (1-1000)"
              />
              <span className="uuid-count-hint">1 - 1000</span>
            </div>
            <button
              type="button"
              className="btn-primary uuid-generate-btn"
              onClick={generate}
              disabled={isGenerating}
              title="Generate (Cmd+Enter)"
            >
              {isGenerating ? "Generating..." : "Regenerate"}
            </button>
          </div>

          {/* Kind description */}
          <p className="uuid-kind-desc">{KIND_DESC[kind]}</p>
        </div>

        {/* Results card */}
        {(ids.length > 0 || isGenerating) && (
          <div className="card">
            <div className="uuid-results-header">
              <span className="mono-label">
                {isGenerating
                  ? "generating..."
                  : `${ids.length} ${ids.length === 1 ? "result" : "results"}`}
              </span>
              <div className="uuid-results-actions">
                {/* Copy format selector */}
                <div className="space-toggle-wrapper uuid-copy-format-wrapper">
                  <span className="space-toggle-label">as</span>
                  <div className="space-toggle" aria-label="Copy format">
                    {(["newline", "comma", "json", "quoted"] as CopyFormat[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`space-btn space-btn--sm${copyFormat === f ? " space-btn--active" : ""}`}
                        onClick={() => setCopyFormat(f)}
                        aria-pressed={copyFormat === f}
                      >
                        {COPY_FORMAT_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="uuid-action-row">
                  <button
                    type="button"
                    className="btn-secondary uuid-action-btn"
                    onClick={() => void handleCopyAll()}
                    aria-label="Copy all UUIDs"
                    disabled={!ids.length}
                  >
                    <CopyIcon />
                    {copyAllDone ? "Copied!" : "Copy all"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary uuid-action-btn"
                    onClick={handleDownload}
                    aria-label="Download as text file"
                    disabled={!ids.length}
                  >
                    <DownloadIcon />
                    Download .txt
                  </button>
                </div>
              </div>
            </div>

            {!isGenerating && (
              <ul className="uuid-list" aria-label="Generated UUIDs">
                {ids.map((id, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: UUIDs regenerate as a batch; index is stable within a batch
                  <UuidRow key={i} id={id} />
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Inspector card */}
        <InspectorPanel />

        <p className="uuid-privacy-note">
          Generated entirely in your browser using the Web Crypto API. No data is sent to any
          server.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No data leaves your device." />
    </div>
  );
}
