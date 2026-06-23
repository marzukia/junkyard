import { useState } from "react";
import { baseName, formatBytes } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

async function renderPdfPages(file: File, dpi: number): Promise<void> {
  // Dynamically import pdfjs-dist to avoid SSR issues.
  const pdfjsLib = await import("pdfjs-dist");
  // Use local worker copy shipped by pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const scale = dpi / 72;
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const name = baseName(file.name);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}-page${i}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
        resolve();
      }, "image/png");
    });
  }
}

const DPI_OPTIONS = [72, 150, 300] as const;
type Dpi = (typeof DPI_OPTIONS)[number];

export function Pdf2ImgTool() {
  const [file, setFile] = useState<File | null>(null);
  const [dpi, setDpi] = useState<Dpi>(150);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onFile = (files: File[]) => {
    setFile(files[0] ?? null);
    setError(null);
    setDone(false);
    setProgress("");
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(false);
    setProgress("Rendering pages…");
    try {
      await renderPdfPages(file, dpi);
      setDone(true);
      setProgress("");
    } catch (err) {
      setError(`Conversion failed: ${err instanceof Error ? err.message : String(err)}`);
      setProgress("");
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
        sublabel="Each page will be exported as a PNG image"
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

      <div className="form-field">
        <fieldset className="dpi-fieldset">
          <legend className="mono-label">Resolution</legend>
          <div className="dpi-options">
            {DPI_OPTIONS.map((d) => (
              <label key={d} className={`dpi-option${dpi === d ? " dpi-option--active" : ""}`}>
                <input
                  type="radio"
                  name="dpi"
                  value={d}
                  checked={dpi === d}
                  onChange={() => setDpi(d)}
                  className="sr-only"
                />
                <span className="mono-label">{d} DPI</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {progress && (
        <output className="tool-info" aria-live="polite">
          {progress}
        </output>
      )}
      {done && (
        <output className="tool-success">Pages downloaded! Check your downloads folder.</output>
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
          disabled={busy || !file}
        >
          {busy ? (
            <>
              <Spinner /> Rendering…
            </>
          ) : (
            "Export as PNG"
          )}
        </button>
      </div>
    </div>
  );
}
