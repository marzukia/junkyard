/**
 * GridCanvas — renders the live preview grid as absolutely-positioned divs.
 * Each cell is clipped to its CellRect and shows the photo with CSS transforms
 * for pan/zoom. Supports drag-and-drop of photos between cells.
 *
 * Per-cell pan/zoom interaction:
 *   - When a cell is selected and has a photo, pointer-drag on the image pans it.
 *   - Scroll (wheel) over a selected cell with a photo zooms it in/out.
 *   - These update the same panX/panY/zoom state that the CellControls sliders use.
 */
import { useRef, useState } from "react";
import { getShape } from "../lib/collageShapes";
import type { LayoutTemplate } from "../lib/layouts";
import { useCollageStore } from "../store/collageStore";
import { ShapeClipWrapper } from "./ShapeClipWrapper";

import { clamp } from "@junkyardsh/ui";

interface Props {
  template: LayoutTemplate;
  canvasWidth: number;
  canvasHeight: number;
}

/** State for tracking a live pointer-drag pan gesture on a cell's photo. */
interface PanDragState {
  cellId: string;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  /** Cell pixel dimensions at drag-start — used to convert px deltas to fractional pan. */
  cellPxW: number;
  cellPxH: number;
}

export function GridCanvas({ template, canvasWidth, canvasHeight }: Props) {
  const { cells, selectedCellId, setSelectedCellId, assignPhotoToCell, swapCells, updateCell } =
    useCollageStore();
  const { gutter, radius, background, collageShape, borderWidth, borderColor } = useCollageStore();
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCellIdRef = useRef<string | null>(null);

  // Pan-drag state for repositioning a photo within its cell
  const panDragRef = useRef<PanDragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const handleCellClick = (cellId: string) => {
    setSelectedCellId(cellId === selectedCellId ? null : cellId);
  };

  const handleDragOver = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    setDragOverCell(cellId);
  };

  const handleDragLeave = () => setDragOverCell(null);

  const handleDrop = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    setDragOverCell(null);

    // Check if dragging from another cell (swap)
    if (draggingFrom && draggingFrom !== cellId) {
      swapCells(draggingFrom, cellId);
      setDraggingFrom(null);
      return;
    }

    // Check for files dropped from OS
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      assignPhotoToCell(cellId, url, files[0]);
    }
  };

  const handleCellDragStart = (e: React.DragEvent, cellId: string) => {
    setDraggingFrom(cellId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCellFileInput = (cellId: string) => {
    pendingCellIdRef.current = cellId;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cellId = pendingCellIdRef.current;
    if (!cellId || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    assignPhotoToCell(cellId, url, file);
  };

  /** Start a pan-drag gesture on a selected cell's photo. */
  const startPanDrag = (
    e: React.PointerEvent,
    cell: { id: string; panX: number; panY: number },
    cellPxW: number,
    cellPxH: number
  ) => {
    // Only pan when cell is already selected and has a photo
    if (cell.id !== selectedCellId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    panDragRef.current = {
      cellId: cell.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: cell.panX,
      startPanY: cell.panY,
      cellPxW,
      cellPxH,
    };
    setIsPanning(true);
  };

  const onPanPointerMove = (e: React.PointerEvent) => {
    const pd = panDragRef.current;
    if (!pd) return;
    // Convert pixel delta to fractional pan units (pan range is [-0.5, 0.5])
    // Moving the pointer by the full cell width shifts pan by 1.0 (clamped to ±0.5)
    const dx = (e.clientX - pd.startClientX) / pd.cellPxW;
    const dy = (e.clientY - pd.startClientY) / pd.cellPxH;
    updateCell(pd.cellId, {
      panX: clamp(pd.startPanX - dx, -0.5, 0.5),
      panY: clamp(pd.startPanY - dy, -0.5, 0.5),
    });
  };

  const onPanPointerUp = () => {
    panDragRef.current = null;
    setIsPanning(false);
  };

  /** Scroll-to-zoom on a selected cell's photo. */
  const onCellWheel = (e: React.WheelEvent, cellId: string) => {
    if (cellId !== selectedCellId) return;
    e.preventDefault();
    const cell = cells.find((c) => c.id === cellId);
    if (!cell?.photoUrl) return;
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    updateCell(cellId, { zoom: clamp(cell.zoom + delta, 1, 3) });
  };

  const bg = background === "transparent" ? "transparent" : background;
  const shape = getShape(collageShape);

  return (
    <ShapeClipWrapper
      shapeId={collageShape}
      width={canvasWidth}
      height={canvasHeight}
      cssClipPath={shape.cssClipPath(canvasWidth, canvasHeight)}
    >
      <div
        className="grid-canvas-outer"
        style={{ width: canvasWidth, height: canvasHeight, background: bg }}
        data-testid="grid-canvas"
      >
        {template.cells.map((rect, i) => {
          const cell = cells[i];
          if (!cell) return null;

          const isSelected = selectedCellId === cell.id;
          const isDragOver = dragOverCell === cell.id;
          const halfG = gutter / 2;

          const px = rect.x * canvasWidth + halfG;
          const py = rect.y * canvasHeight + halfG;
          const pw = rect.w * canvasWidth - gutter;
          const ph = rect.h * canvasHeight - gutter;

          // Determine cursor: panning takes priority, then selected-with-photo = crosshair for pan
          const panActive = isPanning && panDragRef.current?.cellId === cell.id;
          const cellCursor = panActive
            ? "grabbing"
            : isSelected && cell.photoUrl
              ? "crosshair"
              : cell.photoUrl
                ? "grab"
                : "pointer";

          return (
            <button
              key={cell.id}
              type="button"
              className={`grid-cell${isSelected ? " grid-cell--selected" : ""}${isDragOver ? " grid-cell--dragover" : ""}`}
              style={{
                position: "absolute",
                left: px,
                top: py,
                width: pw,
                height: ph,
                borderRadius: radius,
                overflow: "hidden",
                cursor: cellCursor,
                outline: isSelected ? "2px solid var(--accent)" : "none",
                outlineOffset: "1px",
                boxSizing: "border-box",
                border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : "none",
                padding: 0,
                background: "none",
                touchAction: isSelected && cell.photoUrl ? "none" : undefined,
              }}
              onClick={() => {
                if (!cell.photoUrl) handleCellFileInput(cell.id);
                else handleCellClick(cell.id);
              }}
              onDragOver={(e) => handleDragOver(e, cell.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cell.id)}
              draggable={!!cell.photoUrl && !isSelected}
              onDragStart={(e) => handleCellDragStart(e, cell.id)}
              onPointerDown={
                isSelected && cell.photoUrl
                  ? (e) =>
                      startPanDrag(e, { id: cell.id, panX: cell.panX, panY: cell.panY }, pw, ph)
                  : undefined
              }
              onPointerMove={isSelected && cell.photoUrl ? onPanPointerMove : undefined}
              onPointerUp={isSelected && cell.photoUrl ? onPanPointerUp : undefined}
              onWheel={isSelected && cell.photoUrl ? (e) => onCellWheel(e, cell.id) : undefined}
              aria-label={`Cell ${i + 1}${cell.photoUrl ? ", has photo" : ", empty, click to add photo"}${isSelected && cell.photoUrl ? ". Drag to reposition, scroll to zoom" : ""}`}
            >
              {cell.photoUrl ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={cell.photoUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `${50 + cell.panX * 100}% ${50 + cell.panY * 100}%`,
                      transform: `scale(${cell.zoom})`,
                      transformOrigin: `${50 + cell.panX * 100}% ${50 + cell.panY * 100}%`,
                      display: "block",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                    draggable={false}
                  />
                  {/* Reposition hint shown when selected */}
                  {isSelected && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(0,0,0,0.52)",
                        color: "#fff",
                        fontSize: "0.55rem",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.04em",
                        padding: "2px 6px",
                        borderRadius: 4,
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      drag to reposition · scroll to zoom
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid-cell-empty" style={{ width: "100%", height: "100%" }}>
                  <AddPhotoIcon />
                  <span>Add photo</span>
                </div>
              )}
              {isDragOver && <div className="cell-drop-overlay" aria-hidden="true" />}
            </button>
          );
        })}

        {/* Hidden file input for click-to-add */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
      </div>
    </ShapeClipWrapper>
  );
}

function AddPhotoIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
