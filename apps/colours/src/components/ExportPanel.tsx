import { useCallback, useState } from "react";
import { EXPORT_FORMATS, type ExportFormat, formatPalette } from "../lib/export";

// ── Small copy feedback hook ──────────────────────────────────────────────────

type CopyState = "idle" | "copied" | "error";

function useCopyFeedback() {
  const [state, setCopyState] = useState<CopyState>("idle");

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1400);
    }
  }, []);

  return { copyState: state, copy };
}

// ── Export panel (inline, toggled from PaletteGenerator) ─────────────────────

interface ExportPanelProps {
  colors: string[];
}

export function ExportPanel({ colors }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("css");
  const { copyState, copy } = useCopyFeedback();

  const output = formatPalette(colors, format);

  const copyLabel = copyState === "copied" ? "copied!" : copyState === "error" ? "error" : "Copy";

  return (
    <div className="export-panel">
      {/* Format selector */}
      <div className="export-format-bar">
        <span className="palette-control-label">Format</span>
        <div className="space-toggle" aria-label="Export format">
          {EXPORT_FORMATS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`space-btn${format === value ? " space-btn--active" : ""}`}
              onClick={() => setFormat(value)}
              aria-pressed={format === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Code block */}
      <pre className="export-code" aria-label={`${format.toUpperCase()} export output`}>
        <code>{output}</code>
      </pre>

      {/* Copy button */}
      <div className="export-actions">
        <button
          type="button"
          className="copy-btn export-copy-btn"
          onClick={() => copy(output)}
          aria-label={`Copy ${format.toUpperCase()} to clipboard`}
        >
          {copyLabel}
        </button>
      </div>
    </div>
  );
}
