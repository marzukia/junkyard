import { describe, expect, it } from "vitest";
import type { HashResult } from "./hash";
import { detectAlgos, matchedAlgo, rowMatchStatus } from "./verify";

describe("detectAlgos", () => {
  it("returns CRC32 for an 8-char hex string", () => {
    expect(detectAlgos("00000000")).toEqual(["CRC32"]);
  });

  it("returns MD5 for a 32-char hex string", () => {
    expect(detectAlgos("d41d8cd98f00b204e9800998ecf8427e")).toEqual(["MD5"]);
  });

  it("returns SHA-1 for a 40-char hex string", () => {
    expect(detectAlgos("da39a3ee5e6b4b0d3255bfef95601890afd80709")).toEqual(["SHA-1"]);
  });

  it("returns SHA-224 for a 56-char hex string", () => {
    expect(detectAlgos("d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f")).toEqual([
      "SHA-224",
    ]);
  });

  it("returns SHA-256 and SHA3-256 for a 64-char hex string (ambiguous)", () => {
    const result = detectAlgos("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(result).toContain("SHA-256");
    expect(result).toContain("SHA3-256");
  });

  it("returns SHA-384 for a 96-char hex string", () => {
    const result = detectAlgos(
      "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b"
    );
    expect(result).toEqual(["SHA-384"]);
  });

  it("returns SHA-512 and SHA3-512 for a 128-char hex string (ambiguous)", () => {
    const result = detectAlgos(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce" +
        "47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
    );
    expect(result).toContain("SHA-512");
    expect(result).toContain("SHA3-512");
  });

  it("returns empty array for non-hex input", () => {
    expect(detectAlgos("not-a-hash")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(detectAlgos("")).toEqual([]);
  });

  it("returns empty array for wrong length (not matching any algo)", () => {
    expect(detectAlgos("abcdef")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(detectAlgos("D41D8CD98F00B204E9800998ECF8427E")).toEqual(["MD5"]);
  });
});

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

describe("matchedAlgo", () => {
  it("matches MD5", () => {
    expect(matchedAlgo(makeResult(), "5d41402abc4b2a76b9719d911017c592")).toBe("MD5");
  });

  it("matches SHA-1", () => {
    expect(matchedAlgo(makeResult(), "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")).toBe("SHA-1");
  });

  it("matches SHA-256", () => {
    expect(
      matchedAlgo(makeResult(), "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
    ).toBe("SHA-256");
  });

  it("matches SHA-512", () => {
    expect(
      matchedAlgo(
        makeResult(),
        "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043"
      )
    ).toBe("SHA-512");
  });

  it("matches SHA3-256", () => {
    expect(
      matchedAlgo(makeResult(), "3338be694f50c5f338814986cdf0686453a888b84f424d792af4b9202398f392")
    ).toBe("SHA3-256");
  });

  it("matches CRC32", () => {
    expect(matchedAlgo(makeResult(), "3d653119")).toBe("CRC32");
  });

  it("returns null when target is empty", () => {
    expect(matchedAlgo(makeResult(), "")).toBeNull();
  });

  it("returns null when no algorithm matches", () => {
    expect(
      matchedAlgo(makeResult(), "0000000000000000000000000000000000000000000000000000000000000000")
    ).toBeNull();
  });

  it("is case-insensitive for the target", () => {
    expect(matchedAlgo(makeResult(), "5D41402ABC4B2A76B9719D911017C592")).toBe("MD5");
  });

  it("trims whitespace from the target", () => {
    expect(matchedAlgo(makeResult(), "  5d41402abc4b2a76b9719d911017c592  ")).toBe("MD5");
  });
});

// ── Bug fix: noisy per-row mismatch badges ─────────────────────────────────────
// Pasting a valid SHA-256 checksum must NOT show "mismatch" on MD5, SHA-1, etc.
describe("rowMatchStatus (bug fix: noisy mismatch)", () => {
  const result = makeResult();
  const sha256Target = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  it("shows 'match' on the SHA-256 row when SHA-256 checksum is pasted", () => {
    const matched = matchedAlgo(result, sha256Target);
    expect(rowMatchStatus("SHA-256", result.sha256, sha256Target, matched)).toBe("match");
  });

  it("shows null (not mismatch) on MD5 row when SHA-256 checksum is pasted", () => {
    const matched = matchedAlgo(result, sha256Target);
    expect(rowMatchStatus("MD5", result.md5, sha256Target, matched)).toBeNull();
  });

  it("shows null (not mismatch) on SHA-1 row when SHA-256 checksum is pasted", () => {
    const matched = matchedAlgo(result, sha256Target);
    expect(rowMatchStatus("SHA-1", result.sha1, sha256Target, matched)).toBeNull();
  });

  it("shows null (not mismatch) on SHA-512 row when SHA-256 checksum is pasted", () => {
    const matched = matchedAlgo(result, sha256Target);
    expect(rowMatchStatus("SHA-512", result.sha512, sha256Target, matched)).toBeNull();
  });

  it("shows 'mismatch' on SHA3-256 row (same length, wrong value) when SHA-256 target does not match it", () => {
    // SHA3-256 has same length as SHA-256 (64 chars), so it IS a candidate
    const matched = matchedAlgo(result, sha256Target);
    // sha256Target != result.sha3_256, so it should be mismatch (length match, value mismatch)
    expect(rowMatchStatus("SHA3-256", result.sha3_256, sha256Target, matched)).toBe("mismatch");
  });

  it("shows null on all rows when verify field is empty", () => {
    expect(rowMatchStatus("SHA-256", result.sha256, "", null)).toBeNull();
    expect(rowMatchStatus("MD5", result.md5, "", null)).toBeNull();
  });

  it("shows 'match' on MD5 row and null on SHA-256 row when MD5 hash pasted", () => {
    const md5Target = "5d41402abc4b2a76b9719d911017c592";
    const matched = matchedAlgo(result, md5Target);
    expect(rowMatchStatus("MD5", result.md5, md5Target, matched)).toBe("match");
    expect(rowMatchStatus("SHA-256", result.sha256, md5Target, matched)).toBeNull();
  });
});
