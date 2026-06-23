/**
 * Classical inpainting - fast marching method (FMM) inspired by Telea 2004.
 *
 * Approach: given an RGBA image and a binary mask (255 = pixel to erase),
 * reconstruct masked pixels by propagating color from the boundary inward,
 * weighting each known neighbor by distance and directional coherence.
 *
 * This is the v1 classical implementation. Neural ONNX inpainting (LaMa / MI-GAN)
 * is the intended follow-up (see PR scope notes); it requires a ~50-200 MB model
 * and SharedArrayBuffer-free ONNX runtime that currently has no stable small
 * inpainting model published to HuggingFace for web use.
 *
 * Quality is good for:
 *   - Simple/uniform backgrounds (sky, walls, grass)
 *   - Small-to-medium masked regions (up to ~15% of image area)
 *
 * Quality degrades on:
 *   - Complex textures or structured backgrounds (brickwork, tile)
 *   - Very large regions
 *
 * Exported symbols:
 *   inpaintImageData(pixels, mask, width, height, radius) -> void (mutates pixels in-place)
 *   eraseRegion(src: ImageData, mask: Uint8Array) -> ImageData
 */

/** Priority queue entry: (distance, pixel index). */
interface HeapEntry {
  dist: number;
  idx: number;
}

/** Minimal binary min-heap for fast marching. */
class MinHeap {
  private data: HeapEntry[] = [];

  get size(): number {
    return this.data.length;
  }

  push(entry: HeapEntry): void {
    this.data.push(entry);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(startIdx: number): void {
    let idx = startIdx;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.data[parent].dist <= this.data[idx].dist) break;
      [this.data[parent], this.data[idx]] = [this.data[idx], this.data[parent]];
      idx = parent;
    }
  }

  private _sinkDown(startIdx: number): void {
    const n = this.data.length;
    let idx = startIdx;
    for (;;) {
      let smallest = idx;
      const l = 2 * idx + 1;
      const r = 2 * idx + 2;
      if (l < n && this.data[l].dist < this.data[smallest].dist) smallest = l;
      if (r < n && this.data[r].dist < this.data[smallest].dist) smallest = r;
      if (smallest === idx) break;
      [this.data[smallest], this.data[idx]] = [this.data[idx], this.data[smallest]];
      idx = smallest;
    }
  }
}

/** Pixel state for the fast marching front. */
const KNOWN = 0;
const BAND = 1;
const INSIDE = 2;

/**
 * Inpaint masked pixels in-place using a fast-marching / weighted-average method.
 *
 * @param pixels  Flat RGBA Uint8ClampedArray (length = width * height * 4)
 * @param mask    Uint8Array length width*height: 255 = pixel to fill, 0 = known pixel
 * @param width   Image width in pixels
 * @param height  Image height in pixels
 * @param radius  Neighborhood radius for color sampling (default 5)
 */
export function inpaintImageData(
  pixels: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  radius = 5
): void {
  const n = width * height;

  // State: KNOWN / BAND / INSIDE per pixel
  const state = new Uint8Array(n);
  // Distance from nearest known pixel (for BAND and INSIDE)
  const dist = new Float32Array(n).fill(1e9);

  const heap = new MinHeap();

  // Initialise: classify all pixels
  for (let i = 0; i < n; i++) {
    if (mask[i] > 127) {
      state[i] = INSIDE;
    } else {
      state[i] = KNOWN;
      dist[i] = 0;
    }
  }

  // Seed the narrow band: known pixels adjacent to masked pixels
  const dx4 = [-1, 1, 0, 0];
  const dy4 = [0, 0, -1, 1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (state[i] !== KNOWN) continue;
      for (let d = 0; d < 4; d++) {
        const nx = x + dx4[d];
        const ny = y + dy4[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (state[ni] === INSIDE && dist[ni] > 1.0) {
          dist[ni] = 1.0;
          state[ni] = BAND;
          heap.push({ dist: 1.0, idx: ni });
        }
      }
    }
  }

  // Fast march inward
  while (heap.size > 0) {
    const entry = heap.pop()!;
    const { idx } = entry;

    // Skip stale heap entries
    if (state[idx] === KNOWN) continue;
    state[idx] = KNOWN;

    const cx = idx % width;
    const cy = (idx / width) | 0;
    const cd = dist[idx];

    // Fill this pixel with a weighted average of known neighbors in radius
    _fillPixel(pixels, state, dist, cx, cy, width, height, radius, cd);

    // Propagate the narrow band
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx4[d];
      const ny = cy + dy4[d];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (state[ni] === INSIDE) {
        const nd = cd + 1.0;
        if (nd < dist[ni]) {
          dist[ni] = nd;
          state[ni] = BAND;
          heap.push({ dist: nd, idx: ni });
        }
      }
    }
  }
}

/**
 * Fill a single masked pixel from weighted known neighbors.
 * Weight = (1/d^2) * (1/|r|) * |cos(angle)| + epsilon
 */
function _fillPixel(
  pixels: Uint8ClampedArray,
  state: Uint8Array,
  dist: Float32Array,
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
  centerDist: number
): void {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumW = 0;

  const r0 = Math.max(0, cy - radius);
  const r1 = Math.min(height - 1, cy + radius);
  const c0 = Math.max(0, cx - radius);
  const c1 = Math.min(width - 1, cx + radius);

  // Estimate local gradient direction from the distance field (for directional weight)
  // Simple finite difference on dist field
  let gx = 0;
  let gy = 0;
  if (cx + 1 < width) gx += dist[cy * width + cx + 1] - centerDist;
  if (cx - 1 >= 0) gx += centerDist - dist[cy * width + cx - 1];
  if (cy + 1 < height) gy += dist[(cy + 1) * width + cx] - centerDist;
  if (cy - 1 >= 0) gy += centerDist - dist[(cy - 1) * width + cx];
  const gLen = Math.sqrt(gx * gx + gy * gy) || 1;
  gx /= gLen;
  gy /= gLen;

  for (let y = r0; y <= r1; y++) {
    for (let x = c0; x <= c1; x++) {
      const ni = y * width + x;
      if (state[ni] !== KNOWN) continue;

      const dx = cx - x;
      const dy = cy - y;
      const d2 = dx * dx + dy * dy;
      if (d2 === 0 || d2 > radius * radius) continue;

      const d = Math.sqrt(d2);
      // Directional cosine: prefer neighbors in the gradient direction
      const dir = Math.abs((dx / d) * gx + (dy / d) * gy) + 1e-6;
      // Distance weight: nearer = stronger, and prefer closer-to-boundary pixels
      const distW = 1.0 / (dist[ni] + 1e-6);
      const w = (dir * distW) / d2;

      const p = ni * 4;
      sumR += w * pixels[p];
      sumG += w * pixels[p + 1];
      sumB += w * pixels[p + 2];
      sumW += w;
    }
  }

  if (sumW > 0) {
    const p = (cy * width + cx) * 4;
    pixels[p] = Math.round(sumR / sumW);
    pixels[p + 1] = Math.round(sumG / sumW);
    pixels[p + 2] = Math.round(sumB / sumW);
    pixels[p + 3] = 255; // fully opaque
  }
}

/**
 * High-level convenience: given a source ImageData and a mask Uint8Array
 * (length = width * height, 255 = erase), return a new ImageData with the
 * masked region inpainted. The input ImageData is not mutated.
 */
export function eraseRegion(src: ImageData, mask: Uint8Array): ImageData {
  const { width, height } = src;
  // Copy pixels so we mutate only the clone
  const outPixels = new Uint8ClampedArray(src.data);
  inpaintImageData(outPixels, mask, width, height);
  return new ImageData(outPixels, width, height);
}
