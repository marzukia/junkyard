import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  imageUrl: string;
  onConfirm: (rect: { x: number; y: number; w: number; h: number }) => void;
  onCancel: () => void;
}

interface DragState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  dragging: boolean;
}

/**
 * Overlay component that lets the user drag a rectangular region on an image.
 * Coordinates returned are in natural image pixels (not display pixels).
 */
export function RegionSelector({ imageUrl, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<DragState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    dragging: false,
  });
  const [hasDrag, setHasDrag] = useState(false);

  // Convert client coords to container-relative coords
  const toRelative = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(clientY - rect.top, rect.height)),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = toRelative(e.clientX, e.clientY);
      setDrag({ startX: x, startY: y, endX: x, endY: y, dragging: true });
      setHasDrag(false);
    },
    [toRelative]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.dragging) return;
      const { x, y } = toRelative(e.clientX, e.clientY);
      setDrag((prev) => ({ ...prev, endX: x, endY: y }));
      setHasDrag(true);
    },
    [drag.dragging, toRelative]
  );

  const onPointerUp = useCallback(() => {
    setDrag((prev) => ({ ...prev, dragging: false }));
  }, []);

  // Escape key to cancel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || !hasDrag) return;

    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Scale from display to natural image pixels
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    // Coords are relative to container; offset by image position within container
    const imgOffsetX = imgRect.left - containerRect.left;
    const imgOffsetY = imgRect.top - containerRect.top;

    const x1 = Math.min(drag.startX, drag.endX) - imgOffsetX;
    const y1 = Math.min(drag.startY, drag.endY) - imgOffsetY;
    const x2 = Math.max(drag.startX, drag.endX) - imgOffsetX;
    const y2 = Math.max(drag.startY, drag.endY) - imgOffsetY;

    const nx = Math.round(Math.max(0, x1) * scaleX);
    const ny = Math.round(Math.max(0, y1) * scaleY);
    const nw = Math.round(Math.max(1, x2 - x1) * scaleX);
    const nh = Math.round(Math.max(1, y2 - y1) * scaleY);

    onConfirm({ x: nx, y: ny, w: nw, h: nh });
  }, [drag, hasDrag, onConfirm]);

  // Overlay rect in display coordinates
  const overlayRect =
    hasDrag || drag.dragging
      ? {
          left: Math.min(drag.startX, drag.endX),
          top: Math.min(drag.startY, drag.endY),
          width: Math.abs(drag.endX - drag.startX),
          height: Math.abs(drag.endY - drag.startY),
        }
      : null;

  return (
    <div className="ocr-region-selector">
      <div className="ocr-region-instructions" aria-live="polite">
        Drag to select a region to OCR. Press Escape to cancel.
      </div>
      <div
        ref={containerRef}
        className="ocr-region-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: drag.dragging ? "crosshair" : "crosshair" }}
        aria-label="Draw a rectangle over the part of the image you want to OCR"
        role="application"
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Select region to OCR"
          className="ocr-region-img"
          draggable={false}
        />
        {overlayRect && (
          <div
            className="ocr-region-rect"
            style={{
              left: overlayRect.left,
              top: overlayRect.top,
              width: overlayRect.width,
              height: overlayRect.height,
            }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="ocr-region-actions">
        <button type="button" className="btn-primary" onClick={handleConfirm} disabled={!hasDrag}>
          Scan this region
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
