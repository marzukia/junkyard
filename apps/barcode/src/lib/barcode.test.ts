import { describe, expect, it } from "vitest";
import {
  FORMAT_META,
  clampSize,
  ean8Autofix,
  ean8CheckDigit,
  ean13Autofix,
  ean13CheckDigit,
  upcaAutofix,
  upcaCheckDigit,
  validateCode39,
  validateCode93,
  validateCode128,
  validateEan8,
  validateEan13,
  validateItf,
  validateUpca,
} from "./barcode";

describe("ean13CheckDigit", () => {
  it("computes correct check digit for known EAN-13", () => {
    // 590123412345 -> check digit 7
    expect(ean13CheckDigit("590123412345")).toBe(7);
  });

  it("computes check digit for all-zeros prefix", () => {
    // 000000000000 -> sum=0 -> check digit=0
    expect(ean13CheckDigit("000000000000")).toBe(0);
  });

  it("throws if not 12 digits", () => {
    expect(() => ean13CheckDigit("12345")).toThrow();
  });
});

describe("validateEan13", () => {
  it("accepts a valid 13-digit EAN-13", () => {
    expect(validateEan13("5901234123457")).toBeNull();
  });

  it("rejects if not 13 digits", () => {
    expect(validateEan13("123456789012")).not.toBeNull();
  });

  it("rejects non-digit characters", () => {
    expect(validateEan13("590123412345X")).not.toBeNull();
  });

  it("rejects a wrong check digit", () => {
    // 5901234123456 has wrong last digit (should be 7)
    expect(validateEan13("5901234123456")).not.toBeNull();
  });
});

describe("upcaCheckDigit", () => {
  it("computes correct check digit for known UPC-A", () => {
    // 01234567890 -> check digit 5
    expect(upcaCheckDigit("01234567890")).toBe(5);
  });

  it("throws if not 11 digits", () => {
    expect(() => upcaCheckDigit("123")).toThrow();
  });
});

describe("validateUpca", () => {
  it("accepts a valid 12-digit UPC-A", () => {
    expect(validateUpca("012345678905")).toBeNull();
  });

  it("rejects if not 12 digits", () => {
    expect(validateUpca("01234567890")).not.toBeNull();
  });

  it("rejects wrong check digit", () => {
    expect(validateUpca("012345678900")).not.toBeNull();
  });
});

describe("validateCode128", () => {
  it("accepts plain ASCII text", () => {
    expect(validateCode128("Hello World 123")).toBeNull();
  });

  it("accepts all printable ASCII", () => {
    expect(validateCode128("!@#$%^&*()")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateCode128("")).not.toBeNull();
  });

  it("rejects characters above ASCII 127", () => {
    expect(validateCode128("café")).not.toBeNull();
  });
});

describe("validateCode39", () => {
  it("accepts uppercase letters and digits", () => {
    expect(validateCode39("CODE39")).toBeNull();
  });

  it("is case-insensitive (lowercased input accepted)", () => {
    expect(validateCode39("code39")).toBeNull();
  });

  it("accepts allowed special characters", () => {
    expect(validateCode39("AB-C.D $E/F+G%H")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateCode39("")).not.toBeNull();
  });

  it("rejects characters not in the Code39 charset", () => {
    expect(validateCode39("HELLO@WORLD")).not.toBeNull();
  });
});

describe("validateItf", () => {
  it("accepts even-length digit strings", () => {
    expect(validateItf("12345678901231")).toBeNull();
  });

  it("accepts minimum 2 digits", () => {
    expect(validateItf("12")).toBeNull();
  });

  it("rejects odd-length digit strings", () => {
    expect(validateItf("123")).not.toBeNull();
  });

  it("rejects non-digit characters", () => {
    expect(validateItf("12AB34")).not.toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateItf("")).not.toBeNull();
  });
});

describe("FORMAT_META", () => {
  it("has entries for all expected formats", () => {
    const expected = ["CODE128", "EAN13", "UPC", "CODE39", "ITF"];
    for (const fmt of expected) {
      expect(FORMAT_META).toHaveProperty(fmt);
    }
  });

  it("each format has a non-empty label and placeholder", () => {
    for (const meta of Object.values(FORMAT_META)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.placeholder.length).toBeGreaterThan(0);
    }
  });
});

describe("clampSize", () => {
  it("clamps width to format minimum", () => {
    const result = clampSize({ width: 10, height: 80, margin: 10 }, "CODE128");
    expect(result.width).toBeGreaterThanOrEqual(200);
  });

  it("clamps width to maximum", () => {
    const result = clampSize({ width: 9999, height: 80, margin: 10 }, "CODE128");
    expect(result.width).toBe(600);
  });

  it("clamps height to minimum", () => {
    const result = clampSize({ width: 300, height: 5, margin: 10 }, "CODE128");
    expect(result.height).toBe(40);
  });

  it("clamps margin to 0 minimum", () => {
    const result = clampSize({ width: 300, height: 80, margin: -5 }, "CODE128");
    expect(result.margin).toBe(0);
  });
});

describe("ean8CheckDigit", () => {
  it("computes correct check digit for known EAN-8 (96385074)", () => {
    // 9638507 -> check digit 4
    expect(ean8CheckDigit("9638507")).toBe(4);
  });

  it("computes check digit for all-zeros prefix", () => {
    // 0000000 -> sum=0 -> check digit 0
    expect(ean8CheckDigit("0000000")).toBe(0);
  });

  it("throws if not 7 digits", () => {
    expect(() => ean8CheckDigit("123")).toThrow();
  });
});

describe("validateEan8", () => {
  it("accepts a valid 8-digit EAN-8", () => {
    expect(validateEan8("96385074")).toBeNull();
  });

  it("rejects if not 8 digits", () => {
    expect(validateEan8("9638507")).not.toBeNull();
  });

  it("rejects wrong check digit", () => {
    // last digit should be 4, not 5
    expect(validateEan8("96385075")).not.toBeNull();
  });

  it("rejects non-digit characters", () => {
    expect(validateEan8("9638507X")).not.toBeNull();
  });
});

describe("ean13Autofix", () => {
  it("appends check digit when exactly 12 digits given", () => {
    const result = ean13Autofix("590123412345");
    expect(result.appended).toBe(true);
    expect(result.value).toBe("5901234123457");
  });

  it("returns unchanged value when 13 digits given", () => {
    const result = ean13Autofix("5901234123457");
    expect(result.appended).toBe(false);
    expect(result.value).toBe("5901234123457");
  });

  it("returns unchanged value when non-digit input given", () => {
    const result = ean13Autofix("abcdefghijkl");
    expect(result.appended).toBe(false);
  });
});

describe("upcaAutofix", () => {
  it("appends check digit when exactly 11 digits given", () => {
    const result = upcaAutofix("01234567890");
    expect(result.appended).toBe(true);
    expect(result.value).toBe("012345678905");
  });

  it("returns unchanged value when 12 digits given", () => {
    const result = upcaAutofix("012345678905");
    expect(result.appended).toBe(false);
    expect(result.value).toBe("012345678905");
  });
});

describe("ean8Autofix", () => {
  it("appends check digit when exactly 7 digits given", () => {
    const result = ean8Autofix("9638507");
    expect(result.appended).toBe(true);
    expect(result.value).toBe("96385074");
  });

  it("returns unchanged value when 8 digits given", () => {
    const result = ean8Autofix("96385074");
    expect(result.appended).toBe(false);
    expect(result.value).toBe("96385074");
  });
});

describe("validateCode93", () => {
  it("accepts uppercase letters and digits", () => {
    expect(validateCode93("CODE93")).toBeNull();
  });

  it("is case-insensitive (lowercased input accepted)", () => {
    expect(validateCode93("code93")).toBeNull();
  });

  it("accepts allowed special characters", () => {
    expect(validateCode93("AB-C.D $E/F+G%H")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(validateCode93("")).not.toBeNull();
  });

  it("rejects characters not in the Code93 charset", () => {
    expect(validateCode93("HELLO@WORLD")).not.toBeNull();
  });
});
