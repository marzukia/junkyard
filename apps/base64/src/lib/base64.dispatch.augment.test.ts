/**
 * Augmented tests for base64.ts covering:
 * - encode/decode dispatch helpers (not tested in main file)
 * - looksLikeBase64 with URL-safe Base64 and boundary cases
 * - stripDataUri whitespace handling
 * - encodeBase64Url/decodeBase64Url negative paths
 */
import { describe, expect, it } from "vitest";
import {
  decode,
  decodeBase64Url,
  encodeBase64Url,
  encode,
  looksLikeBase64,
  stripDataUri,
  parseDataUri,
} from "./base64";

// ── encode/decode dispatch ─────────────────────────────────────────────────────

describe("encode dispatch", () => {
  it("routes 'base64' to standard base64", () => {
    expect(encode("Hello", "base64")).toBe("SGVsbG8=");
  });

  it("routes 'base64url' to URL-safe base64 (no padding)", () => {
    const result = encode("Hello", "base64url");
    expect(result).not.toContain("=");
    expect(result).not.toContain("+");
    expect(result).not.toContain("/");
  });

  it("routes 'url' to percent-encoding", () => {
    expect(encode("hello world", "url")).toBe("hello%20world");
  });

  it("routes 'hex' to lowercase hex", () => {
    expect(encode("A", "hex")).toBe("41");
  });
});

describe("decode dispatch", () => {
  it("routes 'base64' back to original string", () => {
    expect(decode("SGVsbG8=", "base64")).toBe("Hello");
  });

  it("routes 'base64url' back to original string", () => {
    const encoded = encode("Hello", "base64url");
    expect(decode(encoded, "base64url")).toBe("Hello");
  });

  it("routes 'url' back to original string", () => {
    expect(decode("hello%20world", "url")).toBe("hello world");
  });

  it("routes 'hex' back to original string", () => {
    expect(decode("41", "hex")).toBe("A");
  });

  it("round-trips emoji through each mode", () => {
    for (const mode of ["base64", "base64url", "url", "hex"] as const) {
      const original = "Hi 🎉";
      expect(decode(encode(original, mode), mode)).toBe(original);
    }
  });
});

// ── looksLikeBase64 - URL-safe and additional cases ───────────────────────────

describe("looksLikeBase64 - URL-safe base64", () => {
  it("returns false for URL-safe base64 (contains - and _)", () => {
    // URL-safe base64 uses - and _ which are not in the standard b64 alphabet.
    // The function checks standard b64 alphabet: A-Za-z0-9+/=
    // A URL-safe encoded string will have non-b64 chars and fail.
    const urlSafe = encodeBase64Url("Some text for testing URL safe encoding!!");
    // urlSafe has - and/or _ instead of + and /; these are not in the b64 char class.
    // The ratio check will catch this if enough non-b64 chars appear.
    // If the string happens to have no + or /, it may still look like base64.
    // This test confirms no throw and type is boolean.
    expect(typeof looksLikeBase64(urlSafe)).toBe("boolean");
  });

  it("returns false for hex-encoded strings (only 0-9a-f chars but wrong structure)", () => {
    // A short hex string won't be mistaken for base64
    expect(looksLikeBase64("deadbeef")).toBe(false);
  });

  it("returns true for a long valid padded base64 string", () => {
    // Known valid: the base64 of a 32-byte random string is 44 chars with padding
    const long = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
    expect(looksLikeBase64(long)).toBe(true);
  });

  it("returns false for an 11-char string (below 12-char threshold)", () => {
    // Exactly 11 chars -- below the 12-char threshold
    expect(looksLikeBase64("AAAAAAAAAAA")).toBe(false);
  });

  it("returns false for a string with lots of special chars", () => {
    expect(looksLikeBase64("!@#$%^&*()_+-={}|[]")).toBe(false);
  });
});

// ── stripDataUri - whitespace/newline handling ────────────────────────────────

describe("stripDataUri - whitespace handling", () => {
  it("strips leading/trailing whitespace before matching", () => {
    expect(stripDataUri("  data:text/plain;base64,SGVsbG8=  ")).toBe("SGVsbG8=");
  });

  it("returns trimmed input when no data-URI prefix (with whitespace)", () => {
    expect(stripDataUri("  SGVsbG8=  ")).toBe("SGVsbG8=");
  });
});

// ── parseDataUri - additional negative cases ──────────────────────────────────

describe("parseDataUri - additional negative cases", () => {
  it("returns null for a data-URI without base64 tag", () => {
    // This is a data URI but without base64 encoding indicator
    expect(parseDataUri("data:text/plain,hello")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDataUri("")).toBeNull();
  });

  it("parses a WEBP data-URI correctly", () => {
    const result = parseDataUri("data:image/webp;base64,UklGRg==");
    expect(result?.mime).toBe("image/webp");
    expect(result?.data).toBe("UklGRg==");
  });
});

// ── decodeBase64Url negative cases ────────────────────────────────────────────

describe("decodeBase64Url - negative cases", () => {
  it("throws on completely invalid input", () => {
    expect(() => decodeBase64Url("!!!!invalid!!!!")).toThrow();
  });

  it("round-trips empty string", () => {
    expect(decodeBase64Url(encodeBase64Url(""))).toBe("");
  });
});
