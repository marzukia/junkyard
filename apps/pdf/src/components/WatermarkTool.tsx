import { useEffect, useRef, useState } from "react";
import { addWatermark, baseName, downloadBytes, formatBytes } from "../lib/pdfUtils";
import { DropZone } from "./DropZone";
import { Spinner } from "./Spinner";

const OPACITY_OPTIONS = [
  { value: 0.08, label: "Light" },
  { value: 0.15, label: "Medium" },
  { value: 0.3, label: "Dark" },
] as const;

type OpacityValue = (typeof OPACITY_OPTIONS)[number]["value"];

export function WatermarkTool() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState<OpacityValue>(0.15);
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

  const onFile = (files: File[]) => {
    setFile(files[0] ?? null);
    setError(null);
    setDone(false);
  };

  const apply = async () => {
    if (!file) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Enter watermark text.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await addWatermark(bytes, trimmed, { opacity });
      downloadBytes(result, `${baseName(file.name)}-watermarked.pdf`);
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
        onFiles={onFile}
        label="Drop a PDF here or click to select"
        sublabel="Adds a diagonal text watermark to every page"
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
            x
          </button>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="watermark-text" className="mono-label">
          Watermark text
        </label>
        <input
          id="watermark-text"
          type="text"
          className="text-input"
          placeholder="CONFIDENTIAL"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={60}
        />
      </div>

      <div className="form-field">
        <fieldset className="dpi-fieldset">
          <legend className="mono-label">Opacity</legend>
          <div className="dpi-options">
            {OPACITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`dpi-option${opacity === opt.value ? " dpi-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="wm-opacity"
                  value={opt.value}
                  checked={opacity === opt.value}
                  onChange={() => setOpacity(opt.value as OpacityValue)}
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
          Watermark added! Check your downloads folder.
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
          title="Add watermark (Cmd+Enter)"
        >
          {busy ? (
            <>
              <Spinner /> Adding watermark...
            </>
          ) : (
            "Add watermark"
          )}
        </button>
      </div>
    </div>
  );
}
