import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  decodeBase64,
  decodeBase64Url,
  decodeHex,
  decodeUrl,
  encodeBase64,
  encodeBase64Url,
  encodeHex,
  encodeUrl,
  isImageDataUri,
  looksLikeBase64,
  parseDataUri,
  stripDataUri,
} from "./base64";

// ── Standard Base64 ───────────────────────────────────────────────────────────

describe("encodeBase64 / decodeBase64", () => {
  it("round-trips ASCII text", () => {
    const original = "Hello, World!";
    expect(decodeBase64(encodeBase64(original))).toBe(original);
  });

  it("encodes ASCII to the canonical value", () => {
    expect(encodeBase64("Man")).toBe("TWFu");
    expect(encodeBase64("Ma")).toBe("TWE=");
    expect(encodeBase64("M")).toBe("TQ==");
  });

  it("round-trips emoji (UTF-8 multibyte)", () => {
    const original = "Hello 🌍 world 🎉";
    expect(decodeBase64(encodeBase64(original))).toBe(original);
  });

  it("round-trips CJK characters", () => {
    const original = "日本語テスト";
    expect(decodeBase64(encodeBase64(original))).toBe(original);
  });

  it("round-trips empty string", () => {
    expect(decodeBase64(encodeBase64(""))).toBe("");
    expect(encodeBase64("")).toBe("");
  });

  it("throws on invalid Base64", () => {
    expect(() => decodeBase64("!!!invalid!!!")).toThrow();
  });
});

// ── URL-safe Base64 ───────────────────────────────────────────────────────────

describe("encodeBase64Url / decodeBase64Url", () => {
  it("produces no + / = characters", () => {
    // Run enough text that + and / appear in standard Base64
    const encoded = encodeBase64Url("Hello, World! This is a test string with enough data.");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("round-trips ASCII text", () => {
    const original = "Hello, World!";
    expect(decodeBase64Url(encodeBase64Url(original))).toBe(original);
  });

  it("round-trips emoji", () => {
    const original = "Emoji 🚀🎯";
    expect(decodeBase64Url(encodeBase64Url(original))).toBe(original);
  });

  it("contains - and _ instead of + and /", () => {
    // Standard base64 of ">>?" is "Pj4/" — URL-safe replaces / with _
    const std = encodeBase64(">>?");
    const url = encodeBase64Url(">>?");
    expect(std).toContain("/");
    expect(url).not.toContain("/");
    expect(url).toContain("_");
  });
});

// ── URL encoding ──────────────────────────────────────────────────────────────

describe("encodeUrl / decodeUrl", () => {
  it("encodes special characters", () => {
    expect(encodeUrl("hello world")).toBe("hello%20world");
    expect(encodeUrl("a=b&c=d")).toBe("a%3Db%26c%3Dd");
  });

  it("round-trips", () => {
    const original = "https://example.com/path?q=hello world&emoji=🎉";
    expect(decodeUrl(encodeUrl(original))).toBe(original);
  });

  it("throws on malformed percent-encoding", () => {
    expect(() => decodeUrl("%zz")).toThrow();
  });
});

// ── bytesToBase64 / base64ToBytes ─────────────────────────────────────────────

describe("bytesToBase64 / base64ToBytes", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff]);
    const encoded = bytesToBase64(bytes);
    const decoded = base64ToBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it("round-trips a known PNG magic header", () => {
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    const magic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(Array.from(base64ToBytes(bytesToBase64(magic)))).toEqual(Array.from(magic));
  });
});

// ── stripDataUri ──────────────────────────────────────────────────────────────

describe("stripDataUri", () => {
  it("strips data-URI prefix", () => {
    expect(stripDataUri("data:image/png;base64,abc123")).toBe("abc123");
    expect(stripDataUri("data:text/plain;base64,SGVsbG8=")).toBe("SGVsbG8=");
  });

  it("returns string unchanged if no data-URI prefix", () => {
    expect(stripDataUri("SGVsbG8=")).toBe("SGVsbG8=");
  });
});

// ── isImageDataUri ────────────────────────────────────────────────────────────

describe("isImageDataUri", () => {
  it("detects image data-URIs", () => {
    expect(isImageDataUri("data:image/png;base64,abc")).toBe(true);
    expect(isImageDataUri("data:image/jpeg;base64,abc")).toBe(true);
    expect(isImageDataUri("data:image/gif;base64,abc")).toBe(true);
  });

  it("rejects non-image data-URIs and plain Base64", () => {
    expect(isImageDataUri("data:text/plain;base64,abc")).toBe(false);
    expect(isImageDataUri("SGVsbG8=")).toBe(false);
  });
});

// ── Hex encoding ──────────────────────────────────────────────────────────────

describe("encodeHex / decodeHex", () => {
  it("encodes ASCII to lowercase hex", () => {
    expect(encodeHex("Hello")).toBe("48656c6c6f");
    expect(encodeHex("A")).toBe("41");
  });

  it("round-trips ASCII text", () => {
    const original = "Hello, World!";
    expect(decodeHex(encodeHex(original))).toBe(original);
  });

  it("round-trips emoji", () => {
    const original = "Hi 🎉";
    expect(decodeHex(encodeHex(original))).toBe(original);
  });

  it("round-trips empty string", () => {
    expect(encodeHex("")).toBe("");
    expect(decodeHex("")).toBe("");
  });

  it("accepts space and colon separators when decoding", () => {
    expect(decodeHex("48 65 6c 6c 6f")).toBe("Hello");
    expect(decodeHex("48:65:6c:6c:6f")).toBe("Hello");
  });

  it("throws on invalid hex characters", () => {
    expect(() => decodeHex("zzzz")).toThrow();
  });

  it("throws on odd-length hex string", () => {
    expect(() => decodeHex("abc")).toThrow();
  });
});

describe("bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0x00, 0xff, 0x0f]))).toBe("00ff0f");
  });

  it("round-trips with base64ToBytes+encodeBase64", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(bytesToHex(bytes)).toBe("48656c6c6f");
  });
});

// ── looksLikeBase64 ───────────────────────────────────────────────────────────

describe("looksLikeBase64", () => {
  it("returns true for valid base64 strings (min 12 chars)", () => {
    expect(looksLikeBase64("SGVsbG8sIFdvcmxkIQ==")).toBe(true);
    // Short strings are below the threshold deliberately (avoid false positives on short words)
    expect(looksLikeBase64("dGVzdA==")).toBe(false);
    expect(looksLikeBase64("aGVsbG93b3JsZA==")).toBe(true);
  });

  it("returns true for data-URIs", () => {
    expect(looksLikeBase64("data:image/png;base64,abc123")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(looksLikeBase64("Hello, World!")).toBe(false);
    expect(looksLikeBase64("this is just text")).toBe(false);
  });

  it("returns false for short strings", () => {
    expect(looksLikeBase64("abc")).toBe(false);
  });

  it("returns false for strings with many non-base64 chars", () => {
    expect(looksLikeBase64("Hello, World! @#$ <>")).toBe(false);
  });
});

// ── parseDataUri ──────────────────────────────────────────────────────────────

describe("parseDataUri", () => {
  it("parses a data-URI", () => {
    const result = parseDataUri("data:image/png;base64,abc123");
    expect(result).toEqual({ mime: "image/png", data: "abc123" });
  });

  it("returns null for non-data-URI strings", () => {
    expect(parseDataUri("SGVsbG8=")).toBeNull();
    expect(parseDataUri("hello world")).toBeNull();
  });
});
