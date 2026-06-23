import { useEffect, useRef } from "react";
import type { OgConfig } from "../ogLogic";
import { resolveFontFamily, shrinkFontToFit, wrapTextCtx } from "../ogLogic";

interface OgCanvasProps {
  config: OgConfig;
  /** Canvas logical width (default 1200) */
  width?: number;
  /** Canvas logical height (default 630) */
  height?: number;
}

/**
 * Renders the OG image onto an HTML5 Canvas at 1200x630.
 * The canvas is CSS-scaled to fit its container via CSS width:100%, height:100%.
 */
export function OgCanvas({ config, width = 1200, height = 630 }: OgCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawOgImage(ctx, canvas, config, width, height);
  }, [config, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="og-canvas-preview"
      aria-label="OG image preview"
    />
  );
}

/**
 * Draw the full OG image onto the canvas context.
 * Exported so Playwright can call it against a real canvas for the og.png generation.
 */
export function drawOgImage(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  config: OgConfig,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);

  // Background
  if (config.bgType === "gradient") {
    const angle = (config.gradientAngle * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const len = Math.sqrt(width * width + height * height) / 2;
    const grad = ctx.createLinearGradient(
      cx - Math.cos(angle) * len,
      cy - Math.sin(angle) * len,
      cx + Math.cos(angle) * len,
      cy + Math.sin(angle) * len
    );
    grad.addColorStop(0, config.bgColor);
    grad.addColorStop(1, config.bgColorEnd);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = config.bgColor;
  }
  ctx.fillRect(0, 0, width, height);

  // Background image (async load)
  if (config.bgImage) {
    const img = new window.Image();
    img.onload = () => {
      ctx.save();
      ctx.globalAlpha = config.bgImageOpacity;
      const scale = Math.max(width / img.width, height / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const sx = (width - sw) / 2;
      const sy = (height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh);
      ctx.restore();
      drawOverlay(ctx, config, width, height);
    };
    img.src = config.bgImage;
  } else {
    drawOverlay(ctx, config, width, height);
  }
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  config: OgConfig,
  width: number,
  height: number
): void {
  const fontFamily = resolveFontFamily(config.font);
  const isLeft = config.layout === "left" || config.layout === "brand";
  const pad = width * 0.072; // ~86px at 1200

  // Brand layout extras
  if (config.layout === "brand") {
    ctx.fillStyle = "#2f9d8d";
    ctx.fillRect(0, 0, 8, height);
    ctx.fillStyle = "#e8b04b";
    ctx.beginPath();
    ctx.arc(width - pad / 2, pad / 2, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9594c";
    ctx.beginPath();
    ctx.arc(width - pad / 2, pad / 2 + 54, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = config.textColor;

  const textX = isLeft ? pad : width / 2;
  const textAlign = isLeft ? "left" : "center";
  ctx.textAlign = textAlign;
  ctx.textBaseline = "middle";

  // Badge: drawn at height * 0.18, occupies a pill of ~badgeH pixels
  const badgeFontSize = Math.round(height * 0.034); // ~21px at 630
  let badgeBottom = 0;
  if (config.badge) {
    ctx.font = `500 ${badgeFontSize}px ${fontFamily}`;
    const badgeText = config.badge;
    const badgeMetrics = ctx.measureText(badgeText);
    const badgePadX = badgeFontSize * 0.85;
    const badgePadY = badgeFontSize * 0.45;
    const badgeW = badgeMetrics.width + badgePadX * 2;
    const badgeH = badgeFontSize + badgePadY * 2;
    const badgeY = height * 0.18;
    const badgeX = isLeft ? textX : width / 2 - badgeW / 2;
    badgeBottom = badgeY + badgeH;

    const r = badgeH / 2;
    ctx.fillStyle = config.badgeBg;
    ctx.beginPath();
    ctx.moveTo(badgeX + r, badgeY);
    ctx.lineTo(badgeX + badgeW - r, badgeY);
    ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
    ctx.lineTo(badgeX + badgeW, badgeY + r);
    ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
    ctx.lineTo(badgeX + r, badgeY + badgeH);
    ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r);
    ctx.lineTo(badgeX, badgeY + r);
    ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = config.badgeText;
    ctx.textAlign = "left";
    ctx.fillText(badgeText, badgeX + badgePadX, badgeY + badgeH / 2);
    ctx.textAlign = textAlign;
  }

  // Title: auto-shrink so it fits between badge and bottom margin
  // Available vertical space: from badgeBottom + gap to height - pad
  const titleGapFromBadge = height * 0.04;
  const titleAreaTop = badgeBottom > 0 ? badgeBottom + titleGapFromBadge : height * 0.26;
  const titleAreaBottom = height - pad;
  const maxTitleWidth = width - pad * 2;

  // Subtitle will take roughly subtitleFontSize * 1.4 * lines + gap
  const subtitleFontSize = Math.round(height * 0.042);
  const subtitleReserve = config.subtitle ? subtitleFontSize * 1.4 * 2 + subtitleFontSize * 0.8 : 0;

  const availableForTitle = titleAreaBottom - titleAreaTop - subtitleReserve;
  const initialTitleFontSize = Math.round(height * 0.113); // ~71px
  // Allow at most as many lines as fit without clipping
  const titleLineH = initialTitleFontSize * 1.15;
  const maxLinesFromSpace = Math.max(1, Math.floor(availableForTitle / titleLineH));

  const titleFontSize = shrinkFontToFit(
    ctx,
    config.title,
    fontFamily,
    initialTitleFontSize,
    maxTitleWidth,
    maxLinesFromSpace,
    Math.round(initialTitleFontSize * 0.45) // min = 45% of nominal
  );

  ctx.font = `800 ${titleFontSize}px ${fontFamily}`;
  ctx.fillStyle = config.textColor;

  const actualLineH = titleFontSize * 1.15;
  const titleLines = wrapTextCtx(ctx, config.title, maxTitleWidth);
  const totalTitleH = titleLines.length * actualLineH;

  // Center title block within available space
  const titleBlockCenter = titleAreaTop + (titleAreaBottom - subtitleReserve - titleAreaTop) / 2;
  const titleStartY = titleBlockCenter - totalTitleH / 2 + actualLineH / 2;

  for (let i = 0; i < titleLines.length; i++) {
    ctx.fillText(titleLines[i] as string, textX, titleStartY + i * actualLineH);
  }

  // Subtitle
  if (config.subtitle) {
    ctx.font = `400 ${subtitleFontSize}px ${fontFamily}`;
    ctx.fillStyle = config.textColor;
    ctx.globalAlpha = 0.7;
    const subtitleY = titleStartY + totalTitleH + subtitleFontSize * 0.8;
    const subLines = wrapTextCtx(ctx, config.subtitle, maxTitleWidth);
    for (let i = 0; i < subLines.length; i++) {
      ctx.fillText(subLines[i] as string, textX, subtitleY + i * subtitleFontSize * 1.4);
    }
    ctx.globalAlpha = 1;
  }

  // Logo overlay
  if (config.logoImage) {
    const logo = new window.Image();
    logo.onload = () => {
      const size = config.logoSize;
      // Bottom-right corner with padding
      const lx = width - pad - size;
      const ly = height - pad - size;
      // Draw with natural aspect ratio fitted into the size box
      const scale = Math.min(size / logo.width, size / logo.height);
      const lw = logo.width * scale;
      const lh = logo.height * scale;
      ctx.drawImage(logo, lx + (size - lw) / 2, ly + (size - lh) / 2, lw, lh);
    };
    logo.src = config.logoImage;
  }
}

/**
 * Export the canvas as a PNG blob. Renders at the specified dimensions into
 * an offscreen canvas so the display scale doesn't affect output quality.
 */
export async function exportToPng(config: OgConfig, width = 1200, height = 630): Promise<Blob> {
  const W = width;
  const H = height;
  const offscreen = document.createElement("canvas");
  offscreen.width = W;
  offscreen.height = H;
  const ctx = offscreen.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Wait for fonts to load before drawing
  await document.fonts.ready;

  return new Promise((resolve, reject) => {
    if (config.bgImage) {
      const bgImg = new window.Image();
      bgImg.onload = () => {
        // Draw background
        drawBackground(ctx, config, W, H);
        // Draw background image
        ctx.save();
        ctx.globalAlpha = config.bgImageOpacity;
        const scale = Math.max(W / bgImg.width, H / bgImg.height);
        const sw = bgImg.width * scale;
        const sh = bgImg.height * scale;
        ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
        ctx.restore();
        // Draw overlay then logo
        drawOverlay(ctx, config, W, H);
        if (config.logoImage) {
          drawLogoThenBlob(ctx, config, W, H, offscreen, resolve, reject);
        } else {
          offscreen.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas export failed"));
          }, "image/png");
        }
      };
      bgImg.onerror = () => reject(new Error("Background image load failed"));
      bgImg.src = config.bgImage;
    } else {
      drawBackground(ctx, config, W, H);
      drawOverlay(ctx, config, W, H);
      if (config.logoImage) {
        drawLogoThenBlob(ctx, config, W, H, offscreen, resolve, reject);
      } else {
        offscreen.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas export failed"));
        }, "image/png");
      }
    }
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  config: OgConfig,
  W: number,
  H: number
): void {
  if (config.bgType === "gradient") {
    const angle = (config.gradientAngle * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const len = Math.sqrt(W * W + H * H) / 2;
    const grad = ctx.createLinearGradient(
      cx - Math.cos(angle) * len,
      cy - Math.sin(angle) * len,
      cx + Math.cos(angle) * len,
      cy + Math.sin(angle) * len
    );
    grad.addColorStop(0, config.bgColor);
    grad.addColorStop(1, config.bgColorEnd);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = config.bgColor;
  }
  ctx.fillRect(0, 0, W, H);
}

function drawLogoThenBlob(
  ctx: CanvasRenderingContext2D,
  config: OgConfig,
  W: number,
  H: number,
  offscreen: HTMLCanvasElement,
  resolve: (blob: Blob) => void,
  reject: (err: Error) => void
): void {
  if (!config.logoImage) {
    offscreen.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, "image/png");
    return;
  }
  const logo = new window.Image();
  logo.onload = () => {
    const size = config.logoSize;
    const pad = W * 0.072;
    const lx = W - pad - size;
    const ly = H - pad - size;
    const scale = Math.min(size / logo.width, size / logo.height);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    ctx.drawImage(logo, lx + (size - lw) / 2, ly + (size - lh) / 2, lw, lh);
    offscreen.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, "image/png");
  };
  logo.onerror = () => reject(new Error("Logo image load failed"));
  logo.src = config.logoImage;
}
