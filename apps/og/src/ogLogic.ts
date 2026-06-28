1|/**
import { clamp } from "@junkyardsh/ui";
2| * Pure logic for OG image generation.
3| * All functions here are side-effect-free and testable in isolation.
4| */
5|
6|export type BgType = "solid" | "gradient";
7|export type Layout = "centered" | "left" | "brand";
8|export type FontPreset = "inter" | "mono" | "serif";
9|
10|export interface OgConfig {
11|  title: string;
12|  subtitle: string;
13|  badge: string;
14|  bgType: BgType;
15|  bgColor: string;
16|  bgColorEnd: string;
17|  gradientAngle: number;
18|  textColor: string;
19|  badgeBg: string;
20|  badgeText: string;
21|  layout: Layout;
22|  font: FontPreset;
23|  bgImage: string | null;
24|  bgImageOpacity: number;
25|  logoImage: string | null;
26|  logoSize: number;
27|}
28|
29|export const DEFAULT_CONFIG: OgConfig = {
30|  title: "My OG Image",
31|  subtitle: "A social share image created with junkyard.sh/og/",
32|  badge: "junkyard.sh/og/",
33|  bgType: "solid",
34|  bgColor: "#1a2530",
35|  bgColorEnd: "#2f9d8d",
36|  gradientAngle: 135,
37|  textColor: "#ffffff",
38|  badgeBg: "#2f9d8d",
39|  badgeText: "#ffffff",
40|  layout: "centered",
41|  font: "inter",
42|  bgImage: null,
43|  bgImageOpacity: 0.25,
44|  logoImage: null,
45|  logoSize: 80,
46|};
47|
48|export const TEMPLATES: Record<string, Partial<OgConfig>> = {
49|  dark: {
50|    bgType: "solid",
51|    bgColor: "#1a2530",
52|    bgColorEnd: "#1a2530",
53|    textColor: "#ffffff",
54|    badgeBg: "#2f9d8d",
55|    badgeText: "#ffffff",
56|    layout: "centered",
57|    font: "inter",
58|  },
59|  brand: {
60|    bgType: "gradient",
61|    bgColor: "#2f9d8d",
62|    bgColorEnd: "#1a2530",
63|    gradientAngle: 135,
64|    textColor: "#ffffff",
65|    badgeBg: "#e8b04b",
66|    badgeText: "#1a2530",
67|    layout: "brand",
68|    font: "inter",
69|  },
70|  light: {
71|    bgType: "solid",
72|    bgColor: "#fafafa",
73|    bgColorEnd: "#fafafa",
74|    textColor: "#1a2530",
75|    badgeBg: "#e8eaed",
76|    badgeText: "#5b6671",
77|    layout: "centered",
78|    font: "inter",
79|  },
80|  coral: {
81|    bgType: "gradient",
82|    bgColor: "#d9594c",
83|    bgColorEnd: "#e8b04b",
84|    gradientAngle: 120,
85|    textColor: "#ffffff",
86|    badgeBg: "rgba(0,0,0,0.25)",
87|    badgeText: "#ffffff",
88|    layout: "left",
89|    font: "inter",
90|  },
91|  mono: {
92|    bgType: "solid",
93|    bgColor: "#111417",
94|    bgColorEnd: "#111417",
95|    textColor: "#e9eef1",
96|    badgeBg: "rgba(255,255,255,0.1)",
97|    badgeText: "#9aa6b0",
98|    layout: "left",
99|    font: "mono",
100|  },
101|};
102|
103|/** Resolve gradient CSS string for the given config */
104|export function resolveBgCss(
105|  config: Pick<OgConfig, "bgType" | "bgColor" | "bgColorEnd" | "gradientAngle">
106|): string {
107|  if (config.bgType === "gradient") {
108|    return `linear-gradient(${config.gradientAngle}deg, ${config.bgColor}, ${config.bgColorEnd})`;
109|  }
110|  return config.bgColor;
111|}
112|
113|/** Map FontPreset to a CSS font-family string */
114|export function resolveFontFamily(font: FontPreset): string {
115|  switch (font) {
116|    case "mono":
117|      return "'Roboto Mono', 'Courier New', monospace";
118|    case "serif":
119|      return "Georgia, 'Times New Roman', serif";
120|    default:
121|      return "'Roboto', system-ui, sans-serif";
122|  }
123|}
124|
125|/** Clamp a number between min and max (inclusive) */
126|export function clamp(value: number, min: number, max: number): number {
127|  return Math.min(Math.max(value, min), max);
128|}
129|
130|/** Parse a hex string and return an rgb tuple, or null if invalid */
131|export function parseHex(hex: string): [number, number, number] | null {
132|  const clean = hex.replace("#", "").trim();
133|  if (clean.length === 3) {
134|    const r = Number.parseInt(clean[0] + clean[0], 16);
135|    const g = Number.parseInt(clean[1] + clean[1], 16);
136|    const b = Number.parseInt(clean[2] + clean[2], 16);
137|    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
138|    return [r, g, b];
139|  }
140|  if (clean.length === 6) {
141|    const r = Number.parseInt(clean.slice(0, 2), 16);
142|    const g = Number.parseInt(clean.slice(2, 4), 16);
143|    const b = Number.parseInt(clean.slice(4, 6), 16);
144|    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
145|    return [r, g, b];
146|  }
147|  return null;
148|}
149|
150|/** Return true if hex is a valid CSS hex color */
151|export function isValidHex(hex: string): boolean {
152|  return parseHex(hex) !== null;
153|}
154|
155|/** Apply a template patch onto a base config, returning a new config */
156|export function applyTemplate(base: OgConfig, patch: Partial<OgConfig>): OgConfig {
157|  return { ...base, ...patch };
158|}
159|
160|/** Size preset definition */
161|export interface SizePreset {
162|  label: string;
163|  width: number;
164|  height: number;
165|}
166|
167|/** Common OG / social image size presets */
168|export const SIZE_PRESETS: SizePreset[] = [
169|  { label: "OG / Facebook", width: 1200, height: 630 },
170|  { label: "Twitter / X", width: 1200, height: 600 },
171|  { label: "LinkedIn", width: 1200, height: 627 },
172|  { label: "Square", width: 1200, height: 1200 },
173|];
174|
175|/**
176| * Generate the HTML meta tag snippet for OG + Twitter cards.
177| * imageUrl is the hosted URL of the exported image (user must supply it).
178| */
179|export function buildMetaSnippet(
180|  title: string,
181|  description: string,
182|  imageUrl: string,
183|  width: number,
184|  height: number
185|): string {
186|  const esc = (s: string) =>
187|    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
188|  return [
189|    "<!-- Open Graph -->",
190|    `<meta property="og:title" content="${esc(title)}" />`,
191|    `<meta property="og:description" content="${esc(description)}" />`,
192|    `<meta property="og:image" content="${esc(imageUrl)}" />`,
193|    `<meta property="og:image:width" content="${width}" />`,
194|    `<meta property="og:image:height" content="${height}" />`,
195|    '<meta property="og:type" content="website" />',
196|    "",
197|    "<!-- Twitter / X -->",
198|    '<meta name="twitter:card" content="summary_large_image" />',
199|    `<meta name="twitter:title" content="${esc(title)}" />`,
200|    `<meta name="twitter:description" content="${esc(description)}" />`,
201|    `<meta name="twitter:image" content="${esc(imageUrl)}" />`,
202|  ].join("\n");
203|}
204|
205|/**
206| * Wrap text into lines using a canvas context for accurate measurement.
207| * Exported so canvas drawing and font-shrink share a single implementation.
208| */
209|export function wrapTextCtx(
210|  ctx: CanvasRenderingContext2D,
211|  text: string,
212|  maxWidth: number
213|): string[] {
214|  if (!text) return [];
215|  const words = text.split(" ");
216|  const lines: string[] = [];
217|  let current = "";
218|  for (const word of words) {
219|    const test = current ? `${current} ${word}` : word;
220|    if (ctx.measureText(test).width > maxWidth && current) {
221|      lines.push(current);
222|      current = word;
223|    } else {
224|      current = test;
225|    }
226|  }
227|  if (current) lines.push(current);
228|
229|  // Character-level break: if any line is still wider than maxWidth (e.g. a long
230|  // URL with no spaces), split it character-by-character.
231|  const result: string[] = [];
232|  for (const line of lines) {
233|    if (ctx.measureText(line).width <= maxWidth) {
234|      result.push(line);
235|      continue;
236|    }
237|    let chunk = "";
238|    for (const char of line) {
239|      const next = chunk + char;
240|      if (ctx.measureText(next).width > maxWidth && chunk) {
241|        result.push(chunk);
242|        chunk = char;
243|      } else {
244|        chunk = next;
245|      }
246|    }
247|    if (chunk) result.push(chunk);
248|  }
249|  return result;
250|}
251|
252|/**
253| * Shrink a font size so the wrapped title fits within maxLines.
254| * Returns the adjusted font size (never below minSize).
255| */
256|export function shrinkFontToFit(
257|  ctx: CanvasRenderingContext2D,
258|  text: string,
259|  fontFamily: string,
260|  initialSizePx: number,
261|  maxWidth: number,
262|  maxLines: number,
263|  minSizePx: number
264|): number {
265|  let size = initialSizePx;
266|  while (size > minSizePx) {
267|    ctx.font = `800 ${size}px ${fontFamily}`;
268|    if (wrapTextCtx(ctx, text, maxWidth).length <= maxLines) return size;
269|    size = Math.max(minSizePx, size - 2);
270|  }
271|  return size;
272|}
273|
274|/**
275| * Estimate the number of title lines that will wrap on canvas.
276| * Uses an average character-width heuristic: no canvas context needed.
277| * Returns the line count so callers can warn when > 2.
278| */
279|export function estimateTitleLines(title: string, canvasWidth: number, fontSizePx: number): number {
280|  if (!title) return 0;
281|  // Average character width is ~0.58 * fontSize for bold Inter/sans-serif
282|  const avgCharW = fontSizePx * 0.58;
283|  const pad = canvasWidth * 0.072;
284|  const maxW = canvasWidth - pad * 2;
285|  const words = title.split(" ");
286|  let lines = 1;
287|  let lineW = 0;
288|
289|  for (const word of words) {
290|    const wordW = word.length * avgCharW;
291|    const testW = lineW === 0 ? wordW : lineW + avgCharW + wordW;
292|    if (testW > maxW && lineW > 0) {
293|      lines++;
294|      lineW = wordW;
295|    } else {
296|      lineW = testW;
297|    }
298|  }
299|  return lines;
300|}
301|