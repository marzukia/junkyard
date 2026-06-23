/**
 * Client-side image-to-palette extraction using the Canvas API.
 *
 * Strategy: downsample the image to a small canvas (MAX_DIM px on longest side),
 * read all pixels, then cluster via a simple k-means pass (k = requested count).
 * Pure client-side -- no server, no external deps.
 *
 * Designed to run in a web worker if needed, but works on the main thread for
 * images of reasonable size after the downsample step.
 */

import { normalizeHex } from "./color";

/** Maximum pixel dimension after downsampling. Keeps k-means fast. */
const MAX_DIM = 96;

/** Number of k-means iterations. 12 converges well on palette-sized k. */
const KMEANS_ITERS = 12;

/** Clamp a number to [0, 255]. */
function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

/**
 * Downsample an HTMLImageElement onto a temporary canvas and return all opaque
 * pixels as {r, g, b} triples. Pixels with alpha < 200 are discarded.
 */
function samplePixels(img: HTMLImageElement): RgbPixel[] {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const pixels: RgbPixel[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue; // skip transparent
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  return pixels;
}

/** Euclidean distance squared between two RGB pixels. */
function distSq(a: RgbPixel, b: RgbPixel): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

/** Pick k well-spaced seed pixels using kmeans++ initialization. */
function initCentroids(pixels: RgbPixel[], k: number): RgbPixel[] {
  if (pixels.length === 0) return [];
  const centers: RgbPixel[] = [pixels[Math.floor(Math.random() * pixels.length)]];

  while (centers.length < k) {
    // Weight each pixel by its distance to the nearest center
    const weights = pixels.map((p) => {
      const d = Math.min(...centers.map((c) => distSq(p, c)));
      return d;
    });
    const total = weights.reduce((s, w) => s + w, 0);
    if (total === 0) {
      // All pixels are coincident — just pick the next pixel sequentially
      centers.push(pixels[centers.length % pixels.length]);
      continue;
    }
    let r = Math.random() * total;
    let chosen = pixels[pixels.length - 1];
    for (let i = 0; i < pixels.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosen = pixels[i];
        break;
      }
    }
    centers.push(chosen);
  }
  return centers;
}

/** Run k-means on the pixel array and return k centroid colors. */
function kMeans(pixels: RgbPixel[], k: number): RgbPixel[] {
  if (pixels.length === 0) return [];
  const safeK = Math.min(k, pixels.length);
  let centers = initCentroids(pixels, safeK);

  for (let iter = 0; iter < KMEANS_ITERS; iter++) {
    // Assign each pixel to nearest center
    const sums: { r: number; g: number; b: number; count: number }[] = Array.from(
      { length: safeK },
      () => ({ r: 0, g: 0, b: 0, count: 0 })
    );

    for (const p of pixels) {
      let minD = Number.POSITIVE_INFINITY;
      let nearest = 0;
      for (let j = 0; j < centers.length; j++) {
        const d = distSq(p, centers[j]);
        if (d < minD) {
          minD = d;
          nearest = j;
        }
      }
      sums[nearest].r += p.r;
      sums[nearest].g += p.g;
      sums[nearest].b += p.b;
      sums[nearest].count++;
    }

    // Move centers to cluster means; if a cluster is empty keep the old center
    const next: RgbPixel[] = sums.map((s, j) =>
      s.count > 0 ? { r: s.r / s.count, g: s.g / s.count, b: s.b / s.count } : centers[j]
    );

    // Early-exit if no movement
    const moved = next.some((c, j) => distSq(c, centers[j]) > 1);
    centers = next;
    if (!moved) break;
  }

  return centers;
}

/** Convert an RGB pixel (float channels) to a clean #rrggbb hex string. */
function rgbToHex(p: RgbPixel): string {
  const r = clamp255(p.r).toString(16).padStart(2, "0");
  const g = clamp255(p.g).toString(16).padStart(2, "0");
  const b = clamp255(p.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/**
 * Sort centroids by perceived lightness so the palette reads light-to-dark.
 * Uses the W3C relative luminance formula.
 */
function perceivedLightness(p: RgbPixel): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(p.r) + 0.7152 * toLinear(p.g) + 0.0722 * toLinear(p.b);
}

/**
 * Load an image from a File object into an HTMLImageElement.
 * Resolves when the image is fully loaded; rejects on error.
 */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Extract `count` dominant colors from an image file.
 * Returns an array of #rrggbb hex strings sorted light-to-dark.
 *
 * Throws if the canvas API is unavailable or the image cannot be loaded.
 */
export async function extractPaletteFromFile(file: File, count: number): Promise<string[]> {
  const img = await loadImageFile(file);
  return extractPaletteFromImage(img, count);
}

/**
 * Extract `count` dominant colors from an HTMLImageElement.
 * Exported for testing / reuse.
 */
export function extractPaletteFromImage(img: HTMLImageElement, count: number): string[] {
  const pixels = samplePixels(img);
  if (pixels.length === 0) return Array(count).fill("#808080");

  const centroids = kMeans(pixels, count);

  // Sort light to dark
  centroids.sort((a, b) => perceivedLightness(b) - perceivedLightness(a));

  return centroids.map((c) => {
    const hex = rgbToHex(c);
    return normalizeHex(hex) ?? "#808080";
  });
}

/**
 * Check whether a File is an image type we can load via <img>.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}
