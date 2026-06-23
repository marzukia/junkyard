declare module "gifenc" {
  export interface GIFEncoderOptions {
    auto?: boolean;
    repeat?: number;
    delay?: number;
    palette?: number[][];
    transparent?: number;
    transparentIndex?: number;
    colorDepth?: number;
    first?: boolean;
    last?: boolean;
  }

  export interface GIFEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GIFEncoderOptions
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GIFEncoder;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string; oneBit?: boolean }
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string
  ): Uint8Array;

  export function nearestColorIndex(palette: number[][], r: number, g: number, b: number): number;

  export function snapColorsToPalette(
    palette: number[][],
    rgba: Uint8Array | Uint8ClampedArray
  ): Uint8Array;
}
