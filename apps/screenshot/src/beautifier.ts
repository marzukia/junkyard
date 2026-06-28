1|/**
import { clamp } from "@junkyardsh/ui";
2| * Pure, side-effect-free logic for the Screenshot Beautifier.
3| * All Canvas operations live in renderer.ts; this file is unit-testable without a DOM.
4| */
5|
6|export type BgKind = "gradient" | "solid" | "brand" | "image";
7|
8|export interface GradientPreset {
9|  id: string;
10|  label: string;
11|  stops: [string, string]; // [from, to]
12|  angle: number;
13|}
14|
15|export const GRADIENT_PRESETS: GradientPreset[] = [
16|  { id: "ocean", label: "Ocean", stops: ["#1a6b5a", "#2f9d8d"], angle: 135 },
17|  { id: "dusk", label: "Dusk", stops: ["#d9594c", "#e8b04b"], angle: 135 },
18|  { id: "midnight", label: "Midnight", stops: ["#0f172a", "#1e3a5f"], angle: 135 },
19|  { id: "lavender", label: "Lavender", stops: ["#6c63ff", "#a78bfa"], angle: 150 },
20|  { id: "ember", label: "Ember", stops: ["#7c2d12", "#d9594c"], angle: 120 },
21|  { id: "mint", label: "Mint", stops: ["#d1fae5", "#a7f3d0"], angle: 135 },
22|  { id: "slate", label: "Slate", stops: ["#334155", "#64748b"], angle: 135 },
23|  { id: "rose", label: "Rose", stops: ["#fda4af", "#fb7185"], angle: 135 },
24|  // Extended library
25|  { id: "sunrise", label: "Sunrise", stops: ["#ff9a56", "#ffce00"], angle: 120 },
26|  { id: "forest", label: "Forest", stops: ["#134e4a", "#4ade80"], angle: 140 },
27|  { id: "denim", label: "Denim", stops: ["#1d3557", "#457b9d"], angle: 135 },
28|  { id: "peach", label: "Peach", stops: ["#ffb4ab", "#ffd8cc"], angle: 145 },
29|  { id: "plum", label: "Plum", stops: ["#3b1f5e", "#9b5de5"], angle: 130 },
30|  { id: "steel", label: "Steel", stops: ["#b0b8c1", "#e8eaed"], angle: 145 },
31|  { id: "charcoal", label: "Charcoal", stops: ["#1a1a2e", "#16213e"], angle: 135 },
32|  { id: "copper", label: "Copper", stops: ["#7c4a1e", "#c4804a"], angle: 125 },
33|];
34|
35|export const BRAND_SOLIDS = [
36|  { id: "teal", label: "Teal", color: "#2f9d8d" },
37|  { id: "amber", label: "Amber", color: "#e8b04b" },
38|  { id: "coral", label: "Coral", color: "#d9594c" },
39|  { id: "ink", label: "Ink", color: "#1a2530" },
40|  { id: "white", label: "White", color: "#fafafa" },
41|];
42|
43|export type WindowFrameType = "none" | "macos" | "browser";
44|
45|export interface BeautifySettings {
46|  bgKind: BgKind;
47|  gradientId: string;
48|  solidColor: string;
49|  brandId: string;
50|  /** Object URL for a custom background image (not persisted in localStorage). */
51|  bgImageUrl: string | null;
52|  padding: number; // px relative to 2x canvas; actual applied at 2x
53|  cornerRadius: number; // px for the screenshot itself
54|  shadowSize: number; // 0 = none, 1 = soft, 2 = medium, 3 = heavy
55|  /** Which window chrome to draw: none, macOS traffic lights, or browser address bar. */
56|  windowFrameType: WindowFrameType;
57|  /** The URL text shown in browser chrome (display only, not navigated). */
58|  browserUrl: string;
59|  exportScale: number; // 1 | 2 | 3
60|  exportFormat: ExportFormat;
61|  sizePresetId: string;
62|}
63|
64|export const DEFAULT_SETTINGS: BeautifySettings = {
65|  bgKind: "gradient",
66|  gradientId: "ocean",
67|  solidColor: "#ffffff",
68|  brandId: "teal",
69|  bgImageUrl: null,
70|  padding: 60,
71|  cornerRadius: 12,
72|  shadowSize: 2,
73|  windowFrameType: "none",
74|  browserUrl: "https://example.com",
75|  exportScale: 2,
76|  exportFormat: "png",
77|  sizePresetId: "free",
78|};
79|
80|/** Resolve the CSS/canvas colour or gradient descriptor from settings. */
81|export function resolveBackground(settings: BeautifySettings): {
82|  type: "solid" | "gradient" | "image";
83|  color?: string;
84|  gradientStops?: [string, string];
85|  gradientAngle?: number;
86|  imageUrl?: string;
87|} {
88|  if (settings.bgKind === "image") {
89|    return { type: "image", imageUrl: settings.bgImageUrl ?? undefined };
90|  }
91|  if (settings.bgKind === "solid") {
92|    return { type: "solid", color: settings.solidColor };
93|  }
94|  if (settings.bgKind === "brand") {
95|    const brand = BRAND_SOLIDS.find((b) => b.id === settings.brandId);
96|    return { type: "solid", color: brand?.color ?? "#2f9d8d" };
97|  }
98|  // gradient
99|  const preset = GRADIENT_PRESETS.find((p) => p.id === settings.gradientId);
100|  if (!preset) return { type: "solid", color: "#1a6b5a" };
101|  return {
102|    type: "gradient",
103|    gradientStops: preset.stops,
104|    gradientAngle: preset.angle,
105|  };
106|}
107|
108|/** Compute CSS box-shadow string for the given shadowSize (0-3). */
109|export function shadowCss(size: number): string {
110|  if (size === 0) return "none";
111|  if (size === 1) return "0 4px 16px rgba(0,0,0,0.18)";
112|  if (size === 2) return "0 8px 40px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)";
113|  return "0 20px 80px rgba(0,0,0,0.50), 0 4px 16px rgba(0,0,0,0.28)";
114|}
115|
116|/** Height in px of each window chrome type (at 1x; scale separately). */
117|export const FRAME_BAR_HEIGHTS: Record<string, number> = {
118|  none: 0,
119|  macos: 36,
120|  browser: 44,
121|};
122|
123|/**
124| * Compute the final canvas dimensions given image dimensions and padding.
125| * Padding is added symmetrically on all sides.
126| */
127|export function canvasDimensions(
128|  imgW: number,
129|  imgH: number,
130|  padding: number,
131|  frameType: string
132|): { canvasW: number; canvasH: number; imgOffsetX: number; imgOffsetY: number } {
133|  const frameBarH = FRAME_BAR_HEIGHTS[frameType] ?? 0;
134|  const canvasW = imgW + padding * 2;
135|  const canvasH = imgH + padding * 2 + frameBarH;
136|  const imgOffsetX = padding;
137|  const imgOffsetY = padding + frameBarH;
138|  return { canvasW, canvasH, imgOffsetX, imgOffsetY };
139|}
140|
141|/** Parse a CSS gradient angle (deg) to a unit vector [dx, dy] for canvas. */
142|export function angleToVector(deg: number): [number, number] {
143|  const rad = ((deg - 90) * Math.PI) / 180;
144|  return [Math.cos(rad), Math.sin(rad)];
145|}
146|
147|/** Clamp a number within [min, max]. */
148|export function clamp(v: number, min: number, max: number): number {
149|  return Math.min(max, Math.max(min, v));
150|}
151|
152|export type ExportFormat = "png" | "jpg" | "webp";
153|
154|export interface SizePreset {
155|  id: string;
156|  label: string;
157|  width: number;
158|  height: number;
159|}
160|
161|export const SIZE_PRESETS: SizePreset[] = [
162|  { id: "free", label: "Free", width: 0, height: 0 },
163|  { id: "twitter", label: "Twitter 2:1", width: 1200, height: 600 },
164|  { id: "og", label: "OG 1.91:1", width: 1200, height: 630 },
165|  { id: "dribbble", label: "Dribbble 4:3", width: 1600, height: 1200 },
166|  { id: "square", label: "Square", width: 1080, height: 1080 },
167|];
168|
169|/** Derive a filename for the exported image from the source filename. */
170|export function exportFilename(originalName: string, format: ExportFormat = "png"): string {
171|  const base = originalName.replace(/\.[^.]+$/, "");
172|  return `${base}-beautiful.${format}`;
173|}
174|
175|/** Map ExportFormat to a MIME type string for canvas.toDataURL / toBlob. */
176|export function mimeForFormat(format: ExportFormat): string {
177|  if (format === "jpg") return "image/jpeg";
178|  if (format === "webp") return "image/webp";
179|  return "image/png";
180|}
181|