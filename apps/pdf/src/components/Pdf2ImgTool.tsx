import { useRef, useState } from "react";
import { baseName, downloadBytes, formatBytes } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

/**
 * Render every page of a PDF to PNG and return them as a map of
 * filename → Uint8Array, ready for zipSync.
 *
 * Bug 2 fix: previously called a.click() per page; Chromium throttles rapid
 * downloads so only ~10-19 of 60 actually landed.  We now collect all blobs
 * in memory and let the caller bundle them into a single ZIP download.
 */
async function renderPdfPagesToBlobs(
  file: File,
  dpi: number,
  onProgress: (current: number, total: number) => void
): Promise<Record<string, Uint8Array>> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const scale = dpi / 72;
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const name = baseName(file.name);
  const results: Record<string, Uint8Array> = {};

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (blob) {
      const buf = await blob.arrayBuffer();
      results[`${name}-page${i}.png`] = new Uint8Array(buf);
    }
  }

  return results;
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
  // Bug 3: synchronous in-flight guard prevents duplicate work on rapid double-click.
  const inFlight = useRef(false);

  const onFile = (files: File[]) => {
    setFile(files[0] ?? null);
    setError(null);
    setDone(false);
    setProgress("");
  };

  const convert = async () => {
    // Synchronous guard: checked before any await so a 2nd click in the same tick
    // is rejected before React has flushed the setBusy(true) state update.
    if (inFlight.current || !file) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setDone(false);
    setProgress("Rendering pages…");
    try {
      const blobs = await renderPdfPagesToBlobs(file, dpi, (i, total) => {
        setProgress(`Rendering page ${i} / ${total}`);
      });
      // Bug 2: bundle all pages into a single ZIP download.
      setProgress("Building ZIP…");
      const { zipSync } = await import("fflate");
      const zip = zipSync(blobs);
      downloadBytes(zip, `${baseName(file.name)}-images.zip`);
      setDone(true);
      setProgress("");
    } catch (err) {
      setError(`Conversion failed: ${err instanceof Error ? err.message : String(err)}`);
      setProgress("");
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
        sublabel="Each page will be exported as a PNG image inside a ZIP"
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
        <output className="tool-success">
          Export complete — downloaded as a ZIP. Check your downloads folder.
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
