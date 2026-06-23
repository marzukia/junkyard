/**
 * Augmented tests for barcode.ts covering FORMAT_ORDER and clampSize
 * with format-specific minWidths not exercised in the main test file.
 */
import { describe, expect, it } from "vitest";
import {
  FORMAT_META,
  FORMAT_ORDER,
  clampSize,
  validateCode128,
  validateEan13,
  validateItf,
} from "./barcode";

// ── FORMAT_ORDER ──────────────────────────────────────────────────────────────

describe("FORMAT_ORDER", () => {
  it("contains exactly 7 formats", () => {
    expect(FORMAT_ORDER).toHaveLength(7);
  });

  it("first format is CODE128", () => {
    expect(FORMAT_ORDER[0]).toBe("CODE128");
  });

  it("all entries have a corresponding FORMAT_META entry", () => {
    for (const fmt of FORMAT_ORDER) {
      expect(FORMAT_META).toHaveProperty(fmt);
    }
  });

  it("contains EAN8 and CODE93", () => {
    expect(FORMAT_ORDER).toContain("EAN8");
    expect(FORMAT_ORDER).toContain("CODE93");
  });
});

// ── clampSize with format-specific minWidths ──────────────────────────────────

describe("clampSize - format-specific minWidth", () => {
  it("EAN8 clamps to minWidth 180 (narrower than CODE128)", () => {
    const result = clampSize({ width: 50, height: 80, margin: 5 }, "EAN8");
    expect(result.width).toBe(180);
  });

  it("EAN13 clamps to minWidth 220", () => {
    const result = clampSize({ width: 10, height: 80, margin: 5 }, "EAN13");
    expect(result.width).toBe(220);
  });

  it("UPC clamps to minWidth 220", () => {
    const result = clampSize({ width: 10, height: 80, margin: 5 }, "UPC");
    expect(result.width).toBe(220);
  });

  it("ITF clamps to minWidth 200", () => {
    const result = clampSize({ width: 5, height: 80, margin: 5 }, "ITF");
    expect(result.width).toBe(200);
  });

  it("CODE93 clamps to minWidth 200", () => {
    const result = clampSize({ width: 5, height: 80, margin: 5 }, "CODE93");
    expect(result.width).toBe(200);
  });

  it("passes through a valid width that exceeds format minWidth", () => {
    const result = clampSize({ width: 350, height: 80, margin: 10 }, "EAN8");
    expect(result.width).toBe(350);
  });

  it("clamps height to max 300", () => {
    const result = clampSize({ width: 300, height: 9999, margin: 0 }, "CODE128");
    expect(result.height).toBe(300);
  });

  it("clamps margin to max 40", () => {
    const result = clampSize({ width: 300, height: 80, margin: 100 }, "CODE128");
    expect(result.margin).toBe(40);
  });
});

// ── validator edge cases not in main test ────────────────────────────────────

describe("validateEan13 - additional edge cases", () => {
  it("rejects string with spaces", () => {
    expect(validateEan13("590123412 3457")).not.toBeNull();
  });

  it("rejects 14-digit string (too long)", () => {
    expect(validateEan13("59012341234570")).not.toBeNull();
  });
});

describe("validateCode128 - additional edge cases", () => {
  it("accepts control characters (ASCII 0-31 are valid Code128)", () => {
    // Tab (0x09) is ASCII 9 -- Code128 supports all 0-127
    expect(validateCode128("\t")).toBeNull();
  });

  it("accepts ASCII 127 (DEL is technically in range)", () => {
    expect(validateCode128(String.fromCharCode(127))).toBeNull();
  });

  it("rejects string with characters above 127", () => {
    expect(validateCode128("abcxyz")).not.toBeNull();
  });
});

describe("validateItf - additional edge cases", () => {
  it("accepts 14-digit ITF-14", () => {
    expect(validateItf("12345678901231")).toBeNull();
  });

  it("rejects single digit", () => {
    expect(validateItf("1")).not.toBeNull();
  });

  it("rejects string with decimal point", () => {
    expect(validateItf("12.34")).not.toBeNull();
  });
});
