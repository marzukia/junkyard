/**
 * High-resolution canvas export for grid and freeform collage modes.
 *
 * Grid export: renders each cell using its template rect + per-cell photo
 * with pan/zoom offsets applied. Gutter is rendered as background colour.
 *
 * Freeform export: renders each card with its position, rotation, scale.
 */

import type { CollageShapeId } from "./collageShapes";
import { applyShapeClip } from "./collageShapes";
import type { CellRect } from "./layouts";

export interface GridCellState {
  rect: CellRect; // normalised 0-1 fractional rect from template
  photoUrl: string | null;
  panX: number; // focal point offset [-0.5, 0.5] in image-relative coords
  panY: number;
  zoom: number; // 1.0 = fit-cover baseline; >1 zooms in
}

export interface FreeformCard {
  id: string;
  photoUrl: string;
  x: number; // px on canvas (normalised 0-1)
  y: number;
  w: number; // 0-1 fraction of canvas width
  h: number;
  rotation: number; // degrees
}

export interface ExportGridParams {
  cells: GridCellState[];
  exportWidth: number;
  exportHeight: number;
  gutter: number; // px in export space
  radius: number; // px in export space
  background: string; // CSS colour string or "transparent"
  collageShape: CollageShapeId;
  format: "png" | "jpg";
  jpgQuality?: number; // 0-1
  borderWidth?: number; // px in export space (optional inset border per cell)
  borderColor?: string; // CSS colour for the border
}

export interface ExportFreeformParams {
  cards: FreeformCard[];
  exportWidth: number;
  exportHeight: number;
  background: string;
  collageShape: CollageShapeId;
  format: "png" | "jpg";
  jpgQuality?: number;
}

/** Load an image from a URL, returning an HTMLImageElement. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Draw a rounded rectangle path on a canvas context.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * Draw a single photo into a cell rect using cover-fit + pan/zoom.
 * panX/panY in [-0.5, 0.5]: 0 = centred, ±0.5 = edge aligned.
 * zoom >= 1.
 */
function drawCoverPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  panX: number,
  panY: number,
  zoom: number
) {
  // Scale to cover the cell
  const scaleX = cellW / img.naturalWidth;
  const scaleY = cellH / img.naturalHeight;
  const coverScale = Math.max(scaleX, scaleY) * zoom;

  const drawW = img.naturalWidth * coverScale;
  const drawH = img.naturalHeight * coverScale;

  // Centre + apply pan offset (panX/Y in [-0.5,0.5] of the overflow)
  const overflowX = drawW - cellW;
  const overflowY = drawH - cellH;
  const drawX = cellX - overflowX / 2 - panX * overflowX;
  const drawY = cellY - overflowY / 2 - panY * overflowY;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

export async function exportGrid(params: ExportGridParams): Promise<Blob> {
  const {
    cells,
    exportWidth,
    exportHeight,
    gutter,
    radius,
    background,
    collageShape,
    format,
    jpgQuality,
    borderWidth = 0,
    borderColor = "#000000",
  } = params;

  const canvas = document.createElement("canvas");
  canvas.width = exportWidth;
  canvas.height = exportHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");

  // Apply shape clip to the entire canvas (before drawing anything)
  ctx.save();
  const hasShapeClip = applyShapeClip(ctx, collageShape, exportWidth, exportHeight);

  // Background (inside the shape clip when active)
  if (background === "transparent" && format === "png") {
    ctx.clearRect(0, 0, exportWidth, exportHeight);
  } else {
    ctx.fillStyle = background === "transparent" ? "#ffffff" : background;
    ctx.fillRect(0, 0, exportWidth, exportHeight);
  }

  // Load all images in parallel
  const images = await Promise.all(
    cells.map((c) => (c.photoUrl ? loadImage(c.photoUrl) : Promise.resolve(null)))
  );

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const img = images[i];

    // Convert normalised rect to pixel rect, inset by gutter
    const halfG = gutter / 2;
    const px = cell.rect.x * exportWidth + halfG;
    const py = cell.rect.y * exportHeight + halfG;
    const pw = cell.rect.w * exportWidth - gutter;
    const ph = cell.rect.h * exportHeight - gutter;

    if (img) {
      ctx.save();
      roundedRect(ctx, px, py, pw, ph, radius);
      ctx.clip();
      drawCoverPhoto(ctx, img, px, py, pw, ph, cell.panX, cell.panY, cell.zoom);
      ctx.restore();
    } else {
      // Empty cell — draw a faint placeholder
      ctx.save();
      roundedRect(ctx, px, py, pw, ph, radius);
      ctx.fillStyle = "rgba(128,128,128,0.12)";
      ctx.fill();
      ctx.restore();
    }

    // Optional inset border drawn on top of the cell content
    if (borderWidth > 0) {
      ctx.save();
      roundedRect(ctx, px, py, pw, ph, radius);
      ctx.clip();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth * 2; // inset by clipping, so double the width
      ctx.stroke();
      ctx.restore();
    }
  }

  // Restore from shape clip
  if (hasShapeClip) ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("toBlob failed"));
        resolve(blob);
      },
      format === "jpg" ? "image/jpeg" : "image/png",
      jpgQuality ?? 0.92
    );
  });
}

export async function exportFreeform(params: ExportFreeformParams): Promise<Blob> {
  const { cards, exportWidth, exportHeight, background, collageShape, format, jpgQuality } = params;

  const canvas = document.createElement("canvas");
  canvas.width = exportWidth;
  canvas.height = exportHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");

  // Apply shape clip to the entire canvas (before drawing anything)
  ctx.save();
  const hasShapeClip = applyShapeClip(ctx, collageShape, exportWidth, exportHeight);

  // Background (inside the shape clip when active)
  if (background === "transparent" && format === "png") {
    ctx.clearRect(0, 0, exportWidth, exportHeight);
  } else {
    ctx.fillStyle = background === "transparent" ? "#ffffff" : background;
    ctx.fillRect(0, 0, exportWidth, exportHeight);
  }

  const images = await Promise.all(cards.map((c) => loadImage(c.photoUrl)));

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const img = images[i];

    const cardW = card.w * exportWidth;
    const cardH = card.h * exportHeight;
    const cardX = card.x * exportWidth;
    const cardY = card.y * exportHeight;

    ctx.save();
    // Rotate around card centre
    ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
    ctx.rotate((card.rotation * Math.PI) / 180);
    ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
    ctx.restore();
  }

  // Restore from shape clip
  if (hasShapeClip) ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("toBlob failed"));
        resolve(blob);
      },
      format === "jpg" ? "image/jpeg" : "image/png",
      jpgQuality ?? 0.92
    );
  });
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
