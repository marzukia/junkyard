import { PDFDocument } from "pdf-lib";
import { useState } from "react";
import {
  baseName,
  downloadBytes,
  extractPages,
  formatBytes,
  parsePageRange,
} from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

export function ExtractTool() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [rangeStr, setRangeStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onFile = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setRangeStr("");
    setDone(false);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setTotalPages(doc.getPageCount());
    } catch {
      setTotalPages(0);
      setError("Could not read PDF page count.");
    }
  };

  const extract = async () => {
    if (!file) return;
    const indices = parsePageRange(rangeStr, totalPages);
    if (indices.length === 0) {
      setError(
        `No valid pages in range "${rangeStr}". Enter e.g. "1,3-5" (max page: ${totalPages}).`
      );
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await extractPages(bytes, indices);
      downloadBytes(result, `${baseName(file.name)}-extract.pdf`);
      setDone(true);
    } catch (err) {
      setError(`Extract failed: ${err instanceof Error ? err.message : String(err)}`);
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
        sublabel="Then specify which pages to extract"
      />

      {file && (
        <div className="file-single">
          <span className="file-single-name">{file.name}</span>
          <span className="mono-label">
            {formatBytes(file.size)}
            {totalPages > 0 ? ` · ${totalPages} pages` : ""}
          </span>
          <button
            type="button"
            className="btn-icon btn-icon--danger"
            onClick={() => {
              setFile(null);
              setTotalPages(0);
              setRangeStr("");
            }}
            aria-label="Remove file"
            title="Remove"
          >
            ×
          </button>
        </div>
      )}

      {file && totalPages > 0 && (
        <div className="form-field">
          <label htmlFor="page-range" className="mono-label">
            Pages (e.g. 1,3-5,7)
          </label>
          <input
            id="page-range"
            type="text"
            className="text-input"
            placeholder={`1-${totalPages}`}
            value={rangeStr}
            onChange={(e) => setRangeStr(e.target.value)}
            aria-describedby="page-range-hint"
          />
          <span id="page-range-hint" className="field-hint">
            Comma-separated pages or ranges, e.g. <code>1,3-5,8</code>. Pages 1-{totalPages}.
          </span>
        </div>
      )}

      {done && (
        <output className="tool-success" aria-live="polite">
          Extracted! Check your downloads folder.
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
          onClick={() => void extract()}
          disabled={busy || !file || !rangeStr.trim()}
        >
          {busy ? (
            <>
              <Spinner /> Extracting…
            </>
          ) : (
            "Extract pages"
          )}
        </button>
      </div>
    </div>
  );
}
