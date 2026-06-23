import QRCode from "qrcode";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type DotStyle = "square" | "rounded" | "dots" | "classy";

export interface QROptions {
  text: string;
  fgColor: string;
  bgColor: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dotStyle: DotStyle;
  logoDataUrl?: string;
  logoSizeRatio?: number;
}

/** Returns true if the string is a valid 6-digit hex colour (with or without #). */
export function isValidHex(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

/** Normalises a hex input to "#rrggbb" form, or returns null if invalid. */
export function normaliseHex(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return `#${trimmed.toLowerCase()}`;
}

/** Converts a hex colour string to an {r, g, b} tuple (0-255). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = normaliseHex(hex);
  if (!clean) return null;
  const n = Number.parseInt(clean.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Generates a QR code onto a canvas element, applying dot-style post-processing
 * and an optional logo overlay.
 *
 * Returns the canvas element (same as the one passed in) so callers can chain.
 */
export async function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  opts: QROptions
): Promise<HTMLCanvasElement> {
  const {
    text,
    fgColor,
    bgColor,
    errorCorrectionLevel,
    dotStyle,
    logoDataUrl,
    logoSizeRatio = 0.22,
  } = opts;

  const size = canvas.width;

  // 1. Render base QR via qrcode lib (square dots, then we may restyle)
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 2,
    color: {
      dark: fgColor,
      light: bgColor,
    },
    errorCorrectionLevel,
  });

  // 2. Apply dot style via pixel manipulation if not plain square
  if (dotStyle !== "square") {
    applyDotStyle(canvas, fgColor, bgColor, dotStyle);
  }

  // 3. Overlay logo if provided
  if (logoDataUrl) {
    await overlayLogo(canvas, logoDataUrl, logoSizeRatio, bgColor);
  }

  return canvas;
}

/**
 * Post-processes the canvas to restyle QR dots.
 * Reads existing dark pixels, clears canvas, re-draws with new shape per module.
 */
function applyDotStyle(
  canvas: HTMLCanvasElement,
  fgColor: string,
  bgColor: string,
  style: DotStyle
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.width;
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  // Detect module size by scanning top row for the first dark pixel run
  const fg = hexToRgb(fgColor) ?? { r: 0, g: 0, b: 0 };
  const threshold = 128;

  // Find the quiet zone offset and module size by looking at the top finder pattern
  let firstDark = -1;
  for (let x = 0; x < size; x++) {
    const idx = x * 4;
    if (
      Math.abs(data[idx] - fg.r) < threshold &&
      Math.abs(data[idx + 1] - fg.g) < threshold &&
      Math.abs(data[idx + 2] - fg.b) < threshold
    ) {
      firstDark = x;
      break;
    }
  }
  if (firstDark < 0) return;

  // Count pixels in first dark run to get module size
  let moduleSize = 0;
  for (let x = firstDark; x < size; x++) {
    const idx = x * 4;
    if (
      Math.abs(data[idx] - fg.r) < threshold &&
      Math.abs(data[idx + 1] - fg.g) < threshold &&
      Math.abs(data[idx + 2] - fg.b) < threshold
    ) {
      moduleSize++;
    } else {
      break;
    }
  }
  if (moduleSize < 1) return;

  // Build a boolean grid of dark modules
  const cols = Math.round(size / moduleSize);
  const grid: boolean[][] = [];
  for (let row = 0; row < cols; row++) {
    grid[row] = [];
    for (let col = 0; col < cols; col++) {
      const px = Math.floor(col * moduleSize + moduleSize / 2);
      const py = Math.floor(row * moduleSize + moduleSize / 2);
      if (px >= size || py >= size) {
        grid[row][col] = false;
        continue;
      }
      const idx = (py * size + px) * 4;
      grid[row][col] =
        Math.abs(data[idx] - fg.r) < threshold &&
        Math.abs(data[idx + 1] - fg.g) < threshold &&
        Math.abs(data[idx + 2] - fg.b) < threshold;
    }
  }

  // Redraw with style
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fgColor;

  const pad = moduleSize * 0.12;
  const dotR = moduleSize / 2 - pad;

  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      if (!grid[row][col]) continue;
      const cx = col * moduleSize + moduleSize / 2;
      const cy = row * moduleSize + moduleSize / 2;

      if (style === "dots") {
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === "rounded") {
        const r = moduleSize * 0.3;
        const x = cx - moduleSize / 2 + pad;
        const y = cy - moduleSize / 2 + pad;
        const w = moduleSize - pad * 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, w, r);
        ctx.fill();
      } else if (style === "classy") {
        // Classy: dots where all 4 neighbours are dark → square; else circle
        const allNeighboursDark =
          grid[row - 1]?.[col] &&
          grid[row + 1]?.[col] &&
          grid[row]?.[col - 1] &&
          grid[row]?.[col + 1];
        if (allNeighboursDark) {
          const x = cx - moduleSize / 2 + pad;
          const y = cy - moduleSize / 2 + pad;
          const w = moduleSize - pad * 2;
          ctx.fillRect(x, y, w, w);
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

/** Overlays a logo image centred on the canvas with a white background square. */
async function overlayLogo(
  canvas: HTMLCanvasElement,
  logoDataUrl: string,
  sizeRatio: number,
  bgColor: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve();
        return;
      }
      const size = canvas.width;
      const logoArea = size * sizeRatio;
      const padded = logoArea * 1.15;
      const x = (size - padded) / 2;
      const y = (size - padded) / 2;

      // White (or bgColor) backing square with slight rounding
      ctx.fillStyle = bgColor;
      const rr = padded * 0.12;
      ctx.beginPath();
      ctx.roundRect(x, y, padded, padded, rr);
      ctx.fill();

      // Draw logo centred in the backing
      const lx = (size - logoArea) / 2;
      const ly = (size - logoArea) / 2;
      ctx.drawImage(img, lx, ly, logoArea, logoArea);
      resolve();
    };
    img.onerror = reject;
    img.src = logoDataUrl;
  });
}

/**
 * Exports the canvas as a PNG blob URL.
 * Caller is responsible for revoking the URL when done.
 */
export function canvasToPngUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

/**
 * Generates an SVG string for the QR code. Uses the qrcode library to get
 * the raw data matrix, then renders square or rounded rectangles as SVG paths.
 */
export async function generateSvgString(opts: QROptions): Promise<string> {
  const { text, fgColor, bgColor, errorCorrectionLevel } = opts;

  // Get the raw QR matrix from the lib
  // We use a hidden canvas approach to get module positions
  const offscreen = document.createElement("canvas");
  offscreen.width = 512;
  offscreen.height = 512;

  await QRCode.toCanvas(offscreen, text, {
    width: 512,
    margin: 2,
    color: { dark: fgColor, light: bgColor },
    errorCorrectionLevel,
  });

  const ctx = offscreen.getContext("2d");
  if (!ctx) throw new Error("Cannot get canvas context");

  const size = 512;
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  const fg = hexToRgb(fgColor) ?? { r: 0, g: 0, b: 0 };
  const threshold = 128;

  // Detect module size
  let firstDark = -1;
  for (let x = 0; x < size; x++) {
    const idx = x * 4;
    if (
      Math.abs(data[idx] - fg.r) < threshold &&
      Math.abs(data[idx + 1] - fg.g) < threshold &&
      Math.abs(data[idx + 2] - fg.b) < threshold
    ) {
      firstDark = x;
      break;
    }
  }

  let moduleSize = 0;
  if (firstDark >= 0) {
    for (let x = firstDark; x < size; x++) {
      const idx = x * 4;
      if (
        Math.abs(data[idx] - fg.r) < threshold &&
        Math.abs(data[idx + 1] - fg.g) < threshold &&
        Math.abs(data[idx + 2] - fg.b) < threshold
      ) {
        moduleSize++;
      } else {
        break;
      }
    }
  }
  if (moduleSize < 1) moduleSize = 1;

  const cols = Math.round(size / moduleSize);
  const svgSize = 512;
  const cellSize = svgSize / cols;

  const rects: string[] = [];
  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      const px = Math.floor(col * moduleSize + moduleSize / 2);
      const py = Math.floor(row * moduleSize + moduleSize / 2);
      if (px >= size || py >= size) continue;
      const idx = (py * size + px) * 4;
      const isDark =
        Math.abs(data[idx] - fg.r) < threshold &&
        Math.abs(data[idx + 1] - fg.g) < threshold &&
        Math.abs(data[idx + 2] - fg.b) < threshold;
      if (!isDark) continue;
      const x = col * cellSize;
      const y = row * cellSize;
      rects.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fgColor}"/>`
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}">`,
    `<rect width="${svgSize}" height="${svgSize}" fill="${bgColor}"/>`,
    ...rects,
    "</svg>",
  ].join("\n");
}
