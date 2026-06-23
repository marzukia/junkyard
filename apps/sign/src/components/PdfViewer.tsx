import type * as PdfjsLib from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

// Lazy-load pdfjs-dist to keep initial bundle small
let pdfjsPromise: Promise<typeof PdfjsLib> | null = null;
function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

export interface SigOverlayState {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PdfViewerProps {
  pdfBytes: ArrayBuffer;
  pageIndex: number;
  sigDataUrl: string | null;
  overlay: SigOverlayState;
  onOverlayChange: (ov: SigOverlayState) => void;
  /** When non-null, render a draggable date stamp label */
  dateOverlay: SigOverlayState | null;
  onDateOverlayChange: (ov: SigOverlayState) => void;
  dateStampText: string | null;
}

export function PdfViewer({
  pdfBytes,
  pageIndex,
  sigDataUrl,
  overlay,
  onOverlayChange,
  dateOverlay,
  onDateOverlayChange,
  dateStampText,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
  const [renderError, setRenderError] = useState<string | null>(null);

  // Drag state for signature overlay
  const dragging = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizing = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Drag state for date stamp overlay
  const dateDragging = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Render the PDF page onto canvas
  useEffect(() => {
    let cancelled = false;
    setRenderError(null);

    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const pdfjs = await getPdfjs();
        const pdfDoc = await pdfjs.getDocument({ data: pdfBytes.slice(0) }).promise;
        const page = await pdfDoc.getPage(pageIndex + 1);

        const container = containerRef.current;
        const maxW = container ? container.clientWidth || 700 : 700;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(maxW / baseViewport.width, 2.5);
        const viewport = page.getViewport({ scale });

        if (cancelled) return;

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        setCanvasDims({ w: canvas.width, h: canvas.height });

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        if (!cancelled) setRenderError(String(err));
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes, pageIndex]);

  // Global mouse handlers for drag and resize
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        const dx = e.clientX - dragging.current.startX;
        const dy = e.clientY - dragging.current.startY;
        const newX = Math.max(0, Math.min(canvasDims.w - overlay.w, dragging.current.origX + dx));
        const newY = Math.max(0, Math.min(canvasDims.h - overlay.h, dragging.current.origY + dy));
        onOverlayChange({ ...overlay, x: newX, y: newY });
      } else if (resizing.current) {
        const dx = e.clientX - resizing.current.startX;
        const dy = e.clientY - resizing.current.startY;
        const newW = Math.max(40, resizing.current.origW + dx);
        const newH = Math.max(20, resizing.current.origH + dy);
        onOverlayChange({ ...overlay, w: newW, h: newH });
      } else if (dateDragging.current && dateOverlay) {
        const dx = e.clientX - dateDragging.current.startX;
        const dy = e.clientY - dateDragging.current.startY;
        const newX = Math.max(
          0,
          Math.min(canvasDims.w - dateOverlay.w, dateDragging.current.origX + dx)
        );
        const newY = Math.max(
          0,
          Math.min(canvasDims.h - dateOverlay.h, dateDragging.current.origY + dy)
        );
        onDateOverlayChange({ ...dateOverlay, x: newX, y: newY });
      }
    };

    const onMouseUp = () => {
      dragging.current = null;
      resizing.current = null;
      dateDragging.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [canvasDims, overlay, onOverlayChange, dateOverlay, onDateOverlayChange]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: overlay.x,
      origY: overlay.y,
    };
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: overlay.w,
      origH: overlay.h,
    };
  };

  const startDateDrag = (e: React.MouseEvent) => {
    if (!dateOverlay) return;
    e.preventDefault();
    dateDragging.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: dateOverlay.x,
      origY: dateOverlay.y,
    };
  };

  return (
    <div className="pdf-preview-area">
      {renderError && (
        <div className="tool-error" role="alert">
          Failed to render PDF page: {renderError}
        </div>
      )}
      <div className="pdf-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="pdf-canvas"
          aria-label={`PDF page ${pageIndex + 1}`}
          role="img"
        />
        {sigDataUrl && canvasDims.w > 0 && (
          <button
            type="button"
            className="sig-overlay"
            style={{
              left: overlay.x,
              top: overlay.y,
              width: overlay.w,
              height: overlay.h,
            }}
            onMouseDown={startDrag}
            aria-label="Signature - drag to reposition"
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 2;
              if (e.key === "ArrowLeft")
                onOverlayChange({ ...overlay, x: Math.max(0, overlay.x - step) });
              if (e.key === "ArrowRight")
                onOverlayChange({
                  ...overlay,
                  x: Math.min(canvasDims.w - overlay.w, overlay.x + step),
                });
              if (e.key === "ArrowUp")
                onOverlayChange({ ...overlay, y: Math.max(0, overlay.y - step) });
              if (e.key === "ArrowDown")
                onOverlayChange({
                  ...overlay,
                  y: Math.min(canvasDims.h - overlay.h, overlay.y + step),
                });
            }}
          >
            <img src={sigDataUrl} alt="Signature" className="sig-overlay-img" draggable={false} />
            <button
              type="button"
              className="sig-resize-handle"
              onMouseDown={startResize}
              aria-label="Resize signature"
            />
          </button>
        )}
        {dateOverlay && dateStampText && canvasDims.w > 0 && (
          <button
            type="button"
            className="date-stamp-overlay"
            style={{
              left: dateOverlay.x,
              top: dateOverlay.y,
            }}
            onMouseDown={startDateDrag}
            aria-label="Date stamp - drag to reposition"
          >
            {dateStampText}
          </button>
        )}
      </div>
    </div>
  );
}
