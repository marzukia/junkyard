/**
 * Barcode SVG generation.
 *
 * The app uses JsBarcode which normally renders to an SVG DOM element.
 * JsBarcode does support a Node-safe path via a plain object renderer, but
 * it requires passing a custom renderer interface. We use this pattern here:
 * JsBarcode accepts an object with getAttribute/setAttribute/appendChild methods,
 * which we implement as a minimal SVG string builder -- no DOM required.
 *
 * This approach is documented in the JsBarcode README as the server-side path.
 *
 * Note: the validation helpers (check-digit logic, format constraints) are lifted
 * directly from apps/barcode/src/lib/barcode.ts unchanged.
 */
import JsBarcode from "jsbarcode";
import { z } from "zod";
import type { ToolDef } from "./types.js";

export type BarcodeFormat = "CODE128" | "EAN13" | "UPC" | "EAN8" | "CODE39" | "CODE93" | "ITF";

// ── Check digit helpers ──────────────────────────────────────────────────────

export function ean13CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function upcaCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function ean8CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

function validateValue(value: string, format: BarcodeFormat): string | null {
  switch (format) {
    case "EAN13":
      if (!/^\d{12,13}$/.test(value)) return "EAN-13 must be 12 or 13 digits.";
      if (value.length === 12) return null; // auto-append check digit
      if (Number(value[12]) !== ean13CheckDigit(value.slice(0, 12))) return "Invalid EAN-13 check digit.";
      return null;
    case "UPC":
      if (!/^\d{11,12}$/.test(value)) return "UPC-A must be 11 or 12 digits.";
      if (value.length === 11) return null;
      if (Number(value[11]) !== upcaCheckDigit(value.slice(0, 11))) return "Invalid UPC-A check digit.";
      return null;
    case "EAN8":
      if (!/^\d{7,8}$/.test(value)) return "EAN-8 must be 7 or 8 digits.";
      return null;
    case "CODE128":
      if (value.length === 0) return "Enter at least one character.";
      for (let i = 0; i < value.length; i++) {
        if (value.charCodeAt(i) > 127) return "Code128 supports ASCII only (0-127).";
      }
      return null;
    case "CODE39":
    case "CODE93":
      if (value.length === 0) return "Enter at least one character.";
      if (!/^[A-Z0-9 \-$.\/+%]*$/i.test(value.toUpperCase())) return `${format} supports A-Z, 0-9 and - . $ / + % space.`;
      return null;
    case "ITF":
      if (!/^\d+$/.test(value)) return "ITF must contain only digits.";
      if (value.length % 2 !== 0) return "ITF requires an even number of digits.";
      return null;
    default:
      return null;
  }
}

function normalizeValue(value: string, format: BarcodeFormat): string {
  if (format === "EAN13" && value.length === 12) return value + ean13CheckDigit(value);
  if (format === "UPC" && value.length === 11) return value + upcaCheckDigit(value);
  if (format === "EAN8" && value.length === 7) return value + ean8CheckDigit(value);
  return value;
}

// ── SVG rendering from ObjectRenderer encodings ─────────────────────────────
//
// JsBarcode detects a plain object (no .nodeName) and uses ObjectRenderer, which
// just sets target.encodings = [...]. We then build the SVG string ourselves from
// the binary encoding data + options. No DOM, no Canvas, no xmlDocument.

interface BarcodeEncoding {
  data: string;        // binary string of 0s and 1s
  text: string;        // human-readable text
  options: BarcodeRenderOptions;
  width?: number;      // set after calculateEncodingAttributes
  height?: number;
  barcodePadding?: number;
}

interface BarcodeRenderOptions {
  width: number;        // bar width in px
  height: number;       // bar height in px
  margin: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  displayValue: boolean;
  font: string;
  fontSize: number;
  fontOptions: string;
  textAlign: string;
  textPosition: string;
  textMargin: number;
  background: string;
  lineColor: string;
  [k: string]: unknown;
}

interface JsBarcodeTarget {
  encodings?: BarcodeEncoding[];
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderEncodingToSvg(encoding: BarcodeEncoding, opts: BarcodeRenderOptions, offsetX: number): string {
  const binary = encoding.data;
  const barWidth = opts.width;
  const barHeight = opts.height;
  const yFrom = opts.textPosition === "top" ? opts.fontSize + opts.textMargin : 0;
  const pad = encoding.barcodePadding ?? 0;

  const rects: string[] = [];
  let runLen = 0;
  for (let b = 0; b <= binary.length; b++) {
    const bit = binary[b];
    if (bit === "1") {
      runLen++;
    } else if (runLen > 0) {
      const x = (b - runLen) * barWidth + pad;
      rects.push(`<rect x="${x}" y="${yFrom}" width="${runLen * barWidth}" height="${barHeight}"/>`);
      runLen = 0;
    }
  }

  const textY = opts.textPosition === "top"
    ? opts.fontSize - opts.textMargin
    : barHeight + opts.textMargin + opts.fontSize;

  let textX = (encoding.width ?? binary.length * barWidth) / 2;
  let anchor = "middle";
  if (opts.textAlign === "left" || pad > 0) { textX = 0; anchor = "start"; }
  else if (opts.textAlign === "right") { textX = (encoding.width ?? binary.length * barWidth) - 1; anchor = "end"; }

  const textEl = opts.displayValue && encoding.text
    ? `<text font-family="${escapeXml(opts.font)}" font-size="${opts.fontSize}" text-anchor="${anchor}" x="${textX}" y="${textY}">${escapeXml(encoding.text)}</text>`
    : "";

  const groupContent = rects.join("") + textEl;
  return `<g transform="translate(${offsetX + opts.marginLeft}, ${opts.marginTop})" fill="${escapeXml(opts.lineColor)}">${groupContent}</g>`;
}

export function generateBarcodeSvg(value: string, format: BarcodeFormat = "CODE128"): string {
  const validationError = validateValue(value, format);
  if (validationError) throw new Error(validationError);

  const normalized = normalizeValue(value, format);

  // Use plain object -> ObjectRenderer path (no DOM needed)
  const target: JsBarcodeTarget = {};
  JsBarcode(target, normalized, {
    format,
    displayValue: true,
    margin: 10,
    width: 2,
    height: 80,
    background: "#ffffff",
    lineColor: "#000000",
  });

  const encodings = target.encodings;
  if (!encodings || encodings.length === 0) throw new Error("JsBarcode produced no encodings");

  // Calculate widths (text measurement is skipped in Node — returns 0 — so
  // barcodeWidth = data.length * barWidth is used as the authoritative width)
  let totalWidth = 0;
  let maxHeight = 0;
  for (const enc of encodings) {
    const opts = enc.options as BarcodeRenderOptions;
    const bw = enc.data.length * opts.width;
    enc.width = bw;
    enc.barcodePadding = 0;
    const encHeight = opts.height
      + (opts.displayValue && enc.text.length > 0 ? opts.fontSize + opts.textMargin : 0)
      + opts.marginTop + opts.marginBottom;
    enc.height = encHeight;
    totalWidth += bw;
    if (encHeight > maxHeight) maxHeight = encHeight;
  }

  const opts0 = encodings[0].options as BarcodeRenderOptions;
  const svgWidth = totalWidth + opts0.marginLeft + opts0.marginRight;

  const bgRect = opts0.background
    ? `<rect x="0" y="0" width="${svgWidth}" height="${maxHeight}" fill="${escapeXml(opts0.background)}"/>`
    : "";

  let offsetX = 0;
  const groups: string[] = [];
  for (const enc of encodings) {
    const opts = enc.options as BarcodeRenderOptions;
    groups.push(renderEncodingToSvg(enc, opts, offsetX));
    offsetX += enc.width ?? 0;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}px" height="${maxHeight}px" viewBox="0 0 ${svgWidth} ${maxHeight}" version="1.1">${bgRect}${groups.join("")}</svg>`;
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const barcodeTool: ToolDef = {
  slug: "barcode",
  name: "Barcode",
  ops: [
    {
      name: "generate",
      description: "Generate a barcode SVG string (CODE128, EAN13, UPC, EAN8, CODE39, CODE93, ITF)",
      inputSchema: z.object({
        text: z.string().min(1),
        type: z.enum(["CODE128", "EAN13", "UPC", "EAN8", "CODE39", "CODE93", "ITF"]).default("CODE128"),
      }),
      run({ text, type }) {
        const svg = generateBarcodeSvg(text, type as BarcodeFormat);
        return { svg };
      },
    },
  ],
};
