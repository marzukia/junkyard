/**
 * Canvas-based renderer. Draws the beautified screenshot and returns a PNG data-URL.
 * Separated from beautifier.ts so the pure logic remains unit-testable without a DOM.
 */

import {
  FRAME_BAR_HEIGHTS,
  SIZE_PRESETS,
  angleToVector,
  canvasDimensions,
  mimeForFormat,
  resolveBackground,
} from "./beautifier";
import type { BeautifySettings } from "./beautifier";

const TRAFFIC_RADIUS = 6;
const TRAFFIC_GAP = 8;
const TRAFFIC_START_X = 16;
const TRAFFIC_Y_CENTRE = 18;

/** Draw the macOS-style window chrome bar. */
function drawMacOsFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.save();
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  const colors = ["#ff5f57", "#febc2e", "#28c840"];
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(
      x + TRAFFIC_START_X + i * (TRAFFIC_RADIUS * 2 + TRAFFIC_GAP),
      y + TRAFFIC_Y_CENTRE,
      TRAFFIC_RADIUS,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
  ctx.restore();
}

/** Draw a browser-chrome bar with an address pill. */
function drawBrowserFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  scale: number,
  urlText: string
) {
  ctx.save();

  // Bar background
  ctx.fillStyle = "#f0f0f0";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  // Thin separator line at bottom
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();

  // Traffic light dots (smaller for browser)
  const tRadius = 5 * scale;
  const tGap = 6 * scale;
  const tStartX = x + 14 * scale;
  const tCY = y + h / 2;
  const tColors = ["#ff5f57", "#febc2e", "#28c840"];
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(tStartX + i * (tRadius * 2 + tGap), tCY, tRadius, 0, Math.PI * 2);
    ctx.fillStyle = tColors[i];
    ctx.fill();
  }

  // Address pill
  const pillH = 26 * scale;
  const pillPadX = 16 * scale;
  const pillW = Math.min(w * 0.45, 320 * scale);
  const pillX = x + w / 2 - pillW / 2;
  const pillY = y + (h - pillH) / 2;
  const pillR = pillH / 2;

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.lineTo(pillX + pillW - pillR, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
  ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH);
  ctx.lineTo(pillX + pillR, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
  ctx.lineTo(pillX, pillY + pillR);
  ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1 * scale;
  ctx.stroke();

  // URL text inside pill
  const fontSize = 11 * scale;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#333333";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Clip to pill interior so long URLs don't overflow
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.lineTo(pillX + pillW - pillR, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
  ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH);
  ctx.lineTo(pillX + pillR, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
  ctx.lineTo(pillX, pillY + pillR);
  ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
  ctx.closePath();
  ctx.clip();
  ctx.fillText(urlText, pillX + pillW / 2, pillY + pillH / 2, pillW - pillPadX * 2);
  ctx.restore();

  ctx.restore();
}

/**
 * Render the beautified image onto a canvas and return it.
 * If a bgImage is provided and bgKind=image, it will be drawn as the background.
 */
export function renderToCanvas(
  img: HTMLImageElement,
  settings: BeautifySettings,
  bgImage?: HTMLImageElement | null
): HTMLCanvasElement {
  const scale = settings.exportScale;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const frameType = settings.windowFrameType;
  const frameBarH1x = FRAME_BAR_HEIGHTS[frameType] ?? 0;

  // Apply size preset
  const preset = SIZE_PRESETS.find((p) => p.id === settings.sizePresetId);
  let renderW = srcW;
  let renderH = srcH;
  if (preset && preset.width > 0 && preset.height > 0) {
    const presetW = preset.width * scale;
    const presetH = preset.height * scale;
    const innerW = presetW - settings.padding * scale * 2;
    const innerH = presetH - settings.padding * scale * 2 - frameBarH1x * scale;
    if (innerW > 0 && innerH > 0) {
      const ratio = Math.min(innerW / srcW, innerH / srcH);
      renderW = Math.round(srcW * ratio);
      renderH = Math.round(srcH * ratio);
    }
  }

  const { canvasW, canvasH, imgOffsetX, imgOffsetY } = canvasDimensions(
    renderW,
    renderH,
    settings.padding * scale,
    frameType
  );

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");

  // ─── Background ───────────────────────────────────────────────────────────
  const bg = resolveBackground(settings);
  if (bg.type === "image" && bgImage) {
    // Cover-fit the bg image
    const sx = bgImage.naturalWidth;
    const sy = bgImage.naturalHeight;
    const scaleX = canvasW / sx;
    const scaleY = canvasH / sy;
    const coverScale = Math.max(scaleX, scaleY);
    const drawW = sx * coverScale;
    const drawH = sy * coverScale;
    const drawX = (canvasW - drawW) / 2;
    const drawY = (canvasH - drawH) / 2;
    ctx.drawImage(bgImage, drawX, drawY, drawW, drawH);
  } else if (bg.type === "solid") {
    ctx.fillStyle = bg.color ?? "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (bg.type === "gradient" && bg.gradientStops && bg.gradientAngle !== undefined) {
    const [vx, vy] = angleToVector(bg.gradientAngle);
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const halfDiag = Math.sqrt(canvasW * canvasW + canvasH * canvasH) / 2;
    const grad = ctx.createLinearGradient(
      cx - vx * halfDiag,
      cy - vy * halfDiag,
      cx + vx * halfDiag,
      cy + vy * halfDiag
    );
    grad.addColorStop(0, bg.gradientStops[0]);
    grad.addColorStop(1, bg.gradientStops[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else {
    // Fallback: white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // ─── Window frame ─────────────────────────────────────────────────────────
  if (frameType === "macos") {
    drawMacOsFrame(
      ctx,
      imgOffsetX,
      imgOffsetY - frameBarH1x,
      renderW,
      frameBarH1x,
      settings.cornerRadius
    );
  } else if (frameType === "browser") {
    drawBrowserFrame(
      ctx,
      imgOffsetX,
      imgOffsetY - frameBarH1x,
      renderW,
      frameBarH1x,
      settings.cornerRadius,
      scale,
      settings.browserUrl
    );
  }

  // ─── Drop shadow ──────────────────────────────────────────────────────────
  if (settings.shadowSize > 0) {
    const shadowBlur = [0, 16 * scale, 40 * scale, 80 * scale][settings.shadowSize];
    const shadowOffset = [0, 4 * scale, 8 * scale, 20 * scale][settings.shadowSize];
    const shadowAlpha = [0, 0.25, 0.35, 0.5][settings.shadowSize];
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = shadowOffset;
    ctx.fillStyle = "rgba(0,0,0,0.001)";
    roundRectFill(ctx, imgOffsetX, imgOffsetY, renderW, renderH, settings.cornerRadius);
    ctx.restore();
  }

  // ─── Screenshot image with clipping ────────────────────────────────────
  ctx.save();
  if (settings.cornerRadius > 0) {
    ctx.beginPath();
    roundRectPath(ctx, imgOffsetX, imgOffsetY, renderW, renderH, settings.cornerRadius);
    ctx.clip();
  }
  ctx.drawImage(img, imgOffsetX, imgOffsetY, renderW, renderH);
  ctx.restore();

  return canvas;
}

/** Render the beautified image onto a canvas and return a data-URL. */
export function renderToDataUrl(
  img: HTMLImageElement,
  settings: BeautifySettings,
  bgImage?: HTMLImageElement | null
): string {
  const canvas = renderToCanvas(img, settings, bgImage);
  return canvas.toDataURL(mimeForFormat(settings.exportFormat));
}

/** Render to a Blob for clipboard / async download. */
export function renderToBlob(
  img: HTMLImageElement,
  settings: BeautifySettings,
  bgImage?: HTMLImageElement | null
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = renderToCanvas(img, settings, bgImage);
    canvas.toBlob(resolve, mimeForFormat(settings.exportFormat), 0.92);
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function roundRectFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}
