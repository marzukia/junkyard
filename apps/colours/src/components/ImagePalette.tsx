/**
 * ImagePalette — drag-and-drop / file-pick image-to-palette extractor.
 *
 * Extracts dominant colors from an uploaded image using k-means clustering
 * on the canvas pixel data (see lib/imageExtract.ts). Fully client-side.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { extractPaletteFromFile, isImageFile } from "../lib/imageExtract";
import { MAX_PALETTE_COUNT, MIN_PALETTE_COUNT, useColoursStore } from "../store";

type ExtractState = "idle" | "loading" | "error";

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 14v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />
      <polyline points="6,7 10,3 14,7" />
      <line x1="10" y1="3" x2="10" y2="13" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="16" height="16" rx="2" />
      <circle cx="7" cy="7" r="1.5" />
      <path d="M2 14 7 9l3.5 3.5L13 10l5 4" />
    </svg>
  );
}

export function ImagePalette() {
  const count = useColoursStore((s) => s.palette.count);
  const loadImagePalette = useColoursStore((s) => s.loadImagePalette);

  const [state, setState] = useState<ExtractState>("idle");
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the object URL when it changes or when the component unmounts.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const processFile = useCallback(
    async (file: File) => {
      if (!isImageFile(file)) {
        setState("error");
        setTimeout(() => setState("idle"), 2500);
        return;
      }

      setState("loading");
      // Show a thumbnail preview; revoke the previous URL first to avoid leaking it
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });

      try {
        // Extract same number of colors as current palette count
        const k = Math.max(MIN_PALETTE_COUNT, Math.min(MAX_PALETTE_COUNT, count));
        const colors = await extractPaletteFromFile(file, k);
        loadImagePalette(colors);
        setState("idle");
      } catch {
        setState("error");
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
        setTimeout(() => setState("idle"), 2500);
      }
    },
    [count, loadImagePalette]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be re-uploaded
      e.target.value = "";
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // <button> handles Enter natively; Space needs manual trigger since drag events are wired
    if (e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  const label =
    state === "loading"
      ? "Extracting..."
      : state === "error"
        ? "Not an image file"
        : "Extract from image";

  return (
    <button
      type="button"
      className={`image-palette-drop${isDragOver ? " image-palette-drop--over" : ""}${state === "loading" ? " image-palette-drop--loading" : ""}${state === "error" ? " image-palette-drop--error" : ""}`}
      aria-label="Upload image to extract palette colors. Drag and drop or click to browse."
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="image-palette-file-input"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Uploaded preview"
          className="image-palette-preview"
          aria-hidden="true"
        />
      ) : (
        <span className="image-palette-icon" aria-hidden="true">
          {state === "loading" ? <ImageIcon /> : <UploadIcon />}
        </span>
      )}

      <span className="image-palette-label">{label}</span>
    </button>
  );
}
