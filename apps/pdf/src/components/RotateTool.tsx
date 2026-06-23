import { PDFDocument } from "pdf-lib";
import { useEffect, useRef, useState } from "react";
import {
  type RotationAngle,
  baseName,
  downloadBytes,
  formatBytes,
  rotatePages,
} from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

const ANGLE_OPTIONS: { value: RotationAngle; label: string }[] = [
  { value: 90, label: "90 CW" },
  { value: 270, label: "90 CCW" },
  { value: 180, label: "180" },
];

export function RotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [angle, setAngle] = useState<RotationAngle>(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        primaryRef.current?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onFile = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setDone(false);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setTotalPages(doc.getPageCount());
    } catch {
      setTotalPages(0);
      setError("Could not read PDF.");
    }
  };

  const rotate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await rotatePages(bytes, angle);
      downloadBytes(result, `${baseName(file.name)}-rotated.pdf`);
      setDone(true);
    } catch (err) {
      setError(`Rotate failed: ${err instanceof Error ? err.message : String(err)}`);
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
        sublabel="Rotates all pages by the chosen angle"
      />

      {file && (
        <div className="file-single">
          <span className="file-single-name">{file.name}</span>
          <span className="mono-label">
            {formatBytes(file.size)}
            {totalPages > 0 ? ` - ${totalPages} pages` : ""}
          </span>
          <button
            type="button"
            className="btn-icon btn-icon--danger"
            onClick={() => {
              setFile(null);
              setTotalPages(0);
              setDone(false);
            }}
            aria-label="Remove file"
            title="Remove"
          >
            x
          </button>
        </div>
      )}

      <div className="form-field">
        <fieldset className="dpi-fieldset">
          <legend className="mono-label">Rotation</legend>
          <div className="dpi-options">
            {ANGLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`dpi-option${angle === opt.value ? " dpi-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="rotate-angle"
                  value={opt.value}
                  checked={angle === opt.value}
                  onChange={() => setAngle(opt.value)}
                  className="sr-only"
                />
                <span className="mono-label">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {done && (
        <output className="tool-success" aria-live="polite">
          Rotated! Check your downloads folder.
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
          onClick={() => void rotate()}
          disabled={busy || !file}
          title="Rotate PDF (Cmd+Enter)"
        >
          {busy ? (
            <>
              <Spinner /> Rotating...
            </>
          ) : (
            "Rotate PDF"
          )}
        </button>
      </div>
    </div>
  );
}
