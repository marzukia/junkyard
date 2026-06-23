/**
 * Pure meme-rendering logic. No React dependencies.
 * Canvas-based: draws image then overlays text with classic Impact + black outline.
 */

export interface TextLayer {
  id: string;
  text: string;
  /** 0..1 relative X position (center of text) */
  x: number;
  /** 0..1 relative Y position (baseline) */
  y: number;
  /** Font size in canvas pixels */
  sizePx: number;
  /** CSS color string */
  color: string;
  /** Font family key */
  font: FontKey;
}

export type FontKey = "impact" | "arial" | "comic" | "mono";

export const FONT_FAMILIES: Record<FontKey, string> = {
  impact: 'Impact, "Arial Narrow", Arial, sans-serif',
  arial: "Arial, Helvetica, sans-serif",
  comic: '"Comic Sans MS", "Comic Sans", cursive',
  mono: '"Courier New", Courier, monospace',
};

export const FONT_LABELS: Record<FontKey, string> = {
  impact: "Impact",
  arial: "Arial",
  comic: "Comic Sans",
  mono: "Mono",
};

/** Legacy flat state for the two-layer model (still used in tests + legacy store migration) */
export interface MemeState {
  topText: string;
  bottomText: string;
  topSizePx: number;
  bottomSizePx: number;
  /** Relative positions 0..1 of the text anchors */
  topPos: { x: number; y: number };
  bottomPos: { x: number; y: number };
}

export const DEFAULT_TEXT_COLOR = "#ffffff";
export const DEFAULT_FONT: FontKey = "impact";

function makeLayer(id: string, text: string, x: number, y: number, sizePx: number): TextLayer {
  return { id, text, x, y, sizePx, color: DEFAULT_TEXT_COLOR, font: DEFAULT_FONT };
}

export function makeDefaultLayers(): TextLayer[] {
  return [makeLayer("top", "", 0.5, 0.1, 52), makeLayer("bottom", "", 0.5, 0.92, 52)];
}

export const DEFAULT_MEME_STATE: MemeState = {
  topText: "",
  bottomText: "",
  topSizePx: 52,
  bottomSizePx: 52,
  topPos: { x: 0.5, y: 0.1 },
  bottomPos: { x: 0.5, y: 0.92 },
};

/** Compute the actual font size for the canvas based on desired px */
export function resolvedFontSize(sizePx: number, _canvasH: number): number {
  // sizePx is already in canvas pixels
  return Math.max(12, sizePx);
}

/** Build the CSS font string for a layer */
export function buildFont(sizePx: number, fontKey: FontKey): string {
  const weight = fontKey === "impact" ? "900" : fontKey === "comic" ? "700" : "700";
  return `${weight} ${sizePx}px ${FONT_FAMILIES[fontKey]}`;
}

/** Draw a single meme text string onto the canvas context */
export function drawMemeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fillColor = "#ffffff",
  fontKey: FontKey = "impact"
): void {
  if (!text.trim()) return;

  ctx.save();
  ctx.font = buildFont(fontSize, fontKey);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, fontSize * 0.12);
  ctx.strokeStyle = "#000000";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  // Draw outline first
  ctx.strokeText(text, x, y);
  // Then fill
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Render the full meme onto a canvas using an array of text layers. */
export function renderMemeWithLayers(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | HTMLCanvasElement,
  layers: TextLayer[]
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);

  for (const layer of layers) {
    drawMemeText(
      ctx,
      layer.text.toUpperCase(),
      layer.x * w,
      layer.y * h,
      layer.sizePx,
      layer.color,
      layer.font
    );
  }
}

/** Render the full meme onto a canvas (legacy two-layer API, kept for compat). */
export function renderMeme(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | HTMLCanvasElement,
  state: MemeState
): void {
  const layers: TextLayer[] = [
    makeLayer("top", state.topText, state.topPos.x, state.topPos.y, state.topSizePx),
    makeLayer("bottom", state.bottomText, state.bottomPos.x, state.bottomPos.y, state.bottomSizePx),
  ];
  renderMemeWithLayers(canvas, image, layers);
}

/** Export the canvas as a PNG Blob */
export function exportPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export PNG"));
      },
      "image/png",
      1.0
    );
  });
}

/** Copy the canvas image to the system clipboard as a PNG. */
export async function copyImageToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const blob = await exportPng(canvas);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/** Hit-test against text layers: returns the layer id that was hit, or null */
export function hitTestLayers(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  layers: TextLayer[]
): string | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (clientX - rect.left) * scaleX;
  const cy = (clientY - rect.top) * scaleY;

  const w = canvas.width;
  const h = canvas.height;

  function dist(ax: number, ay: number, bx: number, by: number) {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  // Iterate in reverse so topmost (last rendered) layer gets priority
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.text.trim()) continue;
    const lx = layer.x * w;
    const ly = layer.y * h;
    const hitR = Math.max(layer.sizePx, 40);
    if (dist(cx, cy, lx, ly) < hitR) return layer.id;
  }
  return null;
}

/** Hit-test: returns 'top' | 'bottom' | null for which text was clicked (legacy) */
export function hitTestText(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  state: MemeState
): "top" | "bottom" | null {
  const layers: TextLayer[] = [
    makeLayer("top", state.topText, state.topPos.x, state.topPos.y, state.topSizePx),
    makeLayer("bottom", state.bottomText, state.bottomPos.x, state.bottomPos.y, state.bottomSizePx),
  ];
  const hit = hitTestLayers(canvas, clientX, clientY, layers);
  if (hit === "top") return "top";
  if (hit === "bottom") return "bottom";
  return null;
}

// ─── Built-in blank templates ─────────────────────────────────────────────────

export interface MemeTemplate {
  id: string;
  label: string;
  /** Width / height ratio */
  aspectRatio: number;
  /** Background color for the blank template */
  bg: string;
  /** Accent stripe color */
  accent: string;
  /** Optional pre-filled text layers */
  defaultLayers?: Array<Pick<TextLayer, "text" | "x" | "y" | "sizePx">>;
}

export const TEMPLATES: MemeTemplate[] = [
  { id: "classic", label: "Classic", aspectRatio: 1, bg: "#f5f5f5", accent: "#2f9d8d" },
  { id: "wide", label: "Wide", aspectRatio: 16 / 9, bg: "#f0f0f0", accent: "#e8b04b" },
  { id: "tall", label: "Tall", aspectRatio: 9 / 16, bg: "#ececec", accent: "#d9594c" },
  { id: "dark", label: "Dark", aspectRatio: 1, bg: "#1a1a1a", accent: "#41b6a6" },
  { id: "wide-dark", label: "Wide Dark", aspectRatio: 16 / 9, bg: "#111", accent: "#e8b04b" },
  { id: "retro", label: "Retro", aspectRatio: 4 / 3, bg: "#fff8e1", accent: "#d9594c" },
  {
    id: "top-only",
    label: "Caption Top",
    aspectRatio: 1,
    bg: "#e8e8e8",
    accent: "#6c63ff",
    defaultLayers: [{ text: "", x: 0.5, y: 0.08, sizePx: 52 }],
  },
  {
    id: "bottom-only",
    label: "Caption Bot",
    aspectRatio: 1,
    bg: "#e8e8e8",
    accent: "#ff6c6c",
    defaultLayers: [{ text: "", x: 0.5, y: 0.92, sizePx: 52 }],
  },
  {
    id: "three-panel",
    label: "3-Panel",
    aspectRatio: 3 / 1,
    bg: "#f5f5f5",
    accent: "#2f9d8d",
    defaultLayers: [
      { text: "", x: 0.17, y: 0.5, sizePx: 32 },
      { text: "", x: 0.5, y: 0.5, sizePx: 32 },
      { text: "", x: 0.83, y: 0.5, sizePx: 32 },
    ],
  },
];

/** Build default layers for a template */
export function templateDefaultLayers(template: MemeTemplate): TextLayer[] {
  if (template.defaultLayers) {
    return template.defaultLayers.map((dl, i) =>
      makeLayer(`layer-${i}`, dl.text, dl.x, dl.y, dl.sizePx)
    );
  }
  return makeDefaultLayers();
}

/** Draw a blank template onto a canvas element and return it */
export function drawBlankTemplate(template: MemeTemplate, width = 600): HTMLCanvasElement {
  const height = Math.round(width / template.aspectRatio);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  ctx.fillStyle = template.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle diagonal stripe pattern
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = template.accent;
  ctx.lineWidth = 20;
  for (let i = -height; i < width + height; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }
  ctx.restore();

  // Center glyph
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.14;

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = template.accent;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx - r * 0.6, cy - r * 0.3, r * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.1, cy + r * 0.5);
  ctx.lineTo(cx - r * 0.5, cy - r * 0.2);
  ctx.lineTo(cx, cy + r * 0.1);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.3);
  ctx.lineTo(cx + r * 1.1, cy + r * 0.5);
  ctx.stroke();
  ctx.restore();

  return c;
}

// ─── Layer mutation helpers ───────────────────────────────────────────────────

/** Produce a new layers array with one layer updated */
export function updateLayer(
  layers: TextLayer[],
  id: string,
  patch: Partial<TextLayer>
): TextLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
}

/** Produce a new layers array with a new empty layer appended */
export function addLayer(layers: TextLayer[]): TextLayer[] {
  const id = `layer-${Date.now()}`;
  const layer = makeLayer(id, "", 0.5, 0.5, 52);
  return [...layers, layer];
}

/** Produce a new layers array with the given layer removed */
export function removeLayer(layers: TextLayer[], id: string): TextLayer[] {
  return layers.filter((l) => l.id !== id);
}

/** Clamp a value between 0 and 1 */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
