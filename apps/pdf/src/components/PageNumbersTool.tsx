import { PDFDocument } from "pdf-lib";
import { useEffect, useRef, useState } from "react";
import {
  type PageNumberPosition,
  addPageNumbers,
  baseName,
  downloadBytes,
  formatBytes,
} from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

const POSITIONS: { value: PageNumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Center" },
  { value: "bottom-left", label: "Left" },
  { value: "bottom-right", label: "Right" },
];

const FORMATS: { value: "n" | "n/N"; label: string }[] = [
  { value: "n", label: "1, 2, 3" },
  { value: "n/N", label: "1/5, 2/5" },
];

export function PageNumbersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [position, setPosition] = useState<PageNumberPosition>("bottom-center");
  const [format, setFormat] = useState<"n" | "n/N">("n");
  const [startAt, setStartAt] = useState("1");
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

  const apply = async () => {
    if (!file) return;
    const start = Number.parseInt(startAt, 10);
    if (Number.isNaN(start) || start < 1) {
      setError("Start number must be a positive integer.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await addPageNumbers(bytes, { position, startAt: start, format });
      downloadBytes(result, `${baseName(file.name)}-numbered.pdf`);
      setDone(true);
    } catch (err) {
      setError(`Failed: ${err instanceof Error ? err.message : String(err)}`);
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
        sublabel="Adds page numbers to the bottom of each page"
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
          <legend className="mono-label">Position</legend>
          <div className="dpi-options">
            {POSITIONS.map((opt) => (
              <label
                key={opt.value}
                className={`dpi-option${position === opt.value ? " dpi-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="page-num-position"
                  value={opt.value}
                  checked={position === opt.value}
                  onChange={() => setPosition(opt.value)}
                  className="sr-only"
                />
                <span className="mono-label">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="form-field">
        <fieldset className="dpi-fieldset">
          <legend className="mono-label">Format</legend>
          <div className="dpi-options">
            {FORMATS.map((opt) => (
              <label
                key={opt.value}
                className={`dpi-option${format === opt.value ? " dpi-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="page-num-format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={() => setFormat(opt.value)}
                  className="sr-only"
                />
                <span className="mono-label">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="form-field">
        <label htmlFor="start-at" className="mono-label">
          Start numbering at
        </label>
        <input
          id="start-at"
          type="number"
          className="text-input"
          min={1}
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          style={{ maxWidth: "100px" }}
        />
      </div>

      {done && (
        <output className="tool-success" aria-live="polite">
          Page numbers added! Check your downloads folder.
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
          onClick={() => void apply()}
          disabled={busy || !file}
          title="Add page numbers (Cmd+Enter)"
        >
          {busy ? (
            <>
              <Spinner /> Adding numbers...
            </>
          ) : (
            "Add page numbers"
          )}
        </button>
      </div>
    </div>
  );
}
