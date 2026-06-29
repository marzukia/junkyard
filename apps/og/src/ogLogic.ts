/**
 * Pure logic for OG image generation.
 * All functions here are side-effect-free and testable in isolation.
 */

export type BgType = "solid" | "gradient";
export type Layout = "centered" | "left" | "brand";
export type FontPreset = "inter" | "mono" | "serif";

export interface OgConfig {
  title: string;
  subtitle: string;
  badge: string;
  bgType: BgType;
  bgColor: string;
  bgColorEnd: string;
  gradientAngle: number;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  layout: Layout;
  font: FontPreset;
  bgImage: string | null;
  bgImageOpacity: number;
  logoImage: string | null;
  logoSize: number;
}

export const DEFAULT_CONFIG: OgConfig = {
  title: "My OG Image",
  subtitle: "A social share image created with junkyard.sh/og/",
  badge: "junkyard.sh/og/",
  bgType: "solid",
  bgColor: "#1a2530",
  bgColorEnd: "#2f9d8d",
  gradientAngle: 135,
  textColor: "#ffffff",
  badgeBg: "#2f9d8d",
  badgeText: "#ffffff",
  layout: "centered",
  font: "inter",
  bgImage: null,
  bgImageOpacity: 0.25,
  logoImage: null,
  logoSize: 80,
};

export const TEMPLATES: Record<string, Partial<OgConfig>> = {
  dark: {
    bgType: "solid",
    bgColor: "#1a2530",
    bgColorEnd: "#1a2530",
    textColor: "#ffffff",
    badgeBg: "#2f9d8d",
    badgeText: "#ffffff",
    layout: "centered",
    font: "inter",
  },
  brand: {
    bgType: "gradient",
    bgColor: "#2f9d8d",
    bgColorEnd: "#1a2530",
    gradientAngle: 135,
    textColor: "#ffffff",
    badgeBg: "#e8b04b",
    badgeText: "#1a2530",
    layout: "brand",
    font: "inter",
  },
  light: {
    bgType: "solid",
    bgColor: "#fafafa",
    bgColorEnd: "#fafafa",
    textColor: "#1a2530",
    badgeBg: "#e8eaed",
    badgeText: "#5b6671",
    layout: "centered",
    font: "inter",
  },
  coral: {
    bgType: "gradient",
    bgColor: "#d9594c",
    bgColorEnd: "#e8b04b",
    gradientAngle: 120,
    textColor: "#ffffff",
    badgeBg: "rgba(0,0,0,0.25)",
    badgeText: "#ffffff",
    layout: "left",
    font: "inter",
  },
  mono: {
    bgType: "solid",
    bgColor: "#111417",
    bgColorEnd: "#111417",
    textColor: "#e9eef1",
    badgeBg: "rgba(255,255,255,0.1)",
    badgeText: "#9aa6b0",
    layout: "left",
    font: "mono",
  },
};

/** Resolve gradient CSS string for the given config */
export function resolveBgCss(
  config: Pick<OgConfig, "bgType" | "bgColor" | "bgColorEnd" | "gradientAngle">
): string {
  if (config.bgType === "gradient") {
    return `linear-gradient(${config.gradientAngle}deg, ${config.bgColor}, ${config.bgColorEnd})`;
  }
  return config.bgColor;
}

/** Map FontPreset to a CSS font-family string */
export function resolveFontFamily(font: FontPreset): string {
  switch (font) {
    case "mono":
      return "'Roboto Mono', 'Courier New', monospace";
    case "serif":
      return "Georgia, 'Times New Roman', serif";
    default:
      return "'Roboto', system-ui, sans-serif";
  }
}

export { clamp } from "@junkyardsh/ui";

/** Parse a hex string and return an rgb tuple, or null if invalid */
export function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = Number.parseInt(clean[0] + clean[0], 16);
    const g = Number.parseInt(clean[1] + clean[1], 16);
    const b = Number.parseInt(clean[2] + clean[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

/** Return true if hex is a valid CSS hex color */
export function isValidHex(hex: string): boolean {
  return parseHex(hex) !== null;
}

/** Apply a template patch onto a base config, returning a new config */
export function applyTemplate(base: OgConfig, patch: Partial<OgConfig>): OgConfig {
  return { ...base, ...patch };
}

/** Size preset definition */
export interface SizePreset {
  label: string;
  width: number;
  height: number;
}

/** Common OG / social image size presets */
export const SIZE_PRESETS: SizePreset[] = [
  { label: "OG / Facebook", width: 1200, height: 630 },
  { label: "Twitter / X", width: 1200, height: 600 },
  { label: "LinkedIn", width: 1200, height: 627 },
  { label: "Square", width: 1200, height: 1200 },
];

/**
 * Generate the HTML meta tag snippet for OG + Twitter cards.
 * imageUrl is the hosted URL of the exported image (user must supply it).
 */
export function buildMetaSnippet(
  title: string,
  description: string,
  imageUrl: string,
  width: number,
  height: number
): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return [
    "<!-- Open Graph -->",
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${esc(imageUrl)}" />`,
    `<meta property="og:image:width" content="${width}" />`,
    `<meta property="og:image:height" content="${height}" />`,
    '<meta property="og:type" content="website" />',
    "",
    "<!-- Twitter / X -->",
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(imageUrl)}" />`,
  ].join("\n");
}

/**
 * Wrap text into lines using a canvas context for accurate measurement.
 * Exported so canvas drawing and font-shrink share a single implementation.
 */
export function wrapTextCtx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  // Character-level break: if any line is still wider than maxWidth (e.g. a long
  // URL with no spaces), split it character-by-character.
  const result: string[] = [];
  for (const line of lines) {
    if (ctx.measureText(line).width <= maxWidth) {
      result.push(line);
      continue;
    }
    let chunk = "";
    for (const char of line) {
      const next = chunk + char;
      if (ctx.measureText(next).width > maxWidth && chunk) {
        result.push(chunk);
        chunk = char;
      } else {
        chunk = next;
      }
    }
    if (chunk) result.push(chunk);
  }
  return result;
}

/**
 * Shrink a font size so the wrapped title fits within maxLines.
 * Returns the adjusted font size (never below minSize).
 */
export function shrinkFontToFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  initialSizePx: number,
  maxWidth: number,
  maxLines: number,
  minSizePx: number
): number {
  let size = initialSizePx;
  while (size > minSizePx) {
    ctx.font = `800 ${size}px ${fontFamily}`;
    if (wrapTextCtx(ctx, text, maxWidth).length <= maxLines) return size;
    size = Math.max(minSizePx, size - 2);
  }
  return size;
}

/**
 * Estimate the number of title lines that will wrap on canvas.
 * Uses an average character-width heuristic: no canvas context needed.
 * Returns the line count so callers can warn when > 2.
 */
export function estimateTitleLines(title: string, canvasWidth: number, fontSizePx: number): number {
  if (!title) return 0;
  // Average character width is ~0.58 * fontSize for bold Inter/sans-serif
  const avgCharW = fontSizePx * 0.58;
  const pad = canvasWidth * 0.072;
  const maxW = canvasWidth - pad * 2;
  const words = title.split(" ");
  let lines = 1;
  let lineW = 0;

  for (const word of words) {
    const wordW = word.length * avgCharW;
    const testW = lineW === 0 ? wordW : lineW + avgCharW + wordW;
    if (testW > maxW && lineW > 0) {
      lines++;
      lineW = wordW;
    } else {
      lineW = testW;
    }
  }
  return lines;
}
