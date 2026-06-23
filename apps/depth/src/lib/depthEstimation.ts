/**
 * Depth estimation using @huggingface/transformers with Depth-Anything-v2-small.
 *
 * COOP/COEP note: GitHub Pages cannot send cross-origin isolation headers, so
 * SharedArrayBuffer is unavailable. We force numThreads=1 before loading any
 * ONNX session, this routes entirely through the single-threaded WASM backend
 * and never touches SharedArrayBuffer. WebGPU is attempted first (no isolation
 * required for WebGPU); WASM single-thread is the fallback.
 */
import { type DepthEstimationPipeline, RawImage, env, pipeline } from "@huggingface/transformers";

// ── Disable multi-threaded WASM (requires SharedArrayBuffer / COOP+COEP) ──────
// Must be set BEFORE any InferenceSession is created.
(env.backends as unknown as { onnx: { wasm: { numThreads: number } } }).onnx.wasm.numThreads = 1;

// Use browser cache so subsequent visits skip the download.
env.useBrowserCache = true;

const MODEL_ID = "onnx-community/depth-anything-v2-small";

export type ColourMap = "viridis" | "greyscale" | "magma" | "turbo" | "plasma";

export type ProgressCallback = (loaded: number, total: number, status: string) => void;

type TransformersProgressEvent = {
  status: string;
  loaded?: number;
  total?: number;
};

let estimator: DepthEstimationPipeline | null = null;

/** Load (or return cached) the depth-estimation pipeline. */
export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
  if (estimator) return;

  const progressCb = (event: TransformersProgressEvent) => {
    if (!onProgress) return;
    if (event.status === "progress" || event.status === "download") {
      onProgress(event.loaded ?? 0, event.total ?? 1, event.status);
    } else if (event.status === "initiate") {
      onProgress(0, 1, "initiate");
    } else if (event.status === "done") {
      onProgress(1, 1, "done");
    }
  };

  estimator = (await (
    pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
  )("depth-estimation", MODEL_ID, {
    progress_callback: progressCb,
  })) as DepthEstimationPipeline;
}

export interface DepthResult {
  /** Colourised depth map as a blob URL */
  resultUrl: string;
  /** Original image dimensions */
  width: number;
  height: number;
}

/** Cached raw depth data so colourmap changes don't re-run inference. */
export interface RawDepthCache {
  /** Normalised depth values [0,1], index by (y * width + x) */
  normalised: Float32Array;
  /** Original image width */
  width: number;
  /** Original image height */
  height: number;
}

/**
 * Viridis colour map lookup, maps a normalised value [0,1] to [R,G,B].
 * Sampled from the matplotlib viridis palette at 256 points.
 * Bright (yellow) = close; dark (purple) = far.
 */
export function viridisColour(t: number): [number, number, number] {
  // 8-stop piecewise linear approximation of viridis (sampled from matplotlib viridis)
  const stops: [number, number, number, number][] = [
    [0.0, 68, 1, 84],
    [0.143, 70, 50, 126],
    [0.286, 54, 92, 141],
    [0.429, 39, 127, 142],
    [0.571, 31, 161, 135],
    [0.714, 74, 193, 109],
    [0.857, 160, 218, 57],
    [1.0, 253, 231, 37],
  ];

  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      return [
        Math.round(r0 + f * (r1 - r0)),
        Math.round(g0 + f * (g1 - g0)),
        Math.round(b0 + f * (b1 - b0)),
      ];
    }
  }
  return [253, 231, 37];
}

/**
 * Magma colour map lookup, maps a normalised value [0,1] to [R,G,B].
 * 8-stop piecewise linear approximation of matplotlib magma.
 * Bright (white/yellow) = close; dark (black/purple) = far.
 */
export function magmaColour(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0.0, 0, 0, 4],
    [0.143, 28, 16, 68],
    [0.286, 79, 18, 123],
    [0.429, 129, 37, 129],
    [0.571, 181, 54, 122],
    [0.714, 229, 80, 100],
    [0.857, 251, 136, 97],
    [1.0, 252, 253, 191],
  ];

  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      return [
        Math.round(r0 + f * (r1 - r0)),
        Math.round(g0 + f * (g1 - g0)),
        Math.round(b0 + f * (b1 - b0)),
      ];
    }
  }
  return [252, 253, 191];
}

/**
 * Turbo colour map lookup, maps a normalised value [0,1] to [R,G,B].
 * Google's Turbo: red/yellow = close, blue = far. High-contrast + perceptually uniform.
 */
export function turboColour(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0.0, 48, 18, 59],
    [0.143, 50, 92, 200],
    [0.286, 44, 178, 187],
    [0.429, 75, 209, 112],
    [0.571, 178, 221, 60],
    [0.714, 241, 168, 40],
    [0.857, 227, 79, 21],
    [1.0, 122, 4, 3],
  ];

  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      return [
        Math.round(r0 + f * (r1 - r0)),
        Math.round(g0 + f * (g1 - g0)),
        Math.round(b0 + f * (b1 - b0)),
      ];
    }
  }
  return [122, 4, 3];
}

/**
 * Plasma colour map lookup, maps a normalised value [0,1] to [R,G,B].
 * 8-stop piecewise linear approximation of matplotlib plasma.
 * Bright (yellow) = close; dark (purple/blue) = far.
 */
export function plasmaColour(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0.0, 13, 8, 135],
    [0.143, 84, 2, 163],
    [0.286, 139, 10, 165],
    [0.429, 185, 50, 137],
    [0.571, 219, 92, 104],
    [0.714, 244, 136, 73],
    [0.857, 254, 188, 43],
    [1.0, 240, 249, 33],
  ];

  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      return [
        Math.round(r0 + f * (r1 - r0)),
        Math.round(g0 + f * (g1 - g0)),
        Math.round(b0 + f * (b1 - b0)),
      ];
    }
  }
  return [240, 249, 33];
}

/** Apply a colourmap function to a normalised depth value. */
export function applyColourMap(t: number, colourMap: ColourMap): [number, number, number] {
  switch (colourMap) {
    case "viridis":
      return viridisColour(t);
    case "magma":
      return magmaColour(t);
    case "turbo":
      return turboColour(t);
    case "plasma":
      return plasmaColour(t);
    case "greyscale": {
      const v = Math.round(t * 255);
      return [v, v, v];
    }
  }
}

/**
 * Render a colourised depth map from cached normalised depth data.
 * This is instant (no model inference) and is used for colourmap/invert changes.
 */
export async function renderDepthFromCache(
  cache: RawDepthCache,
  colourMap: ColourMap,
  invert: boolean
): Promise<string> {
  const { normalised, width, height } = cache;

  const outCanvas = new OffscreenCanvas(width, height);
  const ctx = outCanvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d not available.");

  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  for (let i = 0; i < normalised.length; i++) {
    const t = invert ? 1 - normalised[i] : normalised[i];
    const [r, g, b] = applyColourMap(t, colourMap);
    const idx = i * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  const blob = await outCanvas.convertToBlob({ type: "image/png" });
  return URL.createObjectURL(blob);
}

/**
 * Export raw 16-bit grayscale depth as a PNG.
 * Each pixel encodes the full 16-bit depth value (R=high byte, G=low byte in a grey16 PNG).
 * Since browsers can only write 8-bit PNG via canvas, we encode as 16-bit greyscale
 * by writing high byte to R and G, low byte to B — but most pipelines expect a simple
 * luminance mapping. The pragmatic approach is: write a 16-bit value encoded across
 * two 8-bit channels as a standard 8-bit PNG with R=high/G=low/B=0, and document it.
 * Alternatively, produce a true 16-bit greyscale PNG via manual chunk construction.
 *
 * We use the manual approach to produce a proper 16-bit greyscale PNG.
 */
export async function exportRaw16bit(cache: RawDepthCache, invert: boolean): Promise<string> {
  const { normalised, width, height } = cache;

  // Manually build a 16-bit grayscale PNG (colour type 0, bit depth 16).
  // PNG structure: signature + IHDR + IDAT + IEND
  // Raw image data: each pixel is 2 bytes (big-endian uint16), one filter byte per row
  // Row = 1 filter byte + width * 2 data bytes
  const rowBytes = 1 + width * 2;
  const rawData = new Uint8Array(height * rowBytes);

  for (let y = 0; y < height; y++) {
    rawData[y * rowBytes] = 0; // filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const t = invert ? 1 - normalised[idx] : normalised[idx];
      const v = Math.round(t * 65535);
      const byteOffset = y * rowBytes + 1 + x * 2;
      rawData[byteOffset] = (v >> 8) & 0xff; // high byte
      rawData[byteOffset + 1] = v & 0xff; // low byte
    }
  }

  // Compress with DeflateRaw
  const compressed = await compressDeflate(rawData);

  // Build PNG bytes
  const png = buildPng(width, height, compressed);
  const blob = new Blob([png], { type: "image/png" });
  return URL.createObjectURL(blob);
}

/** Compress bytes using CompressionStream (deflate-raw, available in modern browsers). */
async function compressDeflate(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  // Copy to a concrete ArrayBuffer to satisfy the CompressionStream BufferSource constraint
  const inputBuf = new ArrayBuffer(data.length);
  new Uint8Array(inputBuf).set(data);
  writer.write(new Uint8Array(inputBuf));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new ArrayBuffer(total);
  const out = new Uint8Array(buf);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Build a minimal PNG file from already-compressed IDAT data. */
function buildPng(width: number, height: number, idatData: Uint8Array): Uint8Array<ArrayBuffer> {
  // PNG signature
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width(4) height(4) bitDepth(1) colourType(1) compress(1) filter(1) interlace(1)
  const ihdrBuf = new ArrayBuffer(13);
  const ihdrData = new Uint8Array(ihdrBuf);
  const dv = new DataView(ihdrBuf);
  dv.setUint32(0, width, false);
  dv.setUint32(4, height, false);
  ihdrData[8] = 16; // bit depth
  ihdrData[9] = 0; // colour type 0 = greyscale
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = makeChunk("IHDR", ihdrData);
  const idat = makeChunk("IDAT", idatData);
  const iend = makeChunk("IEND", new Uint8Array(new ArrayBuffer(0)));

  const total = sig.length + ihdr.length + idat.length + iend.length;
  const outBuf = new ArrayBuffer(total);
  const out = new Uint8Array(outBuf);
  let off = 0;
  out.set(sig, off);
  off += sig.length;
  out.set(ihdr, off);
  off += ihdr.length;
  out.set(idat, off);
  off += idat.length;
  out.set(iend, off);
  return out;
}

/** Build a PNG chunk: length(4) + type(4) + data + crc(4). */
function makeChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const typeBytes = new TextEncoder().encode(type);
  const chunkBuf = new ArrayBuffer(4 + 4 + data.length + 4);
  const chunk = new Uint8Array(chunkBuf);
  const dv = new DataView(chunkBuf);
  dv.setUint32(0, data.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc, false);
  return chunk;
}

/** CRC-32 implementation for PNG chunk checksums. */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Run depth estimation and return a colourised depth map blob URL + raw cache. */
export async function estimateDepth(
  file: File,
  colourMap: ColourMap,
  invert: boolean
): Promise<DepthResult & { cache: RawDepthCache }> {
  if (!estimator) throw new Error("Model not loaded, call loadModel() first.");

  const bitmap = await createImageBitmap(file);
  const origW = bitmap.width;
  const origH = bitmap.height;

  // Build a RawImage from the file URL so transformers.js can decode it
  const fileUrl = URL.createObjectURL(file);
  const rawImage = await RawImage.fromURL(fileUrl);
  URL.revokeObjectURL(fileUrl);

  // Run depth estimation, returns { depth: RawImage, predicted_depth: Tensor }
  const output = await estimator(rawImage);

  // depth is a RawImage with single-channel float values (already normalised 0..1)
  const depthMap = (output as { depth: RawImage }).depth;
  if (!depthMap) throw new Error("Depth estimation returned no depth map.");

  const depthData = depthMap.data as Float32Array | Uint8Array;
  const depthH = depthMap.height;
  const depthW = depthMap.width;

  // Find min/max for normalisation (depth values may be raw floats)
  let dMin = Number.POSITIVE_INFINITY;
  let dMax = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < depthData.length; i++) {
    const v = depthData[i];
    if (v < dMin) dMin = v;
    if (v > dMax) dMax = v;
  }
  const dRange = dMax - dMin || 1;

  // Build normalised depth at original resolution (nearest-neighbour upscale)
  const normalised = new Float32Array(origW * origH);
  for (let py = 0; py < origH; py++) {
    for (let px = 0; px < origW; px++) {
      const dy = Math.min(Math.round((py / origH) * depthH), depthH - 1);
      const dx = Math.min(Math.round((px / origW) * depthW), depthW - 1);
      const raw = depthData[dy * depthW + dx];
      normalised[py * origW + px] = (raw - dMin) / dRange;
    }
  }

  bitmap.close();

  const cache: RawDepthCache = { normalised, width: origW, height: origH };
  const resultUrl = await renderDepthFromCache(cache, colourMap, invert);

  return { resultUrl, width: origW, height: origH, cache };
}

/** Revoke a blob URL returned by estimateDepth(). */
export function revokeResult(url: string): void {
  URL.revokeObjectURL(url);
}

/** True if the model is already loaded (cached). */
export function isModelLoaded(): boolean {
  return estimator !== null;
}
