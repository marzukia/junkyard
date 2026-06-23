import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, clampRect, snapToAspect } from "../crop";
import type { AspectPreset, CropRect, CropShape } from "../crop";

interface CropCanvasProps {
  imageUrl: string;
  imageW: number;
  imageH: number;
  crop: CropRect;
  aspect: AspectPreset;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  /** Arbitrary angle in degrees (-45..+45) for straighten preview */
  straighten?: number;
  /** Crop shape: rect or circle */
  cropShape?: CropShape;
  onChange: (rect: CropRect) => void;
  /** Called once when the user finishes a drag (pointer up). Use to push history. */
  onCommit?: (rect: CropRect) => void;
}

type Handle = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br" | "move";

/** Drawn size of corner/edge handle squares (px at display scale). */
const HANDLE_SIZE = 12;
/**
 * Hit-test radius around each handle centre.
 * Larger on coarse-pointer (touch) devices so thumbs can grab handles reliably.
 */
const HANDLE_HIT =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 24 : 14;

/** Map screen rect to image-pixel coords */
function screenToImage(
  sx: number,
  sy: number,
  canvasRect: DOMRect,
  displayW: number,
  displayH: number,
  imageW: number,
  imageH: number
): [number, number] {
  const relX = (sx - canvasRect.left) / displayW;
  const relY = (sy - canvasRect.top) / displayH;
  return [Math.round(relX * imageW), Math.round(relY * imageH)];
}

/** Compute display scale for the canvas */
function computeDisplaySize(
  imageW: number,
  imageH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  const scale = Math.min(maxW / imageW, maxH / imageH, 1);
  return { w: Math.round(imageW * scale), h: Math.round(imageH * scale) };
}

export function CropCanvas({
  imageUrl,
  imageW,
  imageH,
  crop,
  aspect,
  rotation,
  flipH,
  flipV,
  straighten = 0,
  cropShape = "rect",
  onChange,
  onCommit,
}: CropCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Compute display size on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const maxW = rect.width - 4;
      const maxH = Math.min(rect.width * 0.75, 520);
      if (imageW > 0 && imageH > 0) {
        setDisplaySize(computeDisplaySize(imageW, imageH, maxW, maxH));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [imageW, imageH]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || displaySize.w === 0) return;

    canvas.width = displaySize.w;
    canvas.height = displaySize.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaleX = displaySize.w / imageW;
    const scaleY = displaySize.h / imageH;

    // Draw image with rotation + flip + straighten transforms
    ctx.save();
    ctx.translate(displaySize.w / 2, displaySize.h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    // Apply straighten on top of the 90-degree rotation
    if (straighten !== 0) {
      ctx.rotate((straighten * Math.PI) / 180);
    }
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // After rotation, the effective displayed dimensions may swap
    const isSwapped = rotation === 90 || rotation === 270;
    const drawW = isSwapped ? displaySize.h : displaySize.w;
    const drawH = isSwapped ? displaySize.w : displaySize.h;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Overlay
    const cx = crop.x * scaleX;
    const cy = crop.y * scaleY;
    const cw = crop.w * scaleX;
    const ch = crop.h * scaleY;

    if (cropShape === "circle") {
      // For circle: darken outside using clip path
      ctx.save();
      // Full canvas dark overlay
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, displaySize.w, displaySize.h);
      // Cut out ellipse
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.ellipse(cx + cw / 2, cy + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Ellipse border
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx + cw / 2, cy + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Darken outside crop (rect)
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, displaySize.w, cy);
      ctx.fillRect(0, cy, cx, ch);
      ctx.fillRect(cx + cw, cy, displaySize.w - cx - cw, ch);
      ctx.fillRect(0, cy + ch, displaySize.w, displaySize.h - cy - ch);

      // Crop border
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx, cy, cw, ch);

      // Rule-of-thirds grid
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + (cw * i) / 3, cy);
        ctx.lineTo(cx + (cw * i) / 3, cy + ch);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + (ch * i) / 3);
        ctx.lineTo(cx + cw, cy + (ch * i) / 3);
        ctx.stroke();
      }
    }

    // Corner + edge handles (draw as squares centred on the corner/midpoint)
    ctx.fillStyle = "#ffffff";
    const hs = HANDLE_SIZE;
    const half = hs / 2;
    // Centres of each handle in canvas coords
    const handleCentres: [number, number][] = [
      [cx, cy],
      [cx + cw / 2, cy],
      [cx + cw, cy],
      [cx, cy + ch / 2],
      [cx + cw, cy + ch / 2],
      [cx, cy + ch],
      [cx + cw / 2, cy + ch],
      [cx + cw, cy + ch],
    ];
    for (const [hcx, hcy] of handleCentres) {
      ctx.fillRect(hcx - half, hcy - half, hs, hs);
    }
  }, [imageW, imageH, crop, rotation, flipH, flipV, straighten, cropShape, displaySize]);

  const getHandle = useCallback(
    (px: number, py: number, canvasRect: DOMRect): Handle | null => {
      const scaleX = displaySize.w / imageW;
      const scaleY = displaySize.h / imageH;
      const cx = crop.x * scaleX + canvasRect.left;
      const cy = crop.y * scaleY + canvasRect.top;
      const cw = crop.w * scaleX;
      const ch = crop.h * scaleY;
      // hs is the full hit-box size; centres align with drawn handle centres
      const hs = HANDLE_HIT;
      const half = hs / 2;

      // Each handle is hit-tested as a box centred on the drawn handle centre
      const inH = (hcx: number, hcy: number) =>
        px >= hcx - half && px <= hcx + half && py >= hcy - half && py <= hcy + half;

      // Drawn handle centres (in screen coords):
      const ds = HANDLE_SIZE / 2;
      if (inH(cx + ds, cy + ds)) return "tl";
      if (inH(cx + cw / 2, cy + ds)) return "tc";
      if (inH(cx + cw - ds, cy + ds)) return "tr";
      if (inH(cx + ds, cy + ch / 2)) return "ml";
      if (inH(cx + cw - ds, cy + ch / 2)) return "mr";
      if (inH(cx + ds, cy + ch - ds)) return "bl";
      if (inH(cx + cw / 2, cy + ch - ds)) return "bc";
      if (inH(cx + cw - ds, cy + ch - ds)) return "br";
      // Inside crop = move
      if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) return "move";
      return null;
    },
    [crop, displaySize, imageW, imageH]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const handle = getHandle(e.clientX, e.clientY, rect);
      if (!handle) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
      };
    },
    [getHandle, crop]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const scaleX = imageW / displaySize.w;
      const scaleY = imageH / displaySize.h;
      const dx = Math.round((e.clientX - drag.startX) * scaleX);
      const dy = Math.round((e.clientY - drag.startY) * scaleY);
      const sc = drag.startCrop;
      const MIN = 20;

      let next: CropRect;

      switch (drag.handle) {
        case "move":
          next = { ...sc, x: sc.x + dx, y: sc.y + dy };
          break;
        case "tl":
          next = { x: sc.x + dx, y: sc.y + dy, w: sc.w - dx, h: sc.h - dy };
          break;
        case "tc":
          next = { ...sc, y: sc.y + dy, h: sc.h - dy };
          break;
        case "tr":
          next = { x: sc.x, y: sc.y + dy, w: sc.w + dx, h: sc.h - dy };
          break;
        case "ml":
          next = { x: sc.x + dx, y: sc.y, w: sc.w - dx, h: sc.h };
          break;
        case "mr":
          next = { ...sc, w: sc.w + dx };
          break;
        case "bl":
          next = { x: sc.x + dx, y: sc.y, w: sc.w - dx, h: sc.h + dy };
          break;
        case "bc":
          next = { ...sc, h: sc.h + dy };
          break;
        case "br":
          next = { ...sc, w: sc.w + dx, h: sc.h + dy };
          break;
        default:
          return;
      }

      // Enforce minimum size
      if (next.w < MIN) {
        if (drag.handle.includes("l")) next.x = next.x - (MIN - next.w);
        next.w = MIN;
      }
      if (next.h < MIN) {
        if (drag.handle.includes("t")) next.y = next.y - (MIN - next.h);
        next.h = MIN;
      }

      // Snap to aspect if needed
      if (aspect !== "free" && drag.handle !== "move") {
        const PRESETS: Record<string, { w: number; h: number }> = {
          "1:1": { w: 1, h: 1 },
          "4:5": { w: 4, h: 5 },
          "9:16": { w: 9, h: 16 },
          "16:9": { w: 16, h: 9 },
          "4:3": { w: 4, h: 3 },
          "3:2": { w: 3, h: 2 },
        };
        const ar = PRESETS[aspect];
        if (ar) {
          next = snapToAspect(next, { label: aspect, ...ar });
        }
      }

      onChange(clampRect(next, imageW, imageH));
    },
    [aspect, displaySize, imageW, imageH, onChange]
  );

  const onPointerUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      onCommit?.(crop);
    }
  }, [crop, onCommit]);

  const getCursor = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const handle = getHandle(e.clientX, e.clientY, rect);
      const cursorMap: Record<string, string> = {
        tl: "nwse-resize",
        tc: "ns-resize",
        tr: "nesw-resize",
        ml: "ew-resize",
        mr: "ew-resize",
        bl: "nesw-resize",
        bc: "ns-resize",
        br: "nwse-resize",
        move: "move",
      };
      canvas.style.cursor = handle ? (cursorMap[handle] ?? "default") : "crosshair";
    },
    [getHandle]
  );

  // Allow drawing a new crop from scratch on blank area
  const newCropRef = useRef<{ startImgX: number; startImgY: number } | null>(null);

  const onPointerDownCanvas = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const handle = getHandle(e.clientX, e.clientY, rect);
      if (handle) {
        onPointerDown(e);
        return;
      }
      // Start new crop
      e.currentTarget.setPointerCapture(e.pointerId);
      const [ix, iy] = screenToImage(
        e.clientX,
        e.clientY,
        rect,
        displaySize.w,
        displaySize.h,
        imageW,
        imageH
      );
      newCropRef.current = { startImgX: clamp(ix, 0, imageW), startImgY: clamp(iy, 0, imageH) };
    },
    [getHandle, onPointerDown, displaySize, imageW, imageH]
  );

  const onPointerMoveCanvas = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current) {
        onPointerMove(e);
        return;
      }
      const nc = newCropRef.current;
      if (!nc) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const [ix, iy] = screenToImage(
        e.clientX,
        e.clientY,
        rect,
        displaySize.w,
        displaySize.h,
        imageW,
        imageH
      );
      const x = Math.min(nc.startImgX, clamp(ix, 0, imageW));
      const y = Math.min(nc.startImgY, clamp(iy, 0, imageH));
      const w = Math.abs(ix - nc.startImgX);
      const h = Math.abs(iy - nc.startImgY);
      if (w < 2 || h < 2) return;
      const PRESETS: Record<string, { w: number; h: number }> = {
        "1:1": { w: 1, h: 1 },
        "4:5": { w: 4, h: 5 },
        "9:16": { w: 9, h: 16 },
        "16:9": { w: 16, h: 9 },
        "4:3": { w: 4, h: 3 },
        "3:2": { w: 3, h: 2 },
      };
      let next: CropRect = { x, y, w, h };
      if (aspect !== "free") {
        const ar = PRESETS[aspect];
        if (ar) next = snapToAspect(next, { label: aspect, ...ar });
      }
      onChange(clampRect(next, imageW, imageH));
    },
    [onPointerMove, aspect, displaySize, imageW, imageH, onChange]
  );

  const onPointerUpCanvas = useCallback(() => {
    const wasNewCrop = !!newCropRef.current;
    newCropRef.current = null;
    if (dragRef.current) {
      onPointerUp();
    } else if (wasNewCrop) {
      // Commit the new-crop draw
      onCommit?.(crop);
    }
  }, [onPointerUp, onCommit, crop]);

  return (
    <div
      ref={containerRef}
      className="crop-canvas-wrap"
      style={{ width: "100%", position: "relative" }}
    >
      {displaySize.w > 0 && (
        <canvas
          ref={canvasRef}
          width={displaySize.w}
          height={displaySize.h}
          style={{ display: "block", touchAction: "none" }}
          onPointerDown={onPointerDownCanvas}
          onPointerMove={onPointerMoveCanvas}
          onPointerUp={onPointerUpCanvas}
          onMouseMove={getCursor}
          aria-label="Crop canvas. Drag handles to adjust the crop region."
        />
      )}
    </div>
  );
}
