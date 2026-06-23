/**
 * Unit tests for the classical FMM inpainter.
 *
 * These tests use small synthetic images where the expected output is computable
 * by hand: a solid-color image with a small masked region should be filled with
 * roughly the same color.
 */
import { describe, expect, it } from "vitest";
import { inpaintImageData } from "./inpaint";

/** Build a flat RGBA Uint8ClampedArray filled with a solid color. */
function solidImage(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

/** Build a mask: 255 for the given (x,y) pixel indices, 0 elsewhere. */
function pointMask(width: number, height: number, points: Array<[number, number]>): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const [x, y] of points) {
    mask[y * width + x] = 255;
  }
  return mask;
}

describe("inpaintImageData", () => {
  it("fills a single masked pixel in a solid-color image with that color", () => {
    const W = 10;
    const H = 10;
    const pixels = solidImage(W, H, 200, 100, 50);
    const mask = pointMask(W, H, [[5, 5]]);

    // Corrupt the masked pixel so we can verify it gets restored
    pixels[5 * 5 * 4 + (5 * W + 5) * 4] = 0;
    pixels[(5 * W + 5) * 4 + 1] = 0;
    pixels[(5 * W + 5) * 4 + 2] = 0;

    inpaintImageData(pixels, mask, W, H, 3);

    // After inpainting, the pixel should be close to the original color
    const idx = (5 * W + 5) * 4;
    expect(pixels[idx]).toBeGreaterThan(150); // R ~200
    expect(pixels[idx + 1]).toBeGreaterThan(60); // G ~100
    expect(pixels[idx + 2]).toBeGreaterThan(20); // B ~50
    expect(pixels[idx + 3]).toBe(255); // A = opaque
  });

  it("leaves known pixels unchanged", () => {
    const W = 8;
    const H = 8;
    const pixels = solidImage(W, H, 100, 150, 200);
    // Only mask center pixel
    const mask = pointMask(W, H, [[4, 4]]);

    // Corner pixel (0,0) must be untouched
    const cornerBefore = [pixels[0], pixels[1], pixels[2], pixels[3]];

    inpaintImageData(pixels, mask, W, H, 2);

    expect(pixels[0]).toBe(cornerBefore[0]);
    expect(pixels[1]).toBe(cornerBefore[1]);
    expect(pixels[2]).toBe(cornerBefore[2]);
    expect(pixels[3]).toBe(cornerBefore[3]);
  });

  it("handles a mask covering the entire image without throwing", () => {
    const W = 4;
    const H = 4;
    const pixels = solidImage(W, H, 50, 50, 50);
    const mask = new Uint8Array(W * H).fill(255);
    // No known pixels - the algorithm should not throw; some pixels may remain 0
    expect(() => inpaintImageData(pixels, mask, W, H, 2)).not.toThrow();
  });

  it("handles a 1x1 image with no mask without throwing", () => {
    const pixels = solidImage(1, 1, 42, 43, 44);
    const mask = new Uint8Array(1); // all zeros - no mask
    expect(() => inpaintImageData(pixels, mask, 1, 1, 1)).not.toThrow();
    // Pixel should be unchanged
    expect(pixels[0]).toBe(42);
  });

  it("fills multiple adjacent masked pixels in a solid image", () => {
    const W = 20;
    const H = 20;
    const pixels = solidImage(W, H, 180, 80, 40);

    // Mask a 3x3 block in the center
    const maskedPoints: Array<[number, number]> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        maskedPoints.push([10 + dx, 10 + dy]);
      }
    }
    const mask = pointMask(W, H, maskedPoints);

    // Zero out masked pixels
    for (const [x, y] of maskedPoints) {
      const i = (y * W + x) * 4;
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
    }

    inpaintImageData(pixels, mask, W, H, 4);

    // Center pixel should be approximately restored
    const ci = (10 * W + 10) * 4;
    expect(pixels[ci]).toBeGreaterThan(120); // R ~180
    expect(pixels[ci + 3]).toBe(255);
  });

  it("produces opaque alpha for all filled pixels", () => {
    const W = 10;
    const H = 10;
    const pixels = solidImage(W, H, 100, 100, 100);
    // Mask entire inner region
    const mask = new Uint8Array(W * H);
    for (let y = 2; y < 8; y++) {
      for (let x = 2; x < 8; x++) {
        mask[y * W + x] = 255;
      }
    }

    inpaintImageData(pixels, mask, W, H, 3);

    // Check every pixel that was masked now has alpha = 255
    for (let y = 2; y < 8; y++) {
      for (let x = 2; x < 8; x++) {
        const a = pixels[(y * W + x) * 4 + 3];
        expect(a).toBe(255);
      }
    }
  });
});

describe("inpaintImageData - gradient fill quality", () => {
  it("interpolates between two differently-colored regions", () => {
    // Left half = red (255,0,0), right half = blue (0,0,255)
    // Mask the center column; it should be filled with something between red and blue
    const W = 21;
    const H = 5;
    const pixels = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (x < W / 2) {
          pixels[i] = 255; // R
          pixels[i + 3] = 255;
        } else {
          pixels[i + 2] = 255; // B
          pixels[i + 3] = 255;
        }
      }
    }

    const mask = new Uint8Array(W * H);
    // Mask center column
    for (let y = 0; y < H; y++) {
      mask[y * W + 10] = 255;
    }

    inpaintImageData(pixels, mask, W, H, 4);

    // Center column should have non-zero R and/or B (not remain 0,0,0)
    const ci = (2 * W + 10) * 4;
    const r = pixels[ci];
    const b = pixels[ci + 2];
    expect(r + b).toBeGreaterThan(0);
  });
});
