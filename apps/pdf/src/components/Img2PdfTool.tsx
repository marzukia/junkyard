import { useState } from "react";
import { downloadBytes, formatBytes, imagesToPdf } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

interface ImgEntry {
  file: File;
  id: string;
}

export function Img2PdfTool() {
  const [entries, setEntries] = useState<ImgEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const addFiles = (files: File[]) => {
    setEntries((prev) => [
      ...prev,
      ...files.map((f) => ({ file: f, id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) })),
    ]);
    setError(null);
    setDone(false);
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

  const convert = async () => {
    if (entries.length === 0) {
      setError("Add at least one image.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const result = await imagesToPdf(entries.map((e) => e.file));
      downloadBytes(result, "images.pdf");
      setDone(true);
    } catch (err) {
      setError(`Conversion failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tool-panel">
      <DropZone
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        multiple
        onFiles={addFiles}
        label="Drop PNG/JPEG images or click to select"
        sublabel="Each image becomes one page (in order)"
      />

      {entries.length > 0 && (
        <ul className="file-list" aria-label="Images to convert">
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
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done && (
        <output className="tool-success" aria-live="polite">
          Converted! Check your downloads folder.
        </output>
      )}

      {error && (
        <p className="tool-error" role="alert">
          {error}
        </p>
      )}

      <div className="tool-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void convert()}
          disabled={busy || entries.length === 0}
        >
          {busy ? (
            <>
              <Spinner /> Converting…
            </>
          ) : entries.length > 0 ? (
            `Convert ${entries.length} image${entries.length !== 1 ? "s" : ""} to PDF`
          ) : (
            "Convert images to PDF"
          )}
        </button>
        {entries.length > 0 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEntries([]);
              setDone(false);
            }}
          >
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
