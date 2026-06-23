import { useRef, useState } from "react";
import { type ImageWarning, analyseImage } from "../lib/faviconCore";
import { useFaviconStore } from "../lib/faviconStore";
import { ImageWarnings } from "./ImageWarnings";

function UploadIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="upload-zone__icon"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "var(--accent)" }}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function UploadZone() {
  const { sourceFile, setSource, reset } = useFaviconStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [warnings, setWarnings] = useState<ImageWarning[]>([]);

  function handleFile(file: File) {
    if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
      alert("Please upload a PNG or SVG file.");
      return;
    }
    const url = URL.createObjectURL(file);
    setSource(file, url);
    setWarnings([]);

    // Analyse image quality once it loads
    const img = new Image();
    img.onload = () => {
      setWarnings(analyseImage(img));
    };
    img.src = url;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleReset() {
    setWarnings([]);
    reset();
  }

  const hasFile = sourceFile !== null;

  const zoneClass = [
    "upload-zone",
    dragOver ? "upload-zone--drag-over" : "",
    hasFile ? "upload-zone--has-file" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <span className="section-label">Source image</span>

      <div
        className={zoneClass}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <button
          type="button"
          className={zoneClass}
          onClick={() => inputRef.current?.click()}
          aria-label="Upload PNG or SVG image"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            width: "100%",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {hasFile ? <ImageIcon /> : <UploadIcon />}

          {hasFile ? (
            <>
              <span className="upload-zone__label" style={{ color: "var(--accent)" }}>
                {sourceFile.name}
              </span>
              <span className="upload-zone__hint">click to replace</span>
            </>
          ) : (
            <>
              <span className="upload-zone__label">Drop PNG or SVG here</span>
              <span className="upload-zone__hint">or click to browse</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml"
        onChange={handleChange}
        tabIndex={-1}
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          overflow: "hidden",
        }}
      />

      <ImageWarnings warnings={warnings} />

      {hasFile && (
        <div style={{ marginTop: "0.75rem" }}>
          <button type="button" className="btn-secondary" onClick={handleReset}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
