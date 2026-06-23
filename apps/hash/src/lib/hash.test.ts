/**
 * Unit tests for the pure hash logic.
 * SubtleCrypto is available in vitest's jsdom environment via globalThis.crypto.
 * We test known reference vectors for all algorithms.
 */
import { describe, expect, it } from "vitest";
import {
  crc32Hex,
  encodeOutput,
  hashAll,
  hexToBase64,
  hmacHex,
  md5Hex,
  sha1Hex,
  sha3_256Hex,
  sha3_512Hex,
  sha224Hex,
  sha256Hex,
  sha384Hex,
  sha512Hex,
} from "./hash";

describe("md5Hex", () => {
  it("hashes the empty string to the RFC reference", () => {
    expect(md5Hex("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it('hashes "abc" correctly', () => {
    expect(md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it('hashes "The quick brown fox jumps over the lazy dog"', () => {
    expect(md5Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "9e107d9d372bb6826bd81d3542a419d6"
    );
  });

  it("accepts ArrayBuffer input", () => {
    const buf = new TextEncoder().encode("abc").buffer as ArrayBuffer;
    expect(md5Hex(buf)).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});

describe("sha1Hex", () => {
  it("hashes empty string to the FIPS 180 reference", async () => {
    expect(await sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });

  it('hashes "abc"', async () => {
    expect(await sha1Hex("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });
});

describe("sha224Hex", () => {
  it("hashes empty string to the FIPS reference", async () => {
    expect(await sha224Hex("")).toBe("d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f");
  });

  it('hashes "abc"', async () => {
    expect(await sha224Hex("abc")).toBe("23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7");
  });
});

describe("sha256Hex", () => {
  it("hashes empty string to the FIPS reference", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it('hashes "abc"', async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("sha384Hex", () => {
  it("hashes empty string to the FIPS reference", async () => {
    expect(await sha384Hex("")).toBe(
      "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b"
    );
  });
});

describe("sha512Hex", () => {
  it("hashes empty string to the FIPS reference", async () => {
    expect(await sha512Hex("")).toBe(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce" +
        "47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
    );
  });
});

describe("sha3_256Hex", () => {
  it("hashes empty string to the NIST reference", () => {
    expect(sha3_256Hex("")).toBe(
      "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"
    );
  });

  it('hashes "abc" to the NIST reference', () => {
    expect(sha3_256Hex("abc")).toBe(
      "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"
    );
  });
});

describe("sha3_512Hex", () => {
  it("hashes empty string to the NIST reference", () => {
    expect(sha3_512Hex("")).toBe(
      "a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a6" +
        "15b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26"
    );
  });
});

describe("crc32Hex", () => {
  it("returns 00000000 for empty input", () => {
    expect(crc32Hex("")).toBe("00000000");
  });

  it('hashes "abc" to the standard reference', () => {
    expect(crc32Hex("abc")).toBe("352441c2");
  });

  it('hashes "The quick brown fox jumps over the lazy dog"', () => {
    expect(crc32Hex("The quick brown fox jumps over the lazy dog")).toBe("414fa339");
  });
});

describe("hmacHex", () => {
  it("computes HMAC-SHA-256 with known test vector (RFC 4231, case 1)", async () => {
    // key = 0x0b * 20, data = "Hi There"
    const key = new Uint8Array(20).fill(0x0b).buffer as ArrayBuffer;
    const msg = new TextEncoder().encode("Hi There").buffer as ArrayBuffer;
    const result = await hmacHex("SHA-256", key, msg);
    expect(result).toBe("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  });

  it("produces consistent results for string key and message", async () => {
    const r1 = await hmacHex("SHA-256", "key", "message");
    const r2 = await hmacHex("SHA-256", "key", "message");
    expect(r1).toBe(r2);
    expect(r1).toHaveLength(64);
  });

  it("returns different results for different keys", async () => {
    const r1 = await hmacHex("SHA-256", "key1", "message");
    const r2 = await hmacHex("SHA-256", "key2", "message");
    expect(r1).not.toBe(r2);
  });
});

describe("hexToBase64", () => {
  it("converts empty hex to empty base64", () => {
    expect(hexToBase64("")).toBe("");
  });

  it("converts known bytes correctly", () => {
    // 0x48656c6c6f = "Hello"
    expect(hexToBase64("48656c6c6f")).toBe("SGVsbG8=");
  });

  it("produces URL-safe base64 when requested", () => {
    // Use a value known to produce + or / in standard base64
    const b64 = hexToBase64("fb", false);
    const b64url = hexToBase64("fb", true);
    // Standard may have + or /; url-safe should not
    expect(b64url).not.toMatch(/[+/=]/);
    // Values should be consistent (same bytes, just re-encoded)
    expect(b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")).toBe(b64url);
  });
});

describe("encodeOutput", () => {
  const hex = "48656c6c6f";

  it("returns lowercase hex", () => {
    expect(encodeOutput(hex, "hex", false)).toBe("48656c6c6f");
  });

  it("returns uppercase hex", () => {
    expect(encodeOutput(hex, "hex", true)).toBe("48656C6C6F");
  });

  it("returns base64 (uppercase flag ignored)", () => {
    expect(encodeOutput(hex, "base64", false)).toBe("SGVsbG8=");
    expect(encodeOutput(hex, "base64", true)).toBe("SGVsbG8=");
  });

  it("returns url-safe base64", () => {
    expect(encodeOutput(hex, "base64url", false)).not.toMatch(/[+/=]/);
  });
});

describe("hashAll", () => {
  it('returns all hashes for "hello"', async () => {
    const result = await hashAll("hello");
    expect(result.md5).toBe("5d41402abc4b2a76b9719d911017c592");
    expect(result.sha1).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
    expect(result.sha256).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(result.sha512).toBe(
      "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043"
    );
    // new fields present
    expect(result.sha224).toHaveLength(56);
    expect(result.sha384).toHaveLength(96);
    expect(result.sha3_256).toHaveLength(64);
    expect(result.sha3_512).toHaveLength(128);
    expect(result.crc32).toHaveLength(8);
  });
});
