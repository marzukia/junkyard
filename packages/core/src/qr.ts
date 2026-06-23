/**
 * QR code generation returning an SVG string.
 *
 * The app has two render paths: Canvas (renderQRToCanvas) and SVG (generateSvgString).
 * Only the SVG path is pure and headless-safe. The Canvas path depends on
 * HTMLCanvasElement and CanvasRenderingContext2D -- those are NOT extracted here.
 *
 * generateSvgString uses QRCode.create() from the `qrcode` npm package (synchronous,
 * returns a module matrix with no browser globals) plus pure SVG string construction.
 */
import QRCode from "qrcode";
import { z } from "zod";
import type { ToolDef } from "./types.js";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QrOptions {
  text: string;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  fgColor?: string;
  bgColor?: string;
}

function svgFinderEye(
  px: number,
  py: number,
  cellSize: number,
  fgColor: string,
  bgColor: string,
): string[] {
  const f = (n: number) => n.toFixed(3);
  const outerSize = 7 * cellSize;
  const innerOffset = 2 * cellSize;
  const innerSize = 3 * cellSize;
  return [
    `<rect x="${f(px)}" y="${f(py)}" width="${f(outerSize)}" height="${f(outerSize)}" fill="${fgColor}"/>`,
    `<rect x="${f(px + cellSize)}" y="${f(py + cellSize)}" width="${f(5 * cellSize)}" height="${f(5 * cellSize)}" fill="${bgColor}"/>`,
    `<rect x="${f(px + innerOffset)}" y="${f(py + innerOffset)}" width="${f(innerSize)}" height="${f(innerSize)}" fill="${fgColor}"/>`,
  ];
}

export function generateSvgString(opts: QrOptions): string {
  const { text, errorCorrectionLevel = "M", fgColor = "#000000", bgColor = "#ffffff" } = opts;

  // QRCode.create is synchronous -- no canvas, no DOM
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const qrModules = qr.modules.size;

  const svgSize = 512;
  const margin = 2;
  const totalCells = qrModules + 2 * margin;
  const cellSize = svgSize / totalCells;

  // Finder pattern origins in grid (includes quiet zone)
  const finderSize = 7;
  const tlRow = margin; const tlCol = margin;
  const trRow = margin; const trCol = margin + qrModules - finderSize;
  const blRow = margin + qrModules - finderSize; const blCol = margin;

  function isFinderModule(gridRow: number, gridCol: number): boolean {
    const inTL = gridRow >= tlRow && gridRow < tlRow + finderSize && gridCol >= tlCol && gridCol < tlCol + finderSize;
    const inTR = gridRow >= trRow && gridRow < trRow + finderSize && gridCol >= trCol && gridCol < trCol + finderSize;
    const inBL = gridRow >= blRow && gridRow < blRow + finderSize && gridCol >= blCol && gridCol < blCol + finderSize;
    return inTL || inTR || inBL;
  }

  const elements: string[] = [];

  for (let row = 0; row < qrModules; row++) {
    for (let col = 0; col < qrModules; col++) {
      if (!qr.modules.get(row, col)) continue;
      const gridRow = row + margin;
      const gridCol = col + margin;
      if (isFinderModule(gridRow, gridCol)) continue;
      const x = gridCol * cellSize;
      const y = gridRow * cellSize;
      elements.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fgColor}"/>`);
    }
  }

  const finderOrigins = [
    { row: tlRow, col: tlCol },
    { row: trRow, col: trCol },
    { row: blRow, col: blCol },
  ];
  for (const origin of finderOrigins) {
    for (const el of svgFinderEye(origin.col * cellSize, origin.row * cellSize, cellSize, fgColor, bgColor)) {
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

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const qrTool: ToolDef = {
  slug: "qr",
  name: "QR Code",
  ops: [
    {
      name: "generate",
      description: "Generate a QR code SVG string for the given text",
      inputSchema: z.object({
        text: z.string().min(1),
        errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).default("M"),
        fgColor: z.string().default("#000000"),
        bgColor: z.string().default("#ffffff"),
      }),
      run({ text, errorCorrectionLevel, fgColor, bgColor }) {
        const svg = generateSvgString({ text, errorCorrectionLevel: errorCorrectionLevel as ErrorCorrectionLevel, fgColor, bgColor });
        return { svg };
      },
    },
  ],
};
