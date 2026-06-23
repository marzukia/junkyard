import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { CellControls } from "./components/CellControls";
import { ControlPanel } from "./components/ControlPanel";
import { ExportBar } from "./components/ExportBar";
import { Footer } from "./components/Footer";
import { FreeformCanvas } from "./components/FreeformCanvas";
import { GridCanvas } from "./components/GridCanvas";
import { Header } from "./components/Header";
import { ASPECT_PRESETS, canvasPreviewSize } from "./lib/aspectRatios";
import { LAYOUT_TEMPLATES } from "./lib/layouts";
import { useCollageStore } from "./store/collageStore";

// Preview canvas: the canvas children use these fixed pixel dimensions internally.
// On narrow screens we scale the wrapper down via CSS transform rather than
// changing the child pixel math (which would require threading a scale factor
// through GridCanvas, FreeformCanvas, and all cell position calculations).
const PREVIEW_MAX_W = 720;
const PREVIEW_MAX_H = 580;

export function App() {
  const { mode, setMode, aspectId, templateId, addPhotos, cells, undo, canUndo } =
    useCollageStore();

  const currentAspect = ASPECT_PRESETS.find((p) => p.id === aspectId) ?? ASPECT_PRESETS[0];
  const currentTemplate = LAYOUT_TEMPLATES.find((t) => t.id === templateId) ?? LAYOUT_TEMPLATES[0];

  // Fixed logical pixel size — canvas children use these coordinates.
  const previewSize = canvasPreviewSize(currentAspect.ratio, PREVIEW_MAX_W, PREVIEW_MAX_H);

  // Measure the canvas-area container to compute a CSS scale factor so the
  // canvas visually fits on narrow screens without altering child pixel math.
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(PREVIEW_MAX_W);
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    // Initialise immediately
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Scale so the canvas width never exceeds the container. Height follows proportionally.
  const scale = Math.min(1, containerWidth / previewSize.width);
  const scaledW = Math.round(previewSize.width * scale);
  const scaledH = Math.round(previewSize.height * scale);

  const [draggingOver, setDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fillEmptyCells = useCallback(
    (files: File[]) => {
      if (mode !== "grid") return;
      const store = useCollageStore.getState();
      const emptyCells = store.cells.filter((c) => !c.photoUrl);
      let fileIdx = 0;
      for (const cell of emptyCells) {
        if (fileIdx >= files.length) break;
        const url = URL.createObjectURL(files[fileIdx]);
        store.assignPhotoToCell(cell.id, url, files[fileIdx]);
        fileIdx++;
      }
    },
    [mode]
  );

  const handleGlobalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) {
        addPhotos(files);
        fillEmptyCells(files);
      }
    },
    [addPhotos, fillEmptyCells]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDraggingOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    addPhotos(files);
    fillEmptyCells(files);
    e.target.value = "";
  };

  const filledCount = cells.filter((c) => c.photoUrl).length;
  const totalCells = currentTemplate.cells.length;

  // Cmd/Ctrl+Enter triggers the primary action (export download).
  // ExportBar provides a stable ref to its triggerExport callback.
  const exportTriggerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        exportTriggerRef.current?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="app-root">
      <Header
        title="Collage"
        subtitle="free photo collage maker · grid + freeform · no watermark · no upload"
        brandMark={<BrandMark />}
        controls={
          <div className="space-toggle" aria-label="Mode">
            <button
              type="button"
              className={`space-btn${mode === "grid" ? " space-btn--active" : ""}`}
              onClick={() => setMode("grid")}
              aria-pressed={mode === "grid"}
            >
              Grid
            </button>
            <button
              type="button"
              className={`space-btn${mode === "freeform" ? " space-btn--active" : ""}`}
              onClick={() => setMode("freeform")}
              aria-pressed={mode === "freeform"}
            >
              Freeform
            </button>
          </div>
        }
      />

      <main className="site-main collage-main">
        {/* Drop zone strip */}
        <div
          className={`drop-zone-strip${draggingOver ? " drop-zone-strip--active" : ""}`}
          onDrop={handleGlobalDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          aria-label="Drop photos here or click to select"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>
            Drop photos here
            {mode === "grid" && filledCount < totalCells && (
              <> ({totalCells - filledCount} empty cells)</>
            )}
          </span>
          <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
        </div>

        {/* Two-column layout: canvas + sidebar */}
        <div className="collage-workspace">
          {/* Canvas area */}
          <div className="canvas-area" ref={canvasAreaRef}>
            {/*
              The inner canvas renders at full logical pixels (previewSize).
              On narrow screens we CSS-scale the wrapper down to scaledW×scaledH
              so the container reports the scaled height and no overflow occurs.
              Export always uses exportWidth/exportHeight from the aspect preset,
              independent of this visual scale.
            */}
            <div className="canvas-wrapper" style={{ width: scaledW, height: scaledH }}>
              <div
                style={{
                  width: previewSize.width,
                  height: previewSize.height,
                  transform: scale < 1 ? `scale(${scale})` : undefined,
                  transformOrigin: "top left",
                }}
              >
                {mode === "grid" ? (
                  <GridCanvas
                    template={currentTemplate}
                    canvasWidth={previewSize.width}
                    canvasHeight={previewSize.height}
                  />
                ) : (
                  <FreeformCanvas
                    canvasWidth={previewSize.width}
                    canvasHeight={previewSize.height}
                  />
                )}
              </div>
            </div>
            {mode === "grid" && (
              <div
                style={{
                  marginTop: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  width: "100%",
                  maxWidth: "100%",
                }}
              >
                <p className="canvas-hint mono-label">
                  Tap a cell to select · tap to swap or add photo
                </p>
                {canUndo && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={undo}
                    aria-label="Undo last swap or removal"
                    style={{ fontSize: "0.72rem", padding: "0.3rem 0.75rem", whiteSpace: "nowrap" }}
                  >
                    Undo
                  </button>
                )}
              </div>
            )}
            {mode === "freeform" && (
              <p className="canvas-hint mono-label" style={{ marginTop: "0.5rem" }}>
                Drop photos in · drag to move · handle to rotate · tap to select
              </p>
            )}
            {/* Per-cell controls on mobile appear below the canvas */}
            <div className="cell-controls-mobile">
              <CellControls />
            </div>
          </div>

          {/* Side panel */}
          <aside className="sidebar">
            <CellControls />
            <ControlPanel />
          </aside>
        </div>

        {/* Sticky export bar — visible when panel is below canvas (mobile) or as a persistent CTA */}
        <ExportBar
          onRegisterTrigger={(fn) => {
            exportTriggerRef.current = fn;
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
