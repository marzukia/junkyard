import { PDFDocument } from "pdf-lib";
import { useRef, useState } from "react";
import { baseName, downloadBytes, formatBytes, reorderPages } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

interface PageEntry {
  originalIndex: number;
  label: string;
}

export function ReorderTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);

  const onFile = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const count = doc.getPageCount();
      setPages(
        Array.from({ length: count }, (_, i) => ({
          originalIndex: i,
          label: `Page ${i + 1}`,
        }))
      );
    } catch {
      setError("Could not read PDF.");
    }
  };

  const dragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const dragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setPages((prev) => {
      const next = [...prev];
      const item = next.splice(dragIdx.current!, 1)[0]!;
      next.splice(idx, 0, item);
      dragIdx.current = idx;
      return next;
    });
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const newOrder = pages.map((p) => p.originalIndex);
      const result = await reorderPages(bytes, newOrder);
      downloadBytes(result, `${baseName(file.name)}-reordered.pdf`);
    } catch (err) {
      setError(`Reorder failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tool-panel">
      <DropZone
        accept=".pdf,application/pdf"
        onFiles={(fs) => void onFile(fs)}
        label="Drop a PDF here or click to select"
        sublabel="Drag rows to reorder pages"
      />

      {file && pages.length > 0 && (
        <>
          <div className="file-single">
            <span className="file-single-name">{file.name}</span>
            <span className="mono-label">
              {formatBytes(file.size)} · {pages.length} pages
            </span>
            <button
              type="button"
              className="btn-icon btn-icon--danger"
              onClick={() => {
                setFile(null);
                setPages([]);
              }}
              aria-label="Remove file"
              title="Remove"
            >
              ×
            </button>
          </div>

          <ul className="file-list reorder-list" aria-label="Pages - drag to reorder">
            {pages.map((p, idx) => (
              <li
                key={p.originalIndex}
                className="file-list-item"
                draggable
                onDragStart={() => dragStart(idx)}
                onDragOver={(e) => dragOver(e, idx)}
                aria-label={p.label}
              >
                <span className="drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <span className="file-list-index mono-label">{idx + 1}</span>
                <span className="file-list-name">{p.label}</span>
                <span className="mono-label file-list-orig">(orig. {p.originalIndex + 1})</span>
              </li>
            ))}
          </ul>
        </>
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
          onClick={() => void apply()}
          disabled={busy || pages.length === 0}
        >
          {busy ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            "Download reordered PDF"
          )}
        </button>
      </div>
    </div>
  );
}
