import { useEffect, useRef, useState } from "react";
import { baseName, compressPdf, downloadBytes, formatBytes } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

export function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    before: number;
    after: number;
    bytes: Uint8Array;
    filename: string;
  } | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Cmd/Ctrl+Enter triggers compress
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        primaryRef.current?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onFile = (files: File[]) => {
    setFile(files[0] ?? null);
    setError(null);
    setResult(null);
  };

  const compress = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const compressed = await compressPdf(bytes);
      // Store compressed bytes — download is gated behind the result panel
      setResult({
        before: bytes.byteLength,
        after: compressed.byteLength,
        bytes: compressed,
        filename: `${baseName(file.name)}-compressed.pdf`,
      });
    } catch (err) {
      setError(`Compress failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const saving = result ? Math.max(0, Math.round((1 - result.after / result.before) * 100)) : 0;

  return (
    <div className="tool-panel">
      <DropZone
        accept=".pdf,application/pdf"
        onFiles={onFile}
        label="Drop a PDF here or click to select"
        sublabel="Re-saves with object stream compression to reduce size"
      />

      {file && !result && (
        <div className="file-single">
          <span className="file-single-name">{file.name}</span>
          <span className="mono-label">{formatBytes(file.size)}</span>
          <button
            type="button"
            className="btn-icon btn-icon--danger"
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
            aria-label="Remove file"
            title="Remove"
          >
            x
          </button>
        </div>
      )}

      {result && (
        <div className="compress-result-panel">
          <output className="compress-result" aria-live="polite">
            <span>{formatBytes(result.before)}</span>
            <span className="compress-arrow" aria-hidden="true">
              to
            </span>
            <span className="compress-after">{formatBytes(result.after)}</span>
            <span className="mono-label compress-saving">
              {saving > 0 ? `-${saving}%` : "no change"}
            </span>
          </output>
          <div className="compress-result-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => downloadBytes(result.bytes, result.filename)}
            >
              Download {result.filename}
            </button>
            <button type="button" className="btn-secondary" onClick={reset}>
              Start another
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="tool-error" role="alert">
          {error}
        </p>
      )}

      {!result && (
        <div className="tool-actions">
          <button
            ref={primaryRef}
            type="button"
            className="btn-primary"
            onClick={() => void compress()}
            disabled={busy || !file}
            title="Compress PDF (Cmd+Enter)"
          >
            {busy ? (
              <>
                <Spinner /> Compressing...
              </>
            ) : (
              "Compress PDF"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
