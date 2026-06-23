/**
 * Canvas render path tests.
 *
 * The old applyDotStyle scanned row 0 of the rendered canvas for dark pixels to
 * detect module size. Row 0 is inside the quiet zone (margin=2), so it is always
 * white -- firstDark was always -1 and the function returned immediately, leaving
 * eye/dot styles completely inert on canvas.
 *
 * The fix: renderQRToCanvas now calls QRCode.create() for the module matrix and
 * passes it to applyDotStyle directly. These tests assert:
 *   1. The matrix/region logic (shared helpers) correctly classifies every cell in
 *      a version-1 QR grid (21 data modules + 2-module margin each side = 25 cols).
 *   2. The canvas drawing calls differ between eye styles, proving the finder eyes
 *      are actually drawn with the correct geometry.
 *   3. Data dot styles produce distinct drawing calls on data modules.
 *   4. renderQRToCanvas calls QRCode.create() and NOT QRCode.toCanvas().
 */

import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { computeFinderRegions, isFinderModule, renderQRToCanvas } from "./qr";
import type { QROptions } from "./qr";

// ---------------------------------------------------------------------------
// Matrix / region logic: version-1 QR (21 data modules, margin 2)
// Total grid: 25x25 cells.  Finder blocks at grid rows/cols:
//   TL: rows 2-8, cols 2-8
//   TR: rows 2-8, cols 16-22
//   BL: rows 16-22, cols 2-8
// ---------------------------------------------------------------------------

const MARGIN = 2;
const QR_MODULES = 21;

describe("finder region coverage for version-1 QR", () => {
  const regions = computeFinderRegions(MARGIN, QR_MODULES);

  it("each finder block covers exactly 49 cells (7x7)", () => {
    const totalCells = MARGIN * 2 + QR_MODULES;
    let tl = 0;
    let tr = 0;
    let bl = 0;

    for (let r = 0; r < totalCells; r++) {
      for (let c = 0; c < totalCells; c++) {
        const inTL =
          r >= regions.tlRow &&
          r < regions.tlRow + regions.finderSize &&
          c >= regions.tlCol &&
          c < regions.tlCol + regions.finderSize;
        const inTR =
          r >= regions.trRow &&
          r < regions.trRow + regions.finderSize &&
          c >= regions.trCol &&
          c < regions.trCol + regions.finderSize;
        const inBL =
          r >= regions.blRow &&
          r < regions.blRow + regions.finderSize &&
          c >= regions.blCol &&
          c < regions.blCol + regions.finderSize;
        if (inTL) tl++;
        if (inTR) tr++;
        if (inBL) bl++;
      }
    }

    expect(tl).toBe(49);
    expect(tr).toBe(49);
    expect(bl).toBe(49);
  });

  it("no cell is counted in more than one finder block", () => {
    const totalCells = MARGIN * 2 + QR_MODULES;
    for (let r = 0; r < totalCells; r++) {
      for (let c = 0; c < totalCells; c++) {
        const inTL =
          r >= regions.tlRow &&
          r < regions.tlRow + regions.finderSize &&
          c >= regions.tlCol &&
          c < regions.tlCol + regions.finderSize;
        const inTR =
          r >= regions.trRow &&
          r < regions.trRow + regions.finderSize &&
          c >= regions.trCol &&
          c < regions.trCol + regions.finderSize;
        const inBL =
          r >= regions.blRow &&
          r < regions.blRow + regions.finderSize &&
          c >= regions.blCol &&
          c < regions.blCol + regions.finderSize;
        const count = (inTL ? 1 : 0) + (inTR ? 1 : 0) + (inBL ? 1 : 0);
        expect(count, `cell (${r},${c}) is in ${count} finder blocks`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("isFinderModule returns true for all 147 finder cells (3 x 49)", () => {
    const totalCells = MARGIN * 2 + QR_MODULES;
    let finderCount = 0;
    for (let r = 0; r < totalCells; r++) {
      for (let c = 0; c < totalCells; c++) {
        if (isFinderModule(r, c, regions)) finderCount++;
      }
    }
    expect(finderCount).toBe(147);
  });

  it("quiet zone cells (row 0 and row 1) are NOT classified as finder", () => {
    // Row 0 and 1 are entirely within the quiet zone (margin=2).
    // The old pixel-scan bug scanned row 0 and found nothing dark.
    // This confirms the shared helper does NOT treat quiet-zone rows as finder.
    for (let c = 0; c < MARGIN * 2 + QR_MODULES; c++) {
      expect(isFinderModule(0, c, regions)).toBe(false);
      expect(isFinderModule(1, c, regions)).toBe(false);
    }
  });

  it("top-left finder corner cell (margin, margin) IS classified as finder", () => {
    expect(isFinderModule(MARGIN, MARGIN, regions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Canvas drawing calls: mock the 2d context so we can count drawing primitives.
//
// jsdom does not implement HTMLCanvasElement.getContext(), so we patch
// getContext() on the canvas prototype to return a tracked mock.
// The key assertions:
//  - circle eye style invokes ctx.arc() >= 9 times (3 eyes * 3 arcs each)
//  - square eye style invokes ctx.fillRect() for finders and NEVER ctx.arc()
//    (when dot style is also square)
//  - dots dot style invokes ctx.arc() for data modules
// ---------------------------------------------------------------------------

function makeMockCtx() {
  return {
    fillStyle: "" as string,
    arc: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    roundRect: vi.fn(),
    drawImage: vi.fn(),
  };
}

function makeCanvasWithMockCtx(size = 300): {
  canvas: HTMLCanvasElement;
  ctx: ReturnType<typeof makeMockCtx>;
} {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = makeMockCtx();
  vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

  return { canvas, ctx };
}

const BASE_OPTS: QROptions = {
  text: "https://junkyard.mrzk.io",
  fgColor: "#000000",
  bgColor: "#ffffff",
  errorCorrectionLevel: "M",
  dotStyle: "square",
};

describe("renderQRToCanvas - eye style drawing calls", () => {
  it("circle eye style calls ctx.arc() for finder eyes", async () => {
    const { canvas, ctx } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, { ...BASE_OPTS, eyeStyle: "circle" });

    // Each circle eye = 3 arc calls (outer ring, punch, inner dot).
    // Three finder eyes = at least 9 arc calls.
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.arc.mock.calls.length).toBeGreaterThanOrEqual(9);
  });

  it("square eye style calls fillRect() for finders and does NOT call arc()", async () => {
    const { canvas, ctx } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, { ...BASE_OPTS, eyeStyle: "square" });

    // Square eye uses fillRect for outer, punch, and inner. Background + 3 eyes
    // * 3 = 10 minimum fillRect calls.
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(10);
    // No arcs for square eyes + square data modules.
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("circle eye style produces more arc calls than square eye style", async () => {
    const { canvas: c1, ctx: ctx1 } = makeCanvasWithMockCtx();
    const { canvas: c2, ctx: ctx2 } = makeCanvasWithMockCtx();

    await renderQRToCanvas(c1, { ...BASE_OPTS, eyeStyle: "circle" });
    await renderQRToCanvas(c2, { ...BASE_OPTS, eyeStyle: "square" });

    expect(ctx1.arc.mock.calls.length).toBeGreaterThan(ctx2.arc.mock.calls.length);
  });

  it("rounded eye style calls roundRect() for finder eyes", async () => {
    const { canvas, ctx } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, { ...BASE_OPTS, eyeStyle: "rounded" });

    // Each rounded eye = 3 roundRect calls. Three eyes = at least 9.
    expect(ctx.roundRect.mock.calls.length).toBeGreaterThanOrEqual(9);
  });
});

describe("renderQRToCanvas - dot style drawing calls", () => {
  it("dots style calls ctx.arc() for data modules", async () => {
    const { canvas, ctx } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, { ...BASE_OPTS, dotStyle: "dots", eyeStyle: "square" });

    // Data modules (circles) all use arc. The QR has many dark data modules.
    expect(ctx.arc).toHaveBeenCalled();
  });

  it("square dot style does NOT call ctx.arc() when eye is also square", async () => {
    const { canvas, ctx } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, { ...BASE_OPTS, dotStyle: "square", eyeStyle: "square" });

    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("rounded dot style calls roundRect() for data modules", async () => {
    const { canvas, ctx } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, { ...BASE_OPTS, dotStyle: "rounded", eyeStyle: "square" });

    // Square eye style = 3 eyes * 3 rects, rounded data modules also use roundRect.
    // Rounded data modules should produce more roundRect calls than eye-only square.
    expect(ctx.roundRect).toHaveBeenCalled();
  });

  it("dots style produces more arc calls than square style", async () => {
    const { canvas: c1, ctx: ctx1 } = makeCanvasWithMockCtx();
    const { canvas: c2, ctx: ctx2 } = makeCanvasWithMockCtx();

    await renderQRToCanvas(c1, { ...BASE_OPTS, dotStyle: "dots", eyeStyle: "square" });
    await renderQRToCanvas(c2, { ...BASE_OPTS, dotStyle: "square", eyeStyle: "square" });

    expect(ctx1.arc.mock.calls.length).toBeGreaterThan(ctx2.arc.mock.calls.length);
  });
});

// ---------------------------------------------------------------------------
// Regression: verify renderQRToCanvas uses QRCode.create(), not QRCode.toCanvas().
//
// The old broken path called QRCode.toCanvas() then tried to scan the resulting
// pixels. Confirm that with our fix, QRCode.create() is called (synchronous
// matrix access) and QRCode.toCanvas() is NOT called.
// ---------------------------------------------------------------------------

describe("renderQRToCanvas - uses QRCode.create(), not QRCode.toCanvas()", () => {
  it("calls QRCode.create() when rendering", async () => {
    const createSpy = vi.spyOn(QRCode, "create");
    const { canvas } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, BASE_OPTS);

    expect(createSpy).toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it("does NOT call QRCode.toCanvas() when rendering", async () => {
    const toCanvasSpy = vi.spyOn(QRCode, "toCanvas");
    const { canvas } = makeCanvasWithMockCtx();

    await renderQRToCanvas(canvas, BASE_OPTS);

    expect(toCanvasSpy).not.toHaveBeenCalled();
    toCanvasSpy.mockRestore();
  });
});
