import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToPngDataUrl } from "../lib/signPdf";

interface DrawCanvasProps {
  inkColor: string;
  onSignature: (dataUrl: string | null) => void;
}

function getPosFromEvent(
  e: MouseEvent | Touch,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

export function DrawCanvas({ inkColor, onSignature }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const startDraw = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawing.current = true;
      lastPos.current = { x, y };
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = inkColor;
      ctx.fill();
    },
    [inkColor]
  );

  const continueDraw = useCallback(
    (x: number, y: number) => {
      if (!drawing.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || !lastPos.current) return;
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      lastPos.current = { x, y };
      setIsEmpty(false);
    },
    [inkColor]
  );

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvasToPngDataUrl(canvas);
    onSignature(dataUrl);
  }, [onSignature]);

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const pos = getPosFromEvent(e, canvas);
      startDraw(pos.x, pos.y);
    };
    const onMouseMove = (e: MouseEvent) => {
      const pos = getPosFromEvent(e, canvas);
      continueDraw(pos.x, pos.y);
    };
    const onMouseUp = () => endDraw();

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [startDraw, continueDraw, endDraw]);

  // Touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const pos = getPosFromEvent(touch, canvas);
      startDraw(pos.x, pos.y);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const pos = getPosFromEvent(touch, canvas);
      continueDraw(pos.x, pos.y);
    };
    const onTouchEnd = () => endDraw();

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [startDraw, continueDraw, endDraw]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onSignature(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div className="draw-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="draw-canvas"
          width={560}
          height={180}
          aria-label="Signature drawing area"
          role="img"
        />
        {isEmpty && (
          <div className="draw-canvas-empty-hint" aria-hidden="true">
            Draw your signature here
          </div>
        )}
      </div>
      <div className="draw-actions">
        <button type="button" className="btn-secondary" onClick={clear} disabled={isEmpty}>
          Clear
        </button>
        <span className="mono-label" style={{ marginLeft: "auto" }}>
          Draw with mouse or finger
        </span>
      </div>
    </div>
  );
}
