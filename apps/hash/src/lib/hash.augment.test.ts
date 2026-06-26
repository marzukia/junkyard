/**
 * Augmented tests for hash.ts and verify.ts.
 * Covers negative/edge pathways not reached by the existing tests.
 */
import { describe, expect, it } from "vitest";
import {
  crc32Hex,
  encodeOutput,
  hexToBase64,
  md5Hex,
  sha3_256Hex,
  sha3_512Hex,
  sha224Hex,
} from "./hash";
import type { HashResult } from "./hash";
import { ALGO_LENGTHS, detectAlgos, matchedAlgo, rowMatchStatus } from "./verify";

// ── md5Hex negative/edge cases ────────────────────────────────────────────────

describe("md5Hex — edge and negative cases", () => {
  it("produces a 32-character lowercase hex string", () => {
    const result = md5Hex("hello");
    expect(result).toHaveLength(32);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("two distinct inputs produce different hashes", () => {
    expect(md5Hex("foo")).not.toBe(md5Hex("bar"));
  });

  it("handles input with null byte", () => {
    const result = md5Hex("a\x00b");
    expect(result).toHaveLength(32);
    // Known MD5 of "a\0b"
    expect(result).not.toBe(md5Hex("ab"));
  });

  it("handles Unicode (multi-byte UTF-8) input", () => {
    const result = md5Hex("café");
    expect(result).toHaveLength(32);
    // Must differ from plain ASCII "cafe"
    expect(result).not.toBe(md5Hex("cafe"));
  });

  it("handles very long string without throwing", () => {
    const long = "x".repeat(10000);
    expect(() => md5Hex(long)).not.toThrow();
    expect(md5Hex(long)).toHaveLength(32);
  });
});

// ── crc32Hex negative/edge cases ─────────────────────────────────────────────

describe("crc32Hex — edge and negative cases", () => {
  it("produces an 8-character lowercase hex string for any input", () => {
    const result = crc32Hex("test string");
    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("single-byte inputs differ from empty", () => {
    expect(crc32Hex("a")).not.toBe(crc32Hex(""));
    expect(crc32Hex("b")).not.toBe(crc32Hex("a"));
  });

  it("is case-sensitive (different results for uppercase)", () => {
    expect(crc32Hex("hello")).not.toBe(crc32Hex("Hello"));
  });

  it("handles binary-like ArrayBuffer input", () => {
    const buf = new Uint8Array([0x00, 0xff, 0x10, 0x20]).buffer as ArrayBuffer;
    const result = crc32Hex(buf);
    expect(result).toHaveLength(8);
  });
});

// ── sha224Hex negative/edge cases ────────────────────────────────────────────

describe("sha224Hex — additional cases", () => {
  it('hashes "abc" to the FIPS reference', async () => {
    expect(await sha224Hex("abc")).toBe("23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7");
  });

  it("produces 56-char hex output always", async () => {
    const result = await sha224Hex("any string here 123");
    expect(result).toHaveLength(56);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

// ── sha3 edge cases ───────────────────────────────────────────────────────────

describe("sha3 — edge cases", () => {
  it("sha3_256 handles multi-byte Unicode input", () => {
    const result = sha3_256Hex("éàü");
    expect(result).toHaveLength(64);
    expect(result).not.toBe(sha3_256Hex("eau"));
  });

  it("sha3_512 output is always 128 chars", () => {
    const result = sha3_512Hex("x".repeat(200));
    expect(result).toHaveLength(128);
  });
});

// ── hexToBase64 negative cases ────────────────────────────────────────────────

describe("hexToBase64 — negative cases", () => {
  it("handles a single byte (2 hex chars)", () => {
    // 0x41 = 'A' in ASCII
    expect(hexToBase64("41")).toBe("QQ==");
  });

  it("URL-safe output never contains +, / or = padding", () => {
    // Use a known value that produces + or / in base64
    const urlSafe = hexToBase64("fb", true);
    expect(urlSafe).not.toMatch(/[+/=]/);
  });

  it("standard output for the same bytes differs from url-safe only in padding/chars", () => {
    const standard = hexToBase64("fbe9", false);
    const urlSafe = hexToBase64("fbe9", true);
    // Should decode to the same bytes
    expect(standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")).toBe(urlSafe);
  });
});

// ── encodeOutput negative cases ───────────────────────────────────────────────

describe("encodeOutput — negative cases", () => {
  it("hex encoding preserves all zeros", () => {
    expect(encodeOutput("00000000", "hex", false)).toBe("00000000");
    expect(encodeOutput("00000000", "hex", true)).toBe("00000000");
  });

  it("base64url output never has + / = characters", () => {
    // Use a hex string that would contain + or / in base64
    const result = encodeOutput("fbe9fb", "base64url", false);
    expect(result).not.toMatch(/[+/=]/);
  });
});

// ── ALGO_LENGTHS constant ─────────────────────────────────────────────────────

describe("ALGO_LENGTHS", () => {
  it("all lengths are positive integers", () => {
    for (const len of Object.values(ALGO_LENGTHS)) {
      expect(len).toBeGreaterThan(0);
      expect(Number.isInteger(len)).toBe(true);
    }
  });

  it("SHA-256 and SHA3-256 both have length 64", () => {
    expect(ALGO_LENGTHS["SHA-256"]).toBe(64);
    expect(ALGO_LENGTHS["SHA3-256"]).toBe(64);
  });

  it("SHA-512 and SHA3-512 both have length 128", () => {
    expect(ALGO_LENGTHS["SHA-512"]).toBe(128);
    expect(ALGO_LENGTHS["SHA3-512"]).toBe(128);
  });
});

// ── detectAlgos negative cases ────────────────────────────────────────────────

describe("detectAlgos — additional negative cases", () => {
  it("returns empty for whitespace-only input", () => {
    expect(detectAlgos("   ")).toEqual([]);
  });

  it("returns empty for hex string with wrong length (10 chars)", () => {
    expect(detectAlgos("abcdef1234")).toEqual([]);
  });

  it("returns empty for hex that contains spaces", () => {
    // Valid MD5 length but with embedded space
    expect(detectAlgos("d41d8cd9 8f00b204e9800998ecf8427e")).toEqual([]);
  });
});

// ── matchedAlgo negative cases ────────────────────────────────────────────────

const makeResult = (): HashResult => ({
  md5: "5d41402abc4b2a76b9719d911017c592",
  sha1: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d",
  sha224: "ea09ae9cc6768c50fcee903ed054556e5bfc8347907f12598aa24193",
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  sha384:
    "59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f",
  sha512:
    "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043",
  sha3_256: "3338be694f50c5f338814986cdf0686453a888b84f424d792af4b9202398f392",
  sha3_512:
    "75d527c368f2efe848ecf6b073a36767800805e9eef2b1857d5f984f036eb6df891d75f72d9b154518c1cd58835286d1da9a38deba3de98b5a53e5ed78a84976",
  crc32: "3d653119",
});

describe("matchedAlgo — additional negative cases", () => {
  it("returns null when target is whitespace-only", () => {
    expect(matchedAlgo(makeResult(), "   ")).toBeNull();
  });

  it("returns null for a valid-length hex that matches no field", () => {
    // 8-char hex that does NOT match crc32 "3d653119"
    expect(matchedAlgo(makeResult(), "00000000")).toBeNull();
  });

  it("matches SHA-224", () => {
    expect(
      matchedAlgo(makeResult(), "ea09ae9cc6768c50fcee903ed054556e5bfc8347907f12598aa24193")
    ).toBe("SHA-224");
  });

  it("matches SHA-384", () => {
    expect(
      matchedAlgo(
        makeResult(),
        "59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f"
      )
    ).toBe("SHA-384");
  });

  it("matches SHA3-512", () => {
    expect(
      matchedAlgo(
        makeResult(),
        "75d527c368f2efe848ecf6b073a36767800805e9eef2b1857d5f984f036eb6df891d75f72d9b154518c1cd58835286d1da9a38deba3de98b5a53e5ed78a84976"
      )
    ).toBe("SHA3-512");
  });
});

// ── rowMatchStatus additional cases ──────────────────────────────────────────

describe("rowMatchStatus — additional cases", () => {
  const result = makeResult();

  it("returns 'mismatch' on CRC32 row when a different 8-char hex is pasted", () => {
    const matched = matchedAlgo(result, "00000000");
    // "00000000" has length 8 => candidate for CRC32, but doesn't match
    expect(rowMatchStatus("CRC32", result.crc32, "00000000", matched)).toBe("mismatch");
  });

  it("returns null on MD5 row when a 40-char SHA-1 hash is pasted (length mismatch)", () => {
    const sha1Target = "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d";
    const matched = matchedAlgo(result, sha1Target);
    expect(rowMatchStatus("MD5", result.md5, sha1Target, matched)).toBeNull();
  });

  it("returns 'match' on SHA3-512 row when SHA3-512 hash matches", () => {
    const sha3_512Target =
      "75d527c368f2efe848ecf6b073a36767800805e9eef2b1857d5f984f036eb6df891d75f72d9b154518c1cd58835286d1da9a38deba3de98b5a53e5ed78a84976";
    const matched = matchedAlgo(result, sha3_512Target);
    expect(rowMatchStatus("SHA3-512", result.sha3_512, sha3_512Target, matched)).toBe("match");
  });
});
