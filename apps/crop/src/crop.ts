1|/** Aspect ratio presets. "free" means no constraint. */
import { clamp } from "@junkyardsh/ui";
2|export type AspectPreset = "free" | "1:1" | "4:5" | "16:9" | "9:16" | "4:3" | "3:2" | "4:1";
3|
4|export interface AspectRatio {
5|  label: AspectPreset;
6|  w: number;
7|  h: number;
8|}
9|
10|export const ASPECT_PRESETS: AspectRatio[] = [
11|  { label: "free", w: 0, h: 0 },
12|  { label: "1:1", w: 1, h: 1 },
13|  { label: "4:5", w: 4, h: 5 },
14|  { label: "9:16", w: 9, h: 16 },
15|  { label: "16:9", w: 16, h: 9 },
16|  { label: "4:3", w: 4, h: 3 },
17|  { label: "3:2", w: 3, h: 2 },
18|  { label: "4:1", w: 4, h: 1 },
19|];
20|
21|/** Named social-size presets: a label plus a target aspect ratio. */
22|export interface SocialPreset {
23|  name: string;
24|  /** Output pixel dimensions hint (shown to user). Crop enforces the ratio. */
25|  px: string;
26|  aspect: AspectPreset;
27|}
28|
29|export const SOCIAL_PRESETS: SocialPreset[] = [
30|  { name: "Instagram Square", px: "1080x1080", aspect: "1:1" },
31|  { name: "Instagram Portrait", px: "1080x1350", aspect: "4:5" },
32|  { name: "Instagram Story", px: "1080x1920", aspect: "9:16" },
33|  { name: "Twitter / X Post", px: "1200x675", aspect: "16:9" },
34|  { name: "Twitter / X Header", px: "1500x500", aspect: "3:2" },
35|  { name: "Facebook Cover", px: "820x312", aspect: "16:9" },
36|  { name: "YouTube Thumbnail", px: "1280x720", aspect: "16:9" },
37|  { name: "LinkedIn Banner", px: "1584x396", aspect: "4:1" },
38|];
39|
40|/** Crop shape modes. */
41|export type CropShape = "rect" | "circle";
42|
43|export type ExportFormat = "png" | "jpg" | "webp";
44|
45|/** A crop rectangle in image-pixel coordinates. */
46|export interface CropRect {
47|  x: number;
48|  y: number;
49|  w: number;
50|  h: number;
51|}
52|
53|/** Clamp a value between min and max. */
54|export function clamp(value: number, min: number, max: number): number {
55|  return Math.max(min, Math.min(max, value));
56|}
57|
58|/**
59| * Constrain a crop rect to fit within image bounds (imgW x imgH).
60| * Preserves position intent, if the rect would overflow it's pushed back in.
61| */
62|export function clampRect(rect: CropRect, imgW: number, imgH: number): CropRect {
63|  const w = clamp(rect.w, 1, imgW);
64|  const h = clamp(rect.h, 1, imgH);
65|  const x = clamp(rect.x, 0, imgW - w);
66|  const y = clamp(rect.y, 0, imgH - h);
67|  return { x, y, w, h };
68|}
69|
70|/**
71| * Given a desired aspect ratio and a bounding box, compute the largest
72| * crop rect centred in the bounding box that satisfies the ratio.
73| * If ratio is "free" (w=0/h=0), returns the full bounding box.
74| */
75|export function fitRectToAspect(aspect: AspectRatio, boundW: number, boundH: number): CropRect {
76|  if (aspect.w === 0 || aspect.h === 0) {
77|    return { x: 0, y: 0, w: boundW, h: boundH };
78|  }
79|  const ratio = aspect.w / aspect.h;
80|  let w = boundW;
81|  let h = Math.round(w / ratio);
82|  if (h > boundH) {
83|    h = boundH;
84|    w = Math.round(h * ratio);
85|  }
86|  const x = Math.round((boundW - w) / 2);
87|  const y = Math.round((boundH - h) / 2);
88|  return { x, y, w, h };
89|}
90|
91|/**
92| * Snap a crop rect to maintain a given aspect ratio after a resize drag.
93| * Anchor is which corner is being dragged ("br" = bottom-right, etc.).
94| * For simplicity we scale from the top-left when aspect changes.
95| */
96|export function snapToAspect(rect: CropRect, aspect: AspectRatio): CropRect {
97|  if (aspect.w === 0 || aspect.h === 0) return rect;
98|  const ratio = aspect.w / aspect.h;
99|  const h = Math.round(rect.w / ratio);
100|  return { ...rect, h };
101|}
102|
103|/**
104| * Rotate an image on a canvas and return a new ImageData-like object.
105| * Rotation is in degrees: 90 = 90 deg clockwise, -90 = 90 deg CCW.
106| */
107|export function rotateCanvas(
108|  source: HTMLCanvasElement,
109|  degrees: 90 | -90 | 180
110|): HTMLCanvasElement {
111|  const radians = (degrees * Math.PI) / 180;
112|  const abs = Math.abs(degrees);
113|  const outW = abs === 90 ? source.height : source.width;
114|  const outH = abs === 90 ? source.width : source.height;
115|
116|  const out = document.createElement("canvas");
117|  out.width = outW;
118|  out.height = outH;
119|  const ctx = out.getContext("2d");
120|  if (!ctx) throw new Error("Canvas 2D context unavailable");
121|
122|  ctx.translate(outW / 2, outH / 2);
123|  ctx.rotate(radians);
124|  ctx.drawImage(source, -source.width / 2, -source.height / 2);
125|  return out;
126|}
127|
128|/**
129| * Flip a canvas horizontally (flipH=true) or vertically.
130| */
131|export function flipCanvas(
132|  source: HTMLCanvasElement,
133|  flipH: boolean,
134|  flipV: boolean
135|): HTMLCanvasElement {
136|  const out = document.createElement("canvas");
137|  out.width = source.width;
138|  out.height = source.height;
139|  const ctx = out.getContext("2d");
140|  if (!ctx) throw new Error("Canvas 2D context unavailable");
141|
142|  ctx.translate(flipH ? source.width : 0, flipV ? source.height : 0);
143|  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
144|  ctx.drawImage(source, 0, 0);
145|  return out;
146|}
147|
148|/**
149| * Apply a CropRect to a canvas, optionally resizing the output.
150| * Returns a data URL in the specified format.
151| */
152|export function applyCropAndResize(
153|  source: HTMLCanvasElement,
154|  crop: CropRect,
155|  resizeW: number,
156|  resizeH: number,
157|  format: ExportFormat,
158|  quality: number
159|): string {
160|  const out = document.createElement("canvas");
161|  out.width = resizeW > 0 ? resizeW : crop.w;
162|  out.height = resizeH > 0 ? resizeH : crop.h;
163|  const ctx = out.getContext("2d");
164|  if (!ctx) throw new Error("Canvas 2D context unavailable");
165|
166|  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);
167|
168|  const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`;
169|  return out.toDataURL(mimeType, quality / 100);
170|}
171|
172|/**
173| * Extended crop export with optional circle clip.
174| * Circle clip always outputs PNG regardless of format choice (transparency needed).
175| */
176|export function applyCropAndResizeWithShape(
177|  source: HTMLCanvasElement,
178|  crop: CropRect,
179|  resizeW: number,
180|  resizeH: number,
181|  format: ExportFormat,
182|  quality: number,
183|  shape: CropShape
184|): string {
185|  const outW = resizeW > 0 ? resizeW : crop.w;
186|  const outH = resizeH > 0 ? resizeH : crop.h;
187|
188|  const out = document.createElement("canvas");
189|  out.width = outW;
190|  out.height = outH;
191|  const ctx = out.getContext("2d");
192|  if (!ctx) throw new Error("Canvas 2D context unavailable");
193|
194|  if (shape === "circle") {
195|    // Clip to ellipse centred in output canvas
196|    ctx.beginPath();
197|    ctx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2);
198|    ctx.clip();
199|  }
200|
201|  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);
202|
203|  // Circle crop must be PNG to preserve transparency
204|  const effectiveFmt: ExportFormat = shape === "circle" ? "png" : format;
205|  const mimeType = effectiveFmt === "jpg" ? "image/jpeg" : `image/${effectiveFmt}`;
206|  return out.toDataURL(mimeType, quality / 100);
207|}
208|
209|/**
210| * Rotate a canvas by an arbitrary angle (degrees). Output is sized to contain
211| * the full rotated image without cropping the corners.
212| */
213|export function rotateCanvasArbitrary(
214|  source: HTMLCanvasElement,
215|  degrees: number
216|): HTMLCanvasElement {
217|  if (degrees === 0) return source;
218|  const rad = (degrees * Math.PI) / 180;
219|  const cos = Math.abs(Math.cos(rad));
220|  const sin = Math.abs(Math.sin(rad));
221|  const outW = Math.ceil(source.width * cos + source.height * sin);
222|  const outH = Math.ceil(source.width * sin + source.height * cos);
223|
224|  const out = document.createElement("canvas");
225|  out.width = outW;
226|  out.height = outH;
227|  const ctx = out.getContext("2d");
228|  if (!ctx) throw new Error("Canvas 2D context unavailable");
229|  ctx.translate(outW / 2, outH / 2);
230|  ctx.rotate(rad);
231|  ctx.drawImage(source, -source.width / 2, -source.height / 2);
232|  return out;
233|}
234|
235|/** Parse a natural "WxH" string like "1920x1080" into [w, h] or null. */
236|export function parseDimensions(input: string): [number, number] | null {
237|  const m = input.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
238|  if (!m) return null;
239|  const w = Number.parseInt(m[1], 10);
240|  const h = Number.parseInt(m[2], 10);
241|  if (w <= 0 || h <= 0 || w > 16000 || h > 16000) return null;
242|  return [w, h];
243|}
244|
245|/** Given crop dims and a new width, compute proportional height. */
246|export function proportionalHeight(cropW: number, cropH: number, newW: number): number {
247|  if (cropW === 0) return 0;
248|  return Math.round((cropH / cropW) * newW);
249|}
250|