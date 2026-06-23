/**
 * Colour operations using culori (Node-safe, no browser globals).
 * Also includes pure hex/rgb/hsl conversion and WCAG contrast.
 */
import { clampChroma, formatHex, interpolate, wcagContrast, wcagLuminance, parse } from "culori";
import { z } from "zod";
import type { ToolDef } from "./types.js";

export function normalizeHex(raw: string): string | null {
  const stripped = raw.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(stripped)) return `#${stripped.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(stripped)) {
    const expanded = stripped.split("").map((c) => c + c).join("");
    return `#${expanded.toLowerCase()}`;
  }
  return null;
}

export interface RgbColor { r: number; g: number; b: number; }
export interface HslColor { h: number; s: number; l: number; }

export function hexToRgb(hex: string): RgbColor | null {
  const clean = normalizeHex(hex);
  if (!clean) return null;
  const n = Number.parseInt(clean.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToHsl(hex: string): HslColor | null {
  const c = parse(hex);
  if (!c) return null;
  const hsl = parse(`hsl(0 0% 0%)`);
  void hsl; // culori handles via formatHex round-trip
  // Use culori to get HSL components
  const formatted = formatHex(c);
  if (!formatted) return null;
  const rgb = hexToRgb(formatted);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function contrastRatio(color1: string, color2: string): { ratio: number; wcagAA: boolean; wcagAAA: boolean } {
  if (!parse(color1)) throw new Error(`Invalid color: ${color1}`);
  if (!parse(color2)) throw new Error(`Invalid color: ${color2}`);
  const ratio = wcagContrast(color1, color2);
  return {
    ratio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7,
  };
}

export function generateGradient(start: string, end: string, steps: number, space: "lab" | "rgb" | "hsl" = "lab"): string[] {
  const fn = interpolate([start, end], space);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const color = fn(t);
    const clamped = space === "lab" ? clampChroma(color, "lab") : color;
    return formatHex(clamped) ?? "#000000";
  });
}

export type ConvertTarget = "hex" | "rgb" | "hsl";

export function convertColor(input: string, to: ConvertTarget): string {
  // Accept any culori-parseable format (hex, rgb(), hsl(), named colours, etc.)
  const parsed = parse(input);
  if (!parsed) throw new Error(`Invalid color: ${input}`);
  const hex = formatHex(parsed);
  if (!hex) throw new Error(`Invalid color: ${input}`);
  if (to === "hex") return hex;
  if (to === "rgb") {
    const rgb = hexToRgb(hex);
    if (!rgb) throw new Error("Color parse failed");
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }
  if (to === "hsl") {
    const hsl = hexToHsl(hex);
    if (!hsl) throw new Error("Color parse failed");
    return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  }
  throw new Error(`Unknown target: ${to}`);
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const coloursTool: ToolDef = {
  slug: "colours",
  name: "Colours",
  ops: [
    {
      name: "convert",
      description: "Convert a color (hex, rgb(), hsl(), or CSS named color) to hex, rgb() or hsl()",
      inputSchema: z.object({
        color: z.string(),
        to: z.enum(["hex", "rgb", "hsl"]).default("rgb"),
      }),
      run({ color, to }) {
        return { result: convertColor(color, to as ConvertTarget) };
      },
    },
    {
      name: "contrast",
      description: "Compute WCAG contrast ratio between two colors",
      inputSchema: z.object({
        a: z.string(),
        b: z.string(),
      }),
      run({ a, b }) {
        return contrastRatio(a, b);
      },
    },
  ],
};
