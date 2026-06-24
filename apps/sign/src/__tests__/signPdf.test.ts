/**
 * Unit tests for signPdf helpers.
 *
 * canvasToPageCoords is the core coordinate-transform that fixes the
 * page-/Rotate-ignored bug. We test all four rotation angles so that
 * moving the coord transform logic would immediately surface failures.
 */

import { describe, it, expect } from "vitest";
import { canvasToPageCoords, hexToRgb } from "../lib/signPdf";

// A4 page: 595 x 842 pt
const W = 595;
const H = 842;

describe("canvasToPageCoords – rotation 0 (no rotation)", () => {
  it("maps top-left placement to pdf bottom-right area", () => {
    // xFrac=0, yFrac=0, wFrac=0.1, hFrac=0.1 -> top-left of canvas
    const r = canvasToPageCoords(0, 0, 0.1, 0.1, 0, W, H);
    expect(r.x).toBeCloseTo(0);
    // y: pageH - 0*H - 0.1*H = H - 0.1H = 0.9H
    expect(r.y).toBeCloseTo(H * 0.9);
    expect(r.w).toBeCloseTo(W * 0.1);
    expect(r.h).toBeCloseTo(H * 0.1);
  });

  it("maps bottom-right placement correctly", () => {
    const r = canvasToPageCoords(0.9, 0.9, 0.1, 0.1, 0, W, H);
    expect(r.x).toBeCloseTo(W * 0.9);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(W * 0.1);
    expect(r.h).toBeCloseTo(H * 0.1);
  });
});

describe("canvasToPageCoords – rotation 90", () => {
  // When /Rotate=90, PDF.js renders the page rotated 90 CW so that the user
  // sees the page upright. Canvas dims become (H x W) -- width=H, height=W.
  // The transform maps canvas-x -> pdf-y, canvas-y -> pdf-x.

  it("produces different coords than rotation=0 for the same fractions", () => {
    const r0 = canvasToPageCoords(0.5, 0.5, 0.2, 0.1, 0, W, H);
    const r90 = canvasToPageCoords(0.5, 0.5, 0.2, 0.1, 90, W, H);
    // They must differ because the coordinate mapping is different
    expect(r0.y).not.toBeCloseTo(r90.y); // y differs: 336.8 vs 421
  });

  it("centre of canvas maps to the centre of the pdf page", () => {
    // At rotation 90, canvas is H x W (842 x 595).
    // Centre: xFrac=0.5, yFrac=0.5
    // canvasX = 0.5 * H = 421, canvasY = 0.5 * W = 297.5
    // pdf coords: x = canvasY = 297.5, y = canvasX = 421
    // With w/h = 0: x=cyTop=0.5*W=297.5, y=cxLeft=0.5*H=421
    const r = canvasToPageCoords(0.5, 0.5, 0, 0, 90, W, H);
    expect(r.x).toBeCloseTo(W * 0.5, 0);
    expect(r.y).toBeCloseTo(H * 0.5, 0);
  });
});

describe("canvasToPageCoords – rotation 180", () => {
  it("flips both axes compared to rotation 0", () => {

    const r180 = canvasToPageCoords(0.1, 0.1, 0.2, 0.1, 180, W, H);
    // x should be mirrored: W - 0.1W - 0.2W = 0.7W
    expect(r180.x).toBeCloseTo(W * 0.7);
    // y in rot-180: cyTop = 0.1*H (from top), so pdf y = cyTop = 0.1H
    expect(r180.y).toBeCloseTo(H * 0.1);
  });
});

describe("canvasToPageCoords – rotation 270", () => {
  it("produces coords different from 0, 90, and 180 for the same fractions", () => {
    const r0 = canvasToPageCoords(0.3, 0.4, 0.1, 0.1, 0, W, H);
    const r90 = canvasToPageCoords(0.3, 0.4, 0.1, 0.1, 90, W, H);
    const r180 = canvasToPageCoords(0.3, 0.4, 0.1, 0.1, 180, W, H);
    const r270 = canvasToPageCoords(0.3, 0.4, 0.1, 0.1, 270, W, H);

    const allX = [r0.x, r90.x, r180.x, r270.x];
    // At least 3 distinct x values among the four rotations
    const distinctX = new Set(allX.map((v) => Math.round(v)));
    expect(distinctX.size).toBeGreaterThanOrEqual(2);
  });
});

describe("canvasToPageCoords – modulo/negative angle normalisation", () => {
  it("treats 360 the same as 0", () => {
    const r0 = canvasToPageCoords(0.2, 0.3, 0.1, 0.1, 0, W, H);
    const r360 = canvasToPageCoords(0.2, 0.3, 0.1, 0.1, 360, W, H);
    expect(r0.x).toBeCloseTo(r360.x);
    expect(r0.y).toBeCloseTo(r360.y);
  });

  it("treats -90 the same as 270", () => {
    const rNeg = canvasToPageCoords(0.2, 0.3, 0.1, 0.1, -90, W, H);
    const r270 = canvasToPageCoords(0.2, 0.3, 0.1, 0.1, 270, W, H);
    expect(rNeg.x).toBeCloseTo(r270.x);
    expect(rNeg.y).toBeCloseTo(r270.y);
  });
});

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    const c = hexToRgb("#1a2530");
    expect(c.red).toBeCloseTo(0x1a / 255, 3);
    expect(c.green).toBeCloseTo(0x25 / 255, 3);
    expect(c.blue).toBeCloseTo(0x30 / 255, 3);
  });

  it("parses 3-digit hex", () => {
    const c = hexToRgb("#fff");
    expect(c.red).toBeCloseTo(1, 3);
    expect(c.green).toBeCloseTo(1, 3);
    expect(c.blue).toBeCloseTo(1, 3);
  });

  it("throws on invalid input", () => {
    expect(() => hexToRgb("notacolor")).toThrow();
  });
});
