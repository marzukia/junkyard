import { describe, expect, it } from "vitest";
import { hexToRgb, isValidHex, normaliseHex } from "./qr";

describe("isValidHex", () => {
  it("accepts 6-digit hex with hash", () => {
    expect(isValidHex("#1a2530")).toBe(true);
  });

  it("accepts 6-digit hex without hash", () => {
    expect(isValidHex("2f9d8d")).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(isValidHex("#FFFFFF")).toBe(true);
  });

  it("rejects 3-digit shorthand", () => {
    expect(isValidHex("#fff")).toBe(false);
  });

  it("rejects 8-digit RGBA hex", () => {
    expect(isValidHex("#1a2530ff")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidHex("#zzzzzz")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidHex("")).toBe(false);
  });
});

describe("normaliseHex", () => {
  it("adds leading hash and lowercases", () => {
    expect(normaliseHex("2F9D8D")).toBe("#2f9d8d");
  });

  it("preserves leading hash", () => {
    expect(normaliseHex("#e8b04b")).toBe("#e8b04b");
  });

  it("returns null for 3-digit shorthand", () => {
    expect(normaliseHex("#fff")).toBeNull();
  });

  it("returns null for invalid chars", () => {
    expect(normaliseHex("gggggg")).toBeNull();
  });

  it("trims whitespace before validating", () => {
    expect(normaliseHex("  #ffffff  ")).toBe("#ffffff");
  });
});

describe("normaliseHex - SVG injection guard", () => {
  // normaliseHex is the gate before colours reach SVG attribute strings.
  // These ensure characters that could break SVG XML are rejected.
  it("rejects strings containing angle brackets", () => {
    expect(normaliseHex('red"/><script>alert(1)</script>')).toBeNull();
  });

  it("rejects strings containing quotes", () => {
    expect(normaliseHex('"#ff0000"')).toBeNull();
  });

  it("rejects CSS function notation", () => {
    expect(normaliseHex("rgb(255,0,0)")).toBeNull();
  });

  it("rejects named colours", () => {
    expect(normaliseHex("red")).toBeNull();
  });
});

describe("hexToRgb", () => {
  it("converts black", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts white", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts brand teal #2f9d8d", () => {
    expect(hexToRgb("#2f9d8d")).toEqual({ r: 47, g: 157, b: 141 });
  });

  it("converts brand amber #e8b04b", () => {
    expect(hexToRgb("#e8b04b")).toEqual({ r: 232, g: 176, b: 75 });
  });

  it("converts brand coral #d9594c", () => {
    expect(hexToRgb("#d9594c")).toEqual({ r: 217, g: 89, b: 76 });
  });

  it("returns null for invalid hex", () => {
    expect(hexToRgb("nothex")).toBeNull();
  });

  it("accepts hex without hash", () => {
    expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });
});
