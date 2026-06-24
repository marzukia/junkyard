import { useRef, useState } from "react";
import { baseName, downloadBytes, formatBytes, splitPdfToZip } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Bug 3: synchronous in-flight guard — prevents duplicate work on rapid double-click.
  const inFlight = useRef(false);

  const onFile = (files: File[]) => {
    setFile(files[0] ?? null);
    setError(null);
    setDone(false);
  };

  const split = async () => {
    // Synchronous guard checked before any await so a 2nd click in the same tick
    // is rejected before React has flushed the setBusy(true) state update.
    if (inFlight.current || !file) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = baseName(file.name);
      // Bug 2: bundle all pages into a single ZIP to avoid Chromium download throttling.
      const zip = await splitPdfToZip(bytes, name);
      downloadBytes(zip, `${name}-split-pages.zip`);
      setDone(true);
    } catch (err) {
      setError(`Split failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  return (
    <div className="tool-panel">
      <DropZone
        accept=".pdf,application/pdf"
        onFiles={onFile}
        label="Drop a PDF here or click to select"
        sublabel="Each page will be saved as a separate PDF inside a ZIP"
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
        <output className="tool-success">
          Split complete — downloaded as a ZIP. Check your downloads folder.
        </output>
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
