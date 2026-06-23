import { useEffect, useRef, useState } from "react";
import { downloadBytes, formatBytes, mergePdfs } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

interface PdfEntry {
  file: File;
  id: string;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function MergeTool() {
  const [entries, setEntries] = useState<PdfEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Cmd/Ctrl+Enter triggers merge
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        primaryRef.current?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const addFiles = (files: File[]) => {
    const pdfs = files.filter(isPdf);
    const rejected = files.filter((f) => !isPdf(f));
    if (rejected.length > 0) {
      const names = rejected.map((f) => f.name).join(", ");
      setError(
        rejected.length === 1
          ? `"${names}" is not a PDF. Only PDF files can be merged.`
          : `These files are not PDFs and were skipped: ${names}`
      );
    } else {
      setError(null);
    }
    if (pdfs.length > 0) {
      setEntries((prev) => [
        ...prev,
        ...pdfs.map((f) => ({ file: f, id: `${f.name}-${Date.now()}-${Math.random()}` })),
      ]);
      setDone(false);
    }
  };

  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setEntries((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    setEntries((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
      return next;
    });
  };

  const merge = async () => {
    if (entries.length < 2) {
      setError("Add at least 2 PDF files to merge.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    setProgress({ done: 0, total: entries.length });
    try {
      const buffers = await Promise.all(
        entries.map(async (e) => new Uint8Array(await e.file.arrayBuffer()))
      );
      const names = entries.map((e) => e.file.name);
      const result = await mergePdfs(
        buffers,
        (done, total) => {
          setProgress({ done, total });
        },
        names
      );
      downloadBytes(result, "merged.pdf");
      setDone(true);
    } catch (err) {
      setError(`Merge failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const reset = () => {
    setEntries([]);
    setDone(false);
    setError(null);
    setProgress(null);
  };

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="tool-panel">
      <DropZone
        accept=".pdf,application/pdf"
        multiple
        onFiles={addFiles}
        label="Drop PDFs here or click to select"
        sublabel="Select multiple PDF files"
      />

      {entries.length > 0 && (
        <ul className="file-list" aria-label="PDF files to merge">
          {entries.map((e, idx) => (
            <li key={e.id} className="file-list-item">
              <span className="file-list-index mono-label">{idx + 1}</span>
              <span className="file-list-name">{e.file.name}</span>
              <span className="file-list-size mono-label">{formatBytes(e.file.size)}</span>
              <div className="file-list-actions">
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  aria-label="Move up"
                  title="Move up"
                >
                  <ChevronUp />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => moveDown(idx)}
                  disabled={idx === entries.length - 1}
                  aria-label="Move down"
                  title="Move down"
                >
                  <ChevronDown />
                </button>
                <button
                  type="button"
                  className="btn-icon btn-icon--danger"
                  onClick={() => remove(e.id)}
                  aria-label={`Remove ${e.file.name}`}
                  title="Remove"
                >
                  <XIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {busy && progress && (
        <div
          className="progress-bar-wrap"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Merge progress"
          tabIndex={-1}
        >
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="progress-bar-label mono-label">
            {progress.done} / {progress.total} files
          </span>
        </div>
      )}

      {done && (
        <output className="tool-success tool-success--with-action" aria-live="polite">
          <span>merged.pdf ready. Check your downloads folder.</span>
          <button type="button" className="btn-secondary btn-secondary--sm" onClick={reset}>
            Start another
          </button>
        </output>
      )}

      {error && (
        <p className="tool-error" role="alert">
          {error}
        </p>
      )}

      <div className="tool-actions">
        <button
          ref={primaryRef}
          type="button"
          className="btn-primary"
          onClick={() => void merge()}
          disabled={busy || entries.length < 2}
          title="Merge PDFs (Cmd+Enter)"
        >
          {busy ? (
            <>
              <Spinner /> Merging…
            </>
          ) : entries.length >= 2 ? (
            `Merge ${entries.length} PDFs`
          ) : (
            "Merge PDFs"
          )}
        </button>
        {entries.length > 0 && !done && (
          <button type="button" className="btn-secondary" onClick={reset}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function ChevronUp() {
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
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDown() {
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function XIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
