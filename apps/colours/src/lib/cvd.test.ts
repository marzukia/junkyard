import { describe, expect, it } from "vitest";
import { CVD_TYPES, simulate } from "./cvd";
import type { CvdType } from "./cvd";

const HEX_RE = /^#[0-9a-f]{6}$/;

describe("simulate — none (identity)", () => {
  it("returns the input hex unchanged", () => {
    expect(simulate("#ff0000", "none")).toBe("#ff0000");
    expect(simulate("#aabbcc", "none")).toBe("#aabbcc");
    expect(simulate("#000000", "none")).toBe("#000000");
    expect(simulate("#ffffff", "none")).toBe("#ffffff");
  });

  it("normalises case to lowercase", () => {
    expect(simulate("#AABBCC", "none")).toBe("#aabbcc");
  });
});

describe("simulate — output format", () => {
  const inputs = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffffff",
    "#000000",
    "#888888",
    "#336699",
    "#f0e040",
  ];
  const types = CVD_TYPES.filter((t) => t !== "none") as CvdType[];

  for (const type of types) {
    for (const hex of inputs) {
      it(`${type}: ${hex} → valid #rrggbb`, () => {
        expect(simulate(hex, type)).toMatch(HEX_RE);
      });
    }
  }
});

describe("simulate — determinism", () => {
  const types: CvdType[] = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"];
  const hex = "#4a90d9";
  for (const type of types) {
    it(`${type} gives the same result on repeated calls`, () => {
      expect(simulate(hex, type)).toBe(simulate(hex, type));
    });
  }
});

describe("simulate — greys stay grey", () => {
  const greys = ["#000000", "#808080", "#ffffff", "#333333", "#cccccc"];
  const types: CvdType[] = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"];

  for (const type of types) {
    for (const grey of greys) {
      it(`${type}: ${grey} stays grey (R≈G≈B)`, () => {
        const out = simulate(grey, type);
        const r = Number.parseInt(out.slice(1, 3), 16);
        const g = Number.parseInt(out.slice(3, 5), 16);
        const b = Number.parseInt(out.slice(5, 7), 16);
        // Allow ±2 per channel for rounding
        expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
        expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
      });
    }
  }
});

describe("simulate — red changes under protanopia/deuteranopia", () => {
  it("pure red looks different under protanopia", () => {
    expect(simulate("#ff0000", "protanopia")).not.toBe("#ff0000");
  });

  it("pure red looks different under deuteranopia", () => {
    expect(simulate("#ff0000", "deuteranopia")).not.toBe("#ff0000");
  });

  it("achromatopsia desaturates red to grey", () => {
    const out = simulate("#ff0000", "achromatopsia");
    const r = Number.parseInt(out.slice(1, 3), 16);
    const g = Number.parseInt(out.slice(3, 5), 16);
    const b = Number.parseInt(out.slice(5, 7), 16);
    // All channels should be equal (pure grey)
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
    // And it should not be red (r >> g, b)
    expect(r - g).toBeLessThan(20);
  });
});

describe("simulate — invalid input passthrough", () => {
  it("returns the input unchanged if it is not a valid hex", () => {
    expect(simulate("notahex", "protanopia")).toBe("notahex");
  });
});
