1|/**
import { clamp } from "@junkyardsh/ui";
2| * Pure GIF encoding helpers built on gifenc.
3| * This module is isolated so unit tests can import it without a DOM.
4| */
5|
6|/** Clamp a value to [min, max]. */
7|export function clamp(value: number, min: number, max: number): number {
8|  return Math.max(min, Math.min(max, value));
9|}
10|
11|/**
12| * Estimate output GIF size in bytes for given dimensions, frame count, and delay.
13| * Based on empirical ~2 bits/pixel after quantization (conservative; real GIFs vary widely).
14| * Returns null if inputs are invalid.
15| */
16|export function estimateGifBytes(width: number, height: number, frameCount: number): number | null {
17|  if (width <= 0 || height <= 0 || frameCount <= 0) return null;
18|  // ~2 bits/pixel per frame after LZW + palette overhead ~1 KB per frame
19|  const pixelsPerFrame = width * height;
20|  const bitsPerPixel = 2;
21|  const bytesPerFrame = Math.ceil((pixelsPerFrame * bitsPerPixel) / 8) + 1024;
22|  // Plus ~800 bytes GIF header/trailer
23|  return bytesPerFrame * frameCount + 800;
24|}
25|
26|/**
27| * Format total animation duration in a human-readable way.
28| * e.g. 2500ms -> "2.5 s", 600ms -> "0.6 s"
29| */
30|export function formatDuration(totalMs: number): string {
31|  if (totalMs < 1000) return `${totalMs} ms`;
32|  return `${(totalMs / 1000).toFixed(1)} s`;
33|}
34|
35|/**
36| * Draw text overlay onto a canvas context. Returns the same ctx.
37| * Text is rendered at the bottom-center of the image.
38| */
39|export function drawCaption(
40|  ctx: CanvasRenderingContext2D,
41|  text: string,
42|  canvasWidth: number,
43|  canvasHeight: number
44|): void {
45|  if (!text) return;
46|  const fontSize = Math.max(12, Math.round(canvasHeight * 0.07));
47|  ctx.save();
48|  ctx.font = `bold ${fontSize}px sans-serif`;
49|  ctx.textAlign = "center";
50|  ctx.textBaseline = "bottom";
51|  const padding = 8;
52|  const textWidth = ctx.measureText(text).width;
53|  const boxW = textWidth + padding * 2;
54|  const boxH = fontSize + padding * 2;
55|  const bx = (canvasWidth - boxW) / 2;
56|  const by = canvasHeight - boxH - 4;
57|  ctx.fillStyle = "rgba(0,0,0,0.55)";
58|  ctx.beginPath();
59|  ctx.roundRect(bx, by, boxW, boxH, 4);
60|  ctx.fill();
61|  ctx.fillStyle = "#ffffff";
62|  ctx.fillText(text, canvasWidth / 2, canvasHeight - 4 - padding);
63|  ctx.restore();
64|}
65|
66|/**
67| * Centiseconds that the GIF spec uses per-frame (100ths of a second).
68| * ezgif defaults to 10cs = 100ms; we expose ms to users and convert here.
69| */
70|export function msToCentiseconds(ms: number): number {
71|  return Math.round(clamp(ms, 20, 60000) / 10);
72|}
73|
74|/** Human-readable FPS label for a given delay in ms. */
75|export function msToFpsLabel(ms: number): string {
76|  const fps = 1000 / ms;
77|  if (fps >= 10) return `${fps.toFixed(0)} fps`;
78|  return `${fps.toFixed(1)} fps`;
79|}
80|
81|/** Generate a collision-safe ID string. */
82|export function makeId(): string {
83|  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
84|    return crypto.randomUUID();
85|  }
86|  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
87|}
88|
89|/** A single GIF frame as held in state. */
90|export interface GifFrame {
91|  id: string;
92|  file: File;
93|  previewUrl: string;
94|  /** Per-frame delay override in ms, or null to use global. */
95|  delayMs: number | null;
96|  /** Natural pixel dimensions of the image. */
97|  width: number;
98|  height: number;
99|}
100|
101|/** Given a list of frames and a global delay, resolve each frame's effective ms. */
102|export function resolveDelay(frame: GifFrame, globalMs: number): number {
103|  return frame.delayMs !== null ? frame.delayMs : globalMs;
104|}
105|
106|/**
107| * Build ImageData from a File by drawing to an offscreen canvas,
108| * scaling to fit within maxDim on the longest axis.
109| * Optional caption is rendered at the bottom of the frame.
110| */
111|export async function fileToImageData(
112|  file: File,
113|  maxDim: number,
114|  caption?: string
115|): Promise<ImageData> {
116|  return new Promise((resolve, reject) => {
117|    const img = new Image();
118|    const url = URL.createObjectURL(file);
119|    img.onload = () => {
120|      URL.revokeObjectURL(url);
121|      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
122|      const w = Math.round(img.naturalWidth * scale);
123|      const h = Math.round(img.naturalHeight * scale);
124|      const canvas = document.createElement("canvas");
125|      canvas.width = w;
126|      canvas.height = h;
127|      const ctx = canvas.getContext("2d");
128|      if (!ctx) {
129|        reject(new Error("No 2D context"));
130|        return;
131|      }
132|      ctx.drawImage(img, 0, 0, w, h);
133|      if (caption) drawCaption(ctx, caption, w, h);
134|      resolve(ctx.getImageData(0, 0, w, h));
135|    };
136|    img.onerror = () => {
137|      URL.revokeObjectURL(url);
138|      reject(new Error("Failed to load image"));
139|    };
140|    img.src = url;
141|  });
142|}
143|
144|/**
145| * Extract frames from a video File via an offscreen <video> element.
146| * Seeks to evenly-spaced timestamps and snapshots each frame.
147| * Returns an array of { blob, width, height } for each extracted frame.
148| */
149|export async function extractVideoFrames(
150|  file: File,
151|  frameCount: number,
152|  maxDim: number
153|): Promise<{ blob: Blob; width: number; height: number }[]> {
154|  return new Promise((resolve, reject) => {
155|    const video = document.createElement("video");
156|    video.muted = true;
157|    video.preload = "metadata";
158|    const url = URL.createObjectURL(file);
159|
160|    video.onloadedmetadata = () => {
161|      const duration = video.duration;
162|      if (!Number.isFinite(duration) || duration <= 0) {
163|        URL.revokeObjectURL(url);
164|        reject(new Error("Could not read video duration"));
165|        return;
166|      }
167|
168|      const scale = Math.min(
169|        1,
170|        maxDim / Math.max(video.videoWidth || 640, video.videoHeight || 480)
171|      );
172|      const w = Math.round((video.videoWidth || 640) * scale);
173|      const h = Math.round((video.videoHeight || 480) * scale);
174|
175|      const canvas = document.createElement("canvas");
176|      canvas.width = w;
177|      canvas.height = h;
178|      const ctx = canvas.getContext("2d");
179|      if (!ctx) {
180|        URL.revokeObjectURL(url);
181|        reject(new Error("No 2D context"));
182|        return;
183|      }
184|
185|      const timestamps: number[] = [];
186|      for (let i = 0; i < frameCount; i++) {
187|        // Evenly space within the video, avoid t=0 which may show blank frame
188|        timestamps.push((duration * (i + 0.5)) / frameCount);
189|      }
190|
191|      const results: { blob: Blob; width: number; height: number }[] = [];
192|
193|      const captureNext = (idx: number) => {
194|        if (idx >= timestamps.length) {
195|          URL.revokeObjectURL(url);
196|          resolve(results);
197|          return;
198|        }
199|        video.currentTime = timestamps[idx];
200|      };
201|
202|      video.onseeked = () => {
203|        const idx = results.length;
204|        ctx.drawImage(video, 0, 0, w, h);
205|        canvas.toBlob(
206|          (blob) => {
207|            if (blob) results.push({ blob, width: w, height: h });
208|            captureNext(idx + 1);
209|          },
210|          "image/png",
211|          1
212|        );
213|      };
214|
215|      captureNext(0);
216|    };
217|
218|    video.onerror = () => {
219|      URL.revokeObjectURL(url);
220|      reject(new Error("Failed to load video"));
221|    };
222|
223|    video.src = url;
224|  });
225|}
226|
227|/**
228| * Encode frames to a GIF Blob using gifenc.
229| * All frames are scaled to fit within maxDim, then cropped/padded to
230| * the first frame's output dimensions.
231| * Optional caption string is burned into each frame at encode time.
232| */
233|export async function encodeGif(
234|  frames: GifFrame[],
235|  globalDelayMs: number,
236|  loops: number,
237|  maxDim: number,
238|  caption?: string
239|): Promise<Blob> {
240|  if (frames.length === 0) throw new Error("No frames to encode");
241|
242|  // Dynamic import so bundle only loads gifenc when encoding is actually triggered.
243|  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
244|
245|  // Determine canvas dimensions from first frame
246|  const firstData = await fileToImageData(frames[0].file, maxDim, caption);
247|  const W = firstData.width;
248|  const H = firstData.height;
249|
250|  const enc = GIFEncoder();
251|
252|  for (const frame of frames) {
253|    const imageData = await fileToImageData(frame.file, maxDim, caption);
254|    // Crop / zero-pad to first-frame dimensions
255|    const rgba = new Uint8Array(W * H * 4);
256|    const srcW = imageData.width;
257|    const srcH = imageData.height;
258|    const copyW = Math.min(W, srcW);
259|    const copyH = Math.min(H, srcH);
260|    for (let y = 0; y < copyH; y++) {
261|      for (let x = 0; x < copyW; x++) {
262|        const si = (y * srcW + x) * 4;
263|        const di = (y * W + x) * 4;
264|        rgba[di] = imageData.data[si];
265|        rgba[di + 1] = imageData.data[si + 1];
266|        rgba[di + 2] = imageData.data[si + 2];
267|        rgba[di + 3] = imageData.data[si + 3];
268|      }
269|    }
270|
271|    const palette = quantize(rgba, 256);
272|    const index = applyPalette(rgba, palette);
273|    const delay = msToCentiseconds(resolveDelay(frame, globalDelayMs));
274|
275|    enc.writeFrame(index, W, H, {
276|      palette,
277|      delay,
278|      repeat: loops,
279|    });
280|  }
281|
282|  enc.finish();
283|  const bytes = enc.bytes();
284|  // Copy into a fresh Uint8Array backed by a plain ArrayBuffer (no SharedArrayBuffer)
285|  const plain = new Uint8Array(bytes.length);
286|  plain.set(bytes);
287|  return new Blob([plain], { type: "image/gif" });
288|}
289|