/**
 * Pure, side-effect-free logic for the Screenshot Beautifier.
 * All Canvas operations live in renderer.ts; this file is unit-testable without a DOM.
 */

export type BgKind = "gradient" | "solid" | "brand" | "image";

export interface GradientPreset {
  id: string;
  label: string;
  stops: [string, string]; // [from, to]
  angle: number;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: "ocean", label: "Ocean", stops: ["#1a6b5a", "#2f9d8d"], angle: 135 },
  { id: "dusk", label: "Dusk", stops: ["#d9594c", "#e8b04b"], angle: 135 },
  { id: "midnight", label: "Midnight", stops: ["#0f172a", "#1e3a5f"], angle: 135 },
  { id: "lavender", label: "Lavender", stops: ["#6c63ff", "#a78bfa"], angle: 150 },
  { id: "ember", label: "Ember", stops: ["#7c2d12", "#d9594c"], angle: 120 },
  { id: "mint", label: "Mint", stops: ["#d1fae5", "#a7f3d0"], angle: 135 },
  { id: "slate", label: "Slate", stops: ["#334155", "#64748b"], angle: 135 },
  { id: "rose", label: "Rose", stops: ["#fda4af", "#fb7185"], angle: 135 },
  // Extended library
  { id: "sunrise", label: "Sunrise", stops: ["#ff9a56", "#ffce00"], angle: 120 },
  { id: "forest", label: "Forest", stops: ["#134e4a", "#4ade80"], angle: 140 },
  { id: "denim", label: "Denim", stops: ["#1d3557", "#457b9d"], angle: 135 },
  { id: "peach", label: "Peach", stops: ["#ffb4ab", "#ffd8cc"], angle: 145 },
  { id: "plum", label: "Plum", stops: ["#3b1f5e", "#9b5de5"], angle: 130 },
  { id: "steel", label: "Steel", stops: ["#b0b8c1", "#e8eaed"], angle: 145 },
  { id: "charcoal", label: "Charcoal", stops: ["#1a1a2e", "#16213e"], angle: 135 },
  { id: "copper", label: "Copper", stops: ["#7c4a1e", "#c4804a"], angle: 125 },
];

export const BRAND_SOLIDS = [
  { id: "teal", label: "Teal", color: "#2f9d8d" },
  { id: "amber", label: "Amber", color: "#e8b04b" },
  { id: "coral", label: "Coral", color: "#d9594c" },
  { id: "ink", label: "Ink", color: "#1a2530" },
  { id: "white", label: "White", color: "#fafafa" },
];

export type WindowFrameType = "none" | "macos" | "browser";

export interface BeautifySettings {
  bgKind: BgKind;
  gradientId: string;
  solidColor: string;
  brandId: string;
  /** Object URL for a custom background image (not persisted in localStorage). */
  bgImageUrl: string | null;
  padding: number; // px relative to 2x canvas; actual applied at 2x
  cornerRadius: number; // px for the screenshot itself
  shadowSize: number; // 0 = none, 1 = soft, 2 = medium, 3 = heavy
  /** Which window chrome to draw: none, macOS traffic lights, or browser address bar. */
  windowFrameType: WindowFrameType;
  /** The URL text shown in browser chrome (display only, not navigated). */
  browserUrl: string;
  exportScale: number; // 1 | 2 | 3
  exportFormat: ExportFormat;
  sizePresetId: string;
}

export const DEFAULT_SETTINGS: BeautifySettings = {
  bgKind: "gradient",
  gradientId: "ocean",
  solidColor: "#ffffff",
  brandId: "teal",
  bgImageUrl: null,
  padding: 60,
  cornerRadius: 12,
  shadowSize: 2,
  windowFrameType: "none",
  browserUrl: "https://example.com",
  exportScale: 2,
  exportFormat: "png",
  sizePresetId: "free",
};

/** Resolve the CSS/canvas colour or gradient descriptor from settings. */
export function resolveBackground(settings: BeautifySettings): {
  type: "solid" | "gradient" | "image";
  color?: string;
  gradientStops?: [string, string];
  gradientAngle?: number;
  imageUrl?: string;
} {
  if (settings.bgKind === "image") {
    return { type: "image", imageUrl: settings.bgImageUrl ?? undefined };
  }
  if (settings.bgKind === "solid") {
    return { type: "solid", color: settings.solidColor };
  }
  if (settings.bgKind === "brand") {
    const brand = BRAND_SOLIDS.find((b) => b.id === settings.brandId);
    return { type: "solid", color: brand?.color ?? "#2f9d8d" };
  }
  // gradient
  const preset = GRADIENT_PRESETS.find((p) => p.id === settings.gradientId);
  if (!preset) return { type: "solid", color: "#1a6b5a" };
  return {
    type: "gradient",
    gradientStops: preset.stops,
    gradientAngle: preset.angle,
  };
}

/** Compute CSS box-shadow string for the given shadowSize (0-3). */
export function shadowCss(size: number): string {
  if (size === 0) return "none";
  if (size === 1) return "0 4px 16px rgba(0,0,0,0.18)";
  if (size === 2) return "0 8px 40px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)";
  return "0 20px 80px rgba(0,0,0,0.50), 0 4px 16px rgba(0,0,0,0.28)";
}

/** Height in px of each window chrome type (at 1x; scale separately). */
export const FRAME_BAR_HEIGHTS: Record<string, number> = {
  none: 0,
  macos: 36,
  browser: 44,
};

/**
 * Compute the final canvas dimensions given image dimensions and padding.
 * Padding is added symmetrically on all sides.
 */
export function canvasDimensions(
  imgW: number,
  imgH: number,
  padding: number,
  frameType: string
): { canvasW: number; canvasH: number; imgOffsetX: number; imgOffsetY: number } {
  const frameBarH = FRAME_BAR_HEIGHTS[frameType] ?? 0;
  const canvasW = imgW + padding * 2;
  const canvasH = imgH + padding * 2 + frameBarH;
  const imgOffsetX = padding;
  const imgOffsetY = padding + frameBarH;
  return { canvasW, canvasH, imgOffsetX, imgOffsetY };
}

/** Parse a CSS gradient angle (deg) to a unit vector [dx, dy] for canvas. */
export function angleToVector(deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

/** Clamp a number within [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export type ExportFormat = "png" | "jpg" | "webp";

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: "free", label: "Free", width: 0, height: 0 },
  { id: "twitter", label: "Twitter 2:1", width: 1200, height: 600 },
  { id: "og", label: "OG 1.91:1", width: 1200, height: 630 },
  { id: "dribbble", label: "Dribbble 4:3", width: 1600, height: 1200 },
  { id: "square", label: "Square", width: 1080, height: 1080 },
];

/** Derive a filename for the exported image from the source filename. */
export function exportFilename(originalName: string, format: ExportFormat = "png"): string {
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base}-beautiful.${format}`;
}

/** Map ExportFormat to a MIME type string for canvas.toDataURL / toBlob. */
export function mimeForFormat(format: ExportFormat): string {
  if (format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}
