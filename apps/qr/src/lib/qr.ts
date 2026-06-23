import QRCode, { type BitMatrix } from "qrcode";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type DotStyle = "square" | "rounded" | "dots" | "classy";
export type EyeStyle = "square" | "rounded" | "circle" | "leaf";

export interface QROptions {
  text: string;
  fgColor: string;
  bgColor: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dotStyle: DotStyle;
  eyeStyle?: EyeStyle;
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

/** Describes the grid-coordinate origins of the three finder pattern regions. */
export interface FinderRegions {
  finderSize: number;
  tlRow: number;
  tlCol: number;
  trRow: number;
  trCol: number;
  blRow: number;
  blCol: number;
}

/**
 * Computes the three 7x7 finder pattern origins in grid coordinates.
 * Shared by both the canvas and SVG render paths so the detection logic
 * cannot drift between them.
 *
 * @param margin   The quiet-zone width in modules (typically 2).
 * @param qrModules The number of QR data modules (excludes quiet zone).
 */
export function computeFinderRegions(margin: number, qrModules: number): FinderRegions {
  const finderSize = 7;
  return {
    finderSize,
    tlRow: margin,
    tlCol: margin,
    trRow: margin,
    trCol: margin + qrModules - finderSize,
    blRow: margin + qrModules - finderSize,
    blCol: margin,
  };
}

/**
 * Returns true if the given grid (row, col) falls inside any of the three
 * 7x7 finder pattern blocks.
 */
export function isFinderModule(row: number, col: number, regions: FinderRegions): boolean {
  const { finderSize, tlRow, tlCol, trRow, trCol, blRow, blCol } = regions;
  const inTL = row >= tlRow && row < tlRow + finderSize && col >= tlCol && col < tlCol + finderSize;
  const inTR = row >= trRow && row < trRow + finderSize && col >= trCol && col < trCol + finderSize;
  const inBL = row >= blRow && row < blRow + finderSize && col >= blCol && col < blCol + finderSize;
  return inTL || inTR || inBL;
}

/**
 * Generates a QR code onto a canvas element, applying dot-style post-processing
 * and an optional logo overlay.
 *
 * Uses QRCode.create() to obtain the raw module matrix so that finder-pattern
 * detection is exact and not susceptible to the quiet-zone row-0 pixel-scan bug
 * that caused applyDotStyle to silently return early (row 0 is always white when
 * margin > 0, so the old firstDark scan found nothing and styling never applied).
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
    eyeStyle = "square",
    logoDataUrl,
    logoSizeRatio = 0.22,
  } = opts;

  const margin = 2; // quiet-zone width in modules, matching QRCode.toCanvas default

  // 1. Get the module matrix synchronously from QRCode.create().
  //    This is the same source the SVG path uses -- no pixel scanning.
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const qrModules = qr.modules.size;

  // 2. Render into the canvas using matrix-driven drawing (no toCanvas needed).
  applyDotStyle(canvas, qr.modules, qrModules, margin, fgColor, bgColor, dotStyle, eyeStyle);

  // 3. Overlay logo if provided
  if (logoDataUrl) {
    await overlayLogo(canvas, logoDataUrl, logoSizeRatio, bgColor);
  }

  return canvas;
}

/**
 * Renders the QR module matrix directly onto the canvas with the requested dot
 * and eye styles.
 *
 * Replaces the old pixel-scan approach (which scanned row 0 for dark pixels --
 * always white inside the quiet zone -- and therefore silently returned early,
 * leaving every style setting inert on canvas). This function receives the module
 * matrix from QRCode.create() so there is no pixel heuristic at all.
 *
 * @param modules   The raw QRCode module matrix (qr.modules from QRCode.create()).
 * @param qrModules Number of data modules (qr.modules.size, excludes quiet zone).
 * @param margin    Quiet-zone width in modules (matches QRCode.toCanvas default of 2).
 */
function applyDotStyle(
  canvas: HTMLCanvasElement,
  modules: BitMatrix,
  qrModules: number,
  margin: number,
  fgColor: string,
  bgColor: string,
  style: DotStyle,
  eyeStyle: EyeStyle
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.width;
  const totalCells = qrModules + 2 * margin;
  const moduleSize = size / totalCells;
  const pad = moduleSize * 0.12;
  const dotR = moduleSize / 2 - pad;

  const regions = computeFinderRegions(margin, qrModules);
  const { tlRow, tlCol, trRow, trCol, blRow, blCol } = regions;

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fgColor;

  // Draw data modules (QR matrix row/col, offset into canvas by margin)
  for (let row = 0; row < qrModules; row++) {
    for (let col = 0; col < qrModules; col++) {
      if (!modules.get(row, col)) continue;

      const gridRow = row + margin;
      const gridCol = col + margin;

      // Finder modules drawn as composed shapes below
      if (isFinderModule(gridRow, gridCol, regions)) continue;

      const cx = gridCol * moduleSize + moduleSize / 2;
      const cy = gridRow * moduleSize + moduleSize / 2;

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
        // Classy: isolated modules become circles; connected modules stay square
        const allNeighboursDark =
          row > 0 &&
          modules.get(row - 1, col) &&
          row < qrModules - 1 &&
          modules.get(row + 1, col) &&
          col > 0 &&
          modules.get(row, col - 1) &&
          col < qrModules - 1 &&
          modules.get(row, col + 1);
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
      } else {
        // square: plain rect
        const x = cx - moduleSize / 2 + pad;
        const y = cy - moduleSize / 2 + pad;
        const w = moduleSize - pad * 2;
        ctx.fillRect(x, y, w, w);
      }
    }
  }

  // Draw all three finder eyes as composed shapes (always, not just non-square,
  // because the per-module path above skips all finder cells unconditionally).
  const finderOrigins = [
    { row: tlRow, col: tlCol },
    { row: trRow, col: trCol },
    { row: blRow, col: blCol },
  ];
  for (const origin of finderOrigins) {
    drawFinderEye(ctx, origin.row, origin.col, moduleSize, fgColor, bgColor, eyeStyle);
  }
}

/**
 * Draws a single 7x7 finder pattern eye at the given grid origin (row, col)
 * using the specified eye style.
 *
 * A finder pattern is:
 *   - Outer 7x7 dark ring (1 module thick border)
 *   - 1-module-wide light separator (implicit - bgColor fill inside outer ring)
 *   - Inner 3x3 dark square
 */
function drawFinderEye(
  ctx: CanvasRenderingContext2D,
  originRow: number,
  originCol: number,
  moduleSize: number,
  fgColor: string,
  bgColor: string,
  eyeStyle: EyeStyle
): void {
  const x = originCol * moduleSize;
  const y = originRow * moduleSize;
  const outerSize = 7 * moduleSize;
  const innerOffset = 2 * moduleSize; // separator is 1 module, inner starts at offset 2
  const innerSize = 3 * moduleSize;

  ctx.fillStyle = fgColor;

  if (eyeStyle === "rounded") {
    const outerR = moduleSize * 1.5;
    const innerR = moduleSize * 0.6;

    // Outer ring: draw filled rounded rect then punch hole with bg
    ctx.beginPath();
    ctx.roundRect(x, y, outerSize, outerSize, outerR);
    ctx.fill();

    // Punch inner area (light separator + inner square area) with bgColor
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize, outerR * 0.5);
    ctx.fill();

    // Draw inner 3x3 filled square
    ctx.fillStyle = fgColor;
    ctx.beginPath();
    ctx.roundRect(x + innerOffset, y + innerOffset, innerSize, innerSize, innerR);
    ctx.fill();
  } else if (eyeStyle === "circle") {
    const outerCx = x + outerSize / 2;
    const outerCy = y + outerSize / 2;
    const outerR = outerSize / 2;
    const gapR = outerSize / 2 - moduleSize;
    const innerR = innerSize / 2;

    // Outer ring as annulus: filled circle then bg circle to punch hole
    ctx.beginPath();
    ctx.arc(outerCx, outerCy, outerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(outerCx, outerCy, gapR, 0, Math.PI * 2);
    ctx.fill();

    // Inner dot as circle
    ctx.fillStyle = fgColor;
    ctx.beginPath();
    ctx.arc(outerCx, outerCy, innerR, 0, Math.PI * 2);
    ctx.fill();
  } else if (eyeStyle === "leaf") {
    // Leaf: outer ring has rounded corners only on the outer-top-left corner;
    // inner square similarly has a single rounded corner (opposing corner).
    // The resulting shape looks like a leaf/teardrop per finder eye.
    const leafR = moduleSize * 2;

    ctx.beginPath();
    ctx.roundRect(x, y, outerSize, outerSize, [leafR, 0, leafR, 0]);
    ctx.fill();

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize, [
      leafR * 0.5,
      0,
      leafR * 0.5,
      0,
    ]);
    ctx.fill();

    ctx.fillStyle = fgColor;
    ctx.beginPath();
    ctx.roundRect(x + innerOffset, y + innerOffset, innerSize, innerSize, [
      leafR * 0.25,
      0,
      leafR * 0.25,
      0,
    ]);
    ctx.fill();
  } else {
    // square (default): outer filled rect, bg punch for separator, inner filled rect
    ctx.fillRect(x, y, outerSize, outerSize);
    ctx.fillStyle = bgColor;
    ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);
    ctx.fillStyle = fgColor;
    ctx.fillRect(x + innerOffset, y + innerOffset, innerSize, innerSize);
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
 * Emits SVG elements for a single finder eye at pixel coordinates (px, py),
 * matching the geometry of drawFinderEye on the canvas path.
 *
 * Returns an array of SVG element strings (no newlines between them).
 * Exported for unit testing; not part of the public API surface.
 */
export function svgFinderEye(
  px: number,
  py: number,
  cellSize: number,
  fgColor: string,
  bgColor: string,
  eyeStyle: EyeStyle
): string[] {
  const outerSize = 7 * cellSize;
  const innerOffset = 2 * cellSize;
  const innerSize = 3 * cellSize;
  const f = (n: number) => n.toFixed(3);

  if (eyeStyle === "rounded") {
    const outerR = cellSize * 1.5;
    const punchR = outerR * 0.5;
    const innerR = cellSize * 0.6;
    return [
      `<rect x="${f(px)}" y="${f(py)}" width="${f(outerSize)}" height="${f(outerSize)}" rx="${f(outerR)}" fill="${fgColor}"/>`,
      `<rect x="${f(px + cellSize)}" y="${f(py + cellSize)}" width="${f(5 * cellSize)}" height="${f(5 * cellSize)}" rx="${f(punchR)}" fill="${bgColor}"/>`,
      `<rect x="${f(px + innerOffset)}" y="${f(py + innerOffset)}" width="${f(innerSize)}" height="${f(innerSize)}" rx="${f(innerR)}" fill="${fgColor}"/>`,
    ];
  }

  if (eyeStyle === "circle") {
    const cx = px + outerSize / 2;
    const cy = py + outerSize / 2;
    const outerR = outerSize / 2;
    const gapR = outerSize / 2 - cellSize;
    const innerR = innerSize / 2;
    return [
      `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(outerR)}" fill="${fgColor}"/>`,
      `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(gapR)}" fill="${bgColor}"/>`,
      `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(innerR)}" fill="${fgColor}"/>`,
    ];
  }

  if (eyeStyle === "leaf") {
    // SVG <rect> only supports a single rx/ry, not per-corner radii.
    // Use <path> with arc segments to replicate the canvas roundRect([r,0,r,0]) pattern:
    // top-left and bottom-right corners are rounded; top-right and bottom-left are sharp.
    const leafR = cellSize * 2;
    const punchR = leafR * 0.5;
    const innerR = leafR * 0.25;

    function leafRect(x: number, y: number, w: number, h: number, r: number): string {
      // Clamp radius to half the shorter side
      const rr = Math.min(r, w / 2, h / 2);
      // Path: start at top-left corner after arc, go clockwise.
      // top-left = rounded (rr), top-right = sharp, bottom-right = rounded (rr), bottom-left = sharp
      return (
        `M ${f(x + rr)} ${f(y)} ` +
        `L ${f(x + w)} ${f(y)} ` +
        `L ${f(x + w)} ${f(y + h)} ` +
        `L ${f(x)} ${f(y + h)} ` +
        `L ${f(x)} ${f(y + rr)} ` +
        `A ${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)} Z`
      );
    }

    return [
      `<path d="${leafRect(px, py, outerSize, outerSize, leafR)}" fill="${fgColor}"/>`,
      `<path d="${leafRect(px + cellSize, py + cellSize, 5 * cellSize, 5 * cellSize, punchR)}" fill="${bgColor}"/>`,
      `<path d="${leafRect(px + innerOffset, py + innerOffset, innerSize, innerSize, innerR)}" fill="${fgColor}"/>`,
    ];
  }

  // square (default): outer filled rect + bg punch + inner filled rect
  return [
    `<rect x="${f(px)}" y="${f(py)}" width="${f(outerSize)}" height="${f(outerSize)}" fill="${fgColor}"/>`,
    `<rect x="${f(px + cellSize)}" y="${f(py + cellSize)}" width="${f(5 * cellSize)}" height="${f(5 * cellSize)}" fill="${bgColor}"/>`,
    `<rect x="${f(px + innerOffset)}" y="${f(py + innerOffset)}" width="${f(innerSize)}" height="${f(innerSize)}" fill="${fgColor}"/>`,
  ];
}

/**
 * Generates an SVG string for the QR code. Uses QRCode.create() to get the raw
 * module matrix directly (no canvas/pixel scanning), then renders the data modules
 * as square rects and the three finder eyes using the selected eyeStyle.
 *
 * The previous canvas-pixel approach was replaced because scanning row 0 (which is
 * always inside the quiet zone) caused module-size detection to fail for all typical
 * QR codes, resulting in 1x1-pixel rects regardless of eye style. QRCode.create()
 * is synchronous and gives the exact module grid without any pixel heuristics.
 */
export function generateSvgString(opts: QROptions): string {
  const { text, fgColor, bgColor, errorCorrectionLevel, eyeStyle = "square" } = opts;

  // QRCode.create is synchronous and returns the module matrix directly.
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const qrModules = qr.modules.size; // number of QR data modules (no quiet zone)

  // Render into a 512x512 viewBox with 2-module quiet zone on each side.
  const svgSize = 512;
  const margin = 2; // quiet zone in modules
  const totalCells = qrModules + 2 * margin;
  const cellSize = svgSize / totalCells;

  // Finder region origins in the grid that includes the quiet zone margin.
  // In grid coordinates: module (row, col) lives at grid cell (row+margin, col+margin).
  const regions = computeFinderRegions(margin, qrModules);
  const { tlRow, tlCol, trRow, trCol, blRow, blCol } = regions;

  const elements: string[] = [];

  // Data modules: skip finder regions (drawn as composed eye shapes below).
  for (let row = 0; row < qrModules; row++) {
    for (let col = 0; col < qrModules; col++) {
      if (!qr.modules.get(row, col)) continue;

      const gridRow = row + margin;
      const gridCol = col + margin;

      // Finder modules are replaced by composed eye shapes below
      if (isFinderModule(gridRow, gridCol, regions)) continue;

      const x = gridCol * cellSize;
      const y = gridRow * cellSize;
      elements.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fgColor}"/>`
      );
    }
  }

  // Finder eyes: one composed shape per corner
  const finderOrigins = [
    { row: tlRow, col: tlCol },
    { row: trRow, col: trCol },
    { row: blRow, col: blCol },
  ];
  for (const origin of finderOrigins) {
    const px = origin.col * cellSize;
    const py = origin.row * cellSize;
    for (const el of svgFinderEye(px, py, cellSize, fgColor, bgColor, eyeStyle)) {
      elements.push(el);
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}">`,
    `<rect width="${svgSize}" height="${svgSize}" fill="${bgColor}"/>`,
    ...elements,
    "</svg>",
  ].join("\n");
}
