/**
 * FreeformCanvas — a pinboard where photos are draggable, resizable, rotatable cards.
 * Cards are positioned as absolutely-positioned divs.
 */
import { useRef, useState } from "react";
import type { FreeformCard } from "../lib/canvasExport";
import { getShape } from "../lib/collageShapes";
import { applyResize } from "../lib/resizeMath";
import type { CardRect, ResizeHandle } from "../lib/resizeMath";
import { useCollageStore } from "../store/collageStore";
import { ShapeClipWrapper } from "./ShapeClipWrapper";

interface Props {
  canvasWidth: number;
  canvasHeight: number;
}

interface DragState {
  cardId: string;
  type: "move" | "rotate" | "resize";
  startMouseX: number;
  startMouseY: number;
  startCardX: number;
  startCardY: number;
  startCardW: number;
  startCardH: number;
  startRotation: number;
  cardCentreX: number;
  cardCentreY: number;
  resizeHandle: ResizeHandle | null;
}

export function FreeformCanvas({ canvasWidth, canvasHeight }: Props) {
  const {
    freeformCards,
    updateFreeformCard,
    removeFreeformCard,
    background,
    addFreeformCard,
    collageShape,
  } = useCollageStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const bg = background === "transparent" ? "transparent" : background;
  const shape = getShape(collageShape);

  const startMove = (e: React.MouseEvent | React.TouchEvent, card: FreeformCard) => {
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setSelectedId(card.id);
    setDragState({
      cardId: card.id,
      type: "move",
      startMouseX: clientX,
      startMouseY: clientY,
      startCardX: card.x,
      startCardY: card.y,
      startCardW: card.w,
      startCardH: card.h,
      startRotation: card.rotation,
      cardCentreX: 0,
      cardCentreY: 0,
      resizeHandle: null,
    });
  };

  const startResize = (
    e: React.MouseEvent | React.TouchEvent,
    card: FreeformCard,
    handle: ResizeHandle
  ) => {
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragState({
      cardId: card.id,
      type: "resize",
      startMouseX: clientX,
      startMouseY: clientY,
      startCardX: card.x,
      startCardY: card.y,
      startCardW: card.w,
      startCardH: card.h,
      startRotation: card.rotation,
      cardCentreX: 0,
      cardCentreY: 0,
      resizeHandle: handle,
    });
  };

  const startRotate = (e: React.MouseEvent | React.TouchEvent, card: FreeformCard) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const centreX = (card.x + card.w / 2) * canvasWidth + rect.left;
    const centreY = (card.y + card.h / 2) * canvasHeight + rect.top;
    setDragState({
      cardId: card.id,
      type: "rotate",
      startMouseX: clientX,
      startMouseY: clientY,
      startCardX: card.x,
      startCardY: card.y,
      startCardW: card.w,
      startCardH: card.h,
      startRotation: card.rotation,
      cardCentreX: centreX,
      cardCentreY: centreY,
      resizeHandle: null,
    });
  };

  /** Shared move logic for both mouse and touch events. */
  const applyDragMove = (clientX: number, clientY: number) => {
    if (!dragState) return;
    const card = freeformCards.find((c) => c.id === dragState.cardId);
    if (!card) return;

    if (dragState.type === "move") {
      const dx = (clientX - dragState.startMouseX) / canvasWidth;
      const dy = (clientY - dragState.startMouseY) / canvasHeight;
      updateFreeformCard(dragState.cardId, {
        x: Math.max(0, Math.min(1 - card.w, dragState.startCardX + dx)),
        y: Math.max(0, Math.min(1 - card.h, dragState.startCardY + dy)),
      });
    } else if (dragState.type === "resize" && dragState.resizeHandle) {
      const dx = (clientX - dragState.startMouseX) / canvasWidth;
      const dy = (clientY - dragState.startMouseY) / canvasHeight;
      const startRect: CardRect = {
        x: dragState.startCardX,
        y: dragState.startCardY,
        w: dragState.startCardW,
        h: dragState.startCardH,
      };
      const next = applyResize(startRect, dragState.resizeHandle, dx, dy);
      updateFreeformCard(dragState.cardId, next);
    } else {
      const angle =
        Math.atan2(clientY - dragState.cardCentreY, clientX - dragState.cardCentreX) *
        (180 / Math.PI);
      const startAngle =
        Math.atan2(
          dragState.startMouseY - dragState.cardCentreY,
          dragState.startMouseX - dragState.cardCentreX
        ) *
        (180 / Math.PI);
      updateFreeformCard(dragState.cardId, {
        rotation: dragState.startRotation + (angle - startAngle),
      });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => applyDragMove(e.clientX, e.clientY);

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragState) return;
    e.preventDefault(); // prevent page scroll while dragging
    applyDragMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onMouseUp = () => setDragState(null);
  const onTouchEnd = () => setDragState(null);

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    const dropX = (e.clientX - rect.left) / canvasWidth;
    const dropY = (e.clientY - rect.top) / canvasHeight;
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const newCard: FreeformCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        photoUrl: url,
        x: Math.max(0, dropX - 0.15),
        y: Math.max(0, dropY - 0.15),
        w: 0.3,
        h: 0.3,
        rotation: (Math.random() - 0.5) * 12,
      };
      addFreeformCard(newCard);
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    let x = 0.1;
    let y = 0.1;
    for (const file of Array.from(e.target.files)) {
      const url = URL.createObjectURL(file);
      const newCard: FreeformCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        photoUrl: url,
        x,
        y,
        w: 0.3,
        h: 0.3,
        rotation: (Math.random() - 0.5) * 10,
      };
      addFreeformCard(newCard);
      x = Math.min(0.6, x + 0.04);
      y = Math.min(0.6, y + 0.04);
    }
    e.target.value = "";
  };

  const RESIZE_HANDLES: ResizeHandle[] = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];

  return (
    <div style={{ position: "relative", width: canvasWidth, height: canvasHeight }}>
      <ShapeClipWrapper
        shapeId={collageShape}
        width={canvasWidth}
        height={canvasHeight}
        cssClipPath={shape.cssClipPath(canvasWidth, canvasHeight)}
      >
        <div
          ref={containerRef}
          className="freeform-canvas"
          style={{ width: canvasWidth, height: canvasHeight, background: bg, position: "relative" }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          onClick={() => setSelectedId(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSelectedId(null);
          }}
          data-testid="freeform-canvas"
        >
          {freeformCards.length === 0 && (
            <div className="freeform-empty" aria-label="Drop photos here or use the add button">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Drop photos or click Add Photos</span>
            </div>
          )}

          {freeformCards.map((card) => {
            const isSelected = selectedId === card.id;
            const cardPx = card.x * canvasWidth;
            const cardPy = card.y * canvasHeight;
            const cardW = card.w * canvasWidth;
            const cardH = card.h * canvasHeight;

            return (
              <div
                key={card.id}
                style={{
                  position: "absolute",
                  left: cardPx,
                  top: cardPy,
                  width: cardW,
                  height: cardH,
                  transform: `rotate(${card.rotation}deg)`,
                  transformOrigin: "center center",
                  cursor:
                    dragState?.cardId === card.id && dragState.type === "move"
                      ? "grabbing"
                      : "grab",
                  outline: isSelected ? "2px solid var(--accent)" : "none",
                  outlineOffset: "2px",
                  boxSizing: "border-box",
                  userSelect: "none",
                }}
                onMouseDown={(e) => startMove(e, card)}
                onTouchStart={(e) => startMove(e, card)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(card.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    setSelectedId(card.id);
                  }
                }}
                aria-label="Freeform photo card"
                role="img"
                data-testid={`freeform-card-${card.id}`}
              >
                <img
                  src={card.photoUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                  draggable={false}
                />

                {isSelected && (
                  <>
                    {/* Rotate handle */}
                    <button
                      type="button"
                      className="card-rotate-handle"
                      aria-label="Rotate photo"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        startRotate(e, card);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        startRotate(e, card);
                      }}
                    >
                      <RotateIcon />
                    </button>

                    {/* Remove button */}
                    <button
                      type="button"
                      className="card-remove-btn"
                      aria-label="Remove photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFreeformCard(card.id);
                        setSelectedId(null);
                      }}
                    >
                      <CloseIcon />
                    </button>

                    {/* Resize handles — 8 around the card */}
                    {RESIZE_HANDLES.map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        className="card-resize-handle"
                        data-handle={handle}
                        data-testid={`resize-handle-${handle}`}
                        aria-label={`Resize ${handle}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startResize(e, card, handle);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          startResize(e, card, handle);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ShapeClipWrapper>

      {/* Add button overlay */}
      <button
        type="button"
        className="freeform-add-btn btn-accent"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Add photos to pinboard"
      >
        + Add Photos
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileAdd}
      />
    </div>
  );
}

function RotateIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
