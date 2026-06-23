import { useState } from "react";
import { baseName, downloadBytes, formatBytes, splitPdf } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onFile = (files: File[]) => {
    setFile(files[0] ?? null);
    setError(null);
    setDone(false);
  };

  const split = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pages = await splitPdf(bytes);
      const name = baseName(file.name);
      for (let i = 0; i < pages.length; i++) {
        downloadBytes(pages[i]!, `${name}-page${i + 1}.pdf`);
      }
      setDone(true);
    } catch (err) {
      setError(`Split failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tool-panel">
      <DropZone
        accept=".pdf,application/pdf"
        onFiles={onFile}
        label="Drop a PDF here or click to select"
        sublabel="Each page will be saved as a separate PDF"
      />

      {file && (
        <div className="file-single">
          <span className="file-single-name">{file.name}</span>
          <span className="mono-label">{formatBytes(file.size)}</span>
          <button
            type="button"
            className="btn-icon btn-icon--danger"
            onClick={() => {
              setFile(null);
              setDone(false);
            }}
            aria-label="Remove file"
            title="Remove"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <p className="tool-error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <output className="tool-success">Pages downloaded! Check your downloads folder.</output>
      )}

      <div className="tool-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void split()}
          disabled={busy || !file}
        >
          {busy ? (
            <>
              <Spinner /> Splitting…
            </>
          ) : (
            "Split into pages"
          )}
        </button>
      </div>
    </div>
  );
}
