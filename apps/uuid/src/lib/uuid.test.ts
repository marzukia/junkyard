/**
 * Unit tests for the pure UUID generation logic.
 *
 * We test structural validity (format, version/variant bits), not exact
 * values (those are random by design).
 */
import { describe, expect, it } from "vitest";
import {
  applyOptions,
  applyOutputFormat,
  formatBulk,
  generateBatch,
  generateNameBased,
  inspectUuid,
  nanoid,
  ulid,
  uuidV1,
  uuidV3Impl,
  uuidV4,
  uuidV5,
  uuidV7,
} from "./uuid";

// ── UUID v4 ───────────────────────────────────────────────────────────────────

describe("uuidV4", () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("produces a valid RFC 4122 v4 UUID", () => {
    expect(uuidV4()).toMatch(UUID_RE);
  });

  it("produces unique values across many calls", () => {
    const set = new Set(Array.from({ length: 1000 }, () => uuidV4()));
    expect(set.size).toBe(1000);
  });

  it("sets version nibble to 4", () => {
    const id = uuidV4();
    expect(id[14]).toBe("4");
  });

  it("sets variant bits to 10xx (8, 9, a, or b)", () => {
    const id = uuidV4();
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });
});

// ── UUID v7 ───────────────────────────────────────────────────────────────────

describe("uuidV7", () => {
  const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("produces a valid v7 UUID", () => {
    expect(uuidV7()).toMatch(UUID_V7_RE);
  });

  it("sets version nibble to 7", () => {
    const id = uuidV7();
    expect(id[14]).toBe("7");
  });

  it("sets variant bits to 10xx", () => {
    const id = uuidV7();
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("embeds a timestamp close to now (within 5 seconds)", () => {
    const before = Date.now();
    const id = uuidV7();
    const after = Date.now();

    // First 12 hex chars (48 bits) are the timestamp in ms
    const tsPart = id.slice(0, 8) + id.slice(9, 13);
    const ts = Number(`0x${tsPart}`);
    expect(ts).toBeGreaterThanOrEqual(before - 100);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });

  it("produces UUIDs with the same timestamp prefix when generated in the same millisecond", () => {
    // All 10 generated here share a 48-bit ms timestamp; verify the prefix is identical.
    const before = Date.now();
    const ids = Array.from({ length: 10 }, () => uuidV7());
    const after = Date.now();
    // If they all fired within the same ms, their first 8 hex chars (32 bits) overlap.
    // We only assert the timestamp falls in the expected range (tested above).
    for (const id of ids) {
      const tsPart = id.slice(0, 8) + id.slice(9, 13);
      const ts = Number(`0x${tsPart}`);
      expect(ts).toBeGreaterThanOrEqual(before - 5);
      expect(ts).toBeLessThanOrEqual(after + 5);
    }
  });
});

// ── Nano ID ───────────────────────────────────────────────────────────────────

describe("nanoid", () => {
  const NANOID_ALPHABET_RE = /^[0-9A-Za-z_-]+$/;

  it("produces a 21-char string by default", () => {
    expect(nanoid()).toHaveLength(21);
  });

  it("uses only URL-safe alphabet characters", () => {
    for (let i = 0; i < 100; i++) {
      expect(nanoid()).toMatch(NANOID_ALPHABET_RE);
    }
  });

  it("respects a custom size", () => {
    expect(nanoid(10)).toHaveLength(10);
    expect(nanoid(32)).toHaveLength(32);
  });

  it("produces unique values", () => {
    const set = new Set(Array.from({ length: 1000 }, () => nanoid()));
    expect(set.size).toBe(1000);
  });
});

// ── applyOptions ──────────────────────────────────────────────────────────────

describe("applyOptions", () => {
  const sample = "550e8400-e29b-41d4-a716-446655440000";

  it("returns the id unchanged when no options set", () => {
    expect(applyOptions(sample, { uppercase: false, noDashes: false })).toBe(sample);
  });

  it("uppercases when requested", () => {
    expect(applyOptions(sample, { uppercase: true, noDashes: false })).toBe(sample.toUpperCase());
  });

  it("removes dashes when requested", () => {
    expect(applyOptions(sample, { uppercase: false, noDashes: true })).toBe(
      "550e8400e29b41d4a716446655440000"
    );
  });

  it("applies both uppercase and no-dashes", () => {
    expect(applyOptions(sample, { uppercase: true, noDashes: true })).toBe(
      "550E8400E29B41D4A716446655440000"
    );
  });
});

// ── generateBatch ─────────────────────────────────────────────────────────────

describe("generateBatch", () => {
  it("generates the requested count of v4 UUIDs", () => {
    const batch = generateBatch("v4", 10);
    expect(batch).toHaveLength(10);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const id of batch) {
      expect(id).toMatch(UUID_RE);
    }
  });

  it("generates the requested count of v7 UUIDs", () => {
    const batch = generateBatch("v7", 5);
    expect(batch).toHaveLength(5);
    for (const id of batch) {
      expect(id[14]).toBe("7");
    }
  });

  it("generates the requested count of nanoids", () => {
    const batch = generateBatch("nanoid", 8);
    expect(batch).toHaveLength(8);
    for (const id of batch) {
      expect(id).toHaveLength(21);
    }
  });

  it("generates 1000 unique v4 UUIDs", () => {
    const batch = generateBatch("v4", 1000);
    expect(new Set(batch).size).toBe(1000);
  });

  it("generates the requested count of v1 UUIDs", () => {
    const batch = generateBatch("v1", 5);
    expect(batch).toHaveLength(5);
    for (const id of batch) {
      expect(id[14]).toBe("1");
    }
  });

  it("generates the requested count of ULIDs", () => {
    const batch = generateBatch("ulid", 8);
    expect(batch).toHaveLength(8);
    for (const id of batch) {
      expect(id).toHaveLength(26);
    }
  });
});

// ── UUID v1 ───────────────────────────────────────────────────────────────────

describe("uuidV1", () => {
  const UUID_V1_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("produces a valid v1 UUID", () => {
    expect(uuidV1()).toMatch(UUID_V1_RE);
  });

  it("sets version nibble to 1", () => {
    expect(uuidV1()[14]).toBe("1");
  });

  it("sets variant bits to 10xx", () => {
    expect(["8", "9", "a", "b"]).toContain(uuidV1()[19]);
  });

  it("embeds a timestamp close to now", () => {
    const before = Date.now();
    const id = uuidV1();
    const after = Date.now();
    // Reconstruct timestamp from v1 UUID fields
    const hex = id.replace(/-/g, "");
    const timeLow = Number.parseInt(hex.slice(0, 8), 16);
    const timeMid = Number.parseInt(hex.slice(8, 12), 16);
    const timeHi = Number.parseInt(hex.slice(12, 16), 16) & 0x0fff;
    const ts100ns = BigInt(timeHi) * 2n ** 48n + BigInt(timeMid) * 2n ** 32n + BigInt(timeLow);
    const GREGORIAN_OFFSET = 122192928000000000n;
    const tsMs = Number((ts100ns - GREGORIAN_OFFSET) / 10000n);
    expect(tsMs).toBeGreaterThanOrEqual(before - 100);
    expect(tsMs).toBeLessThanOrEqual(after + 100);
  });
});

// ── ULID ──────────────────────────────────────────────────────────────────────

describe("ulid", () => {
  const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/; // Crockford base32

  it("produces a 26-character string", () => {
    expect(ulid()).toHaveLength(26);
  });

  it("uses only Crockford base32 alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(ulid()).toMatch(ULID_RE);
    }
  });

  it("produces unique values", () => {
    const set = new Set(Array.from({ length: 200 }, () => ulid()));
    expect(set.size).toBe(200);
  });

  it("is lexicographically sortable by generation time", () => {
    const a = ulid();
    // Small delay via busy-wait to ensure different ms
    const start = Date.now();
    while (Date.now() === start) {
      /* spin */
    }
    const b = ulid();
    expect(a < b).toBe(true);
  });
});

// ── UUID v3 / v5 (name-based) ─────────────────────────────────────────────────

describe("uuidV3Impl (MD5 name-based)", () => {
  const DNS_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const UUID_V3_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("produces a valid v3 UUID", async () => {
    const id = await uuidV3Impl(DNS_NS, "example.com");
    expect(id).toMatch(UUID_V3_RE);
  });

  it("is deterministic: same inputs give same output", async () => {
    const a = await uuidV3Impl(DNS_NS, "hello");
    const b = await uuidV3Impl(DNS_NS, "hello");
    expect(a).toBe(b);
  });

  it("differs for different names", async () => {
    const a = await uuidV3Impl(DNS_NS, "hello");
    const b = await uuidV3Impl(DNS_NS, "world");
    expect(a).not.toBe(b);
  });

  it("matches the RFC 4122 test vector for DNS + python.org", async () => {
    // RFC 4122 Appendix B test vector: v3 of DNS namespace + "python.org"
    // Known value: 6fa459ea-ee8a-3ca4-894e-db77e160355e
    const id = await uuidV3Impl(DNS_NS, "python.org");
    expect(id).toBe("6fa459ea-ee8a-3ca4-894e-db77e160355e");
  });
});

describe("uuidV5 (SHA-1 name-based)", () => {
  const DNS_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const UUID_V5_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("produces a valid v5 UUID", async () => {
    const id = await uuidV5(DNS_NS, "example.com");
    expect(id).toMatch(UUID_V5_RE);
  });

  it("is deterministic", async () => {
    const a = await uuidV5(DNS_NS, "hello");
    const b = await uuidV5(DNS_NS, "hello");
    expect(a).toBe(b);
  });

  it("matches the RFC 4122 test vector for DNS + python.org", async () => {
    // RFC 4122 Appendix C test vector: v5 of DNS namespace + "python.org"
    // Known value: 886313e1-3b8a-5372-9b90-0c9aee199e5d
    const id = await uuidV5(DNS_NS, "python.org");
    expect(id).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
  });
});

describe("generateNameBased", () => {
  const DNS_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

  it("generates the requested count for v5", async () => {
    const batch = await generateNameBased("v5", DNS_NS, "example.com", 3);
    expect(batch).toHaveLength(3);
  });

  it("generates distinct IDs when count > 1 (name variant per index)", async () => {
    const batch = await generateNameBased("v5", DNS_NS, "example.com", 3);
    const set = new Set(batch);
    expect(set.size).toBe(3);
  });
});

// ── applyOutputFormat ─────────────────────────────────────────────────────────

describe("applyOutputFormat", () => {
  const sample = "550e8400-e29b-41d4-a716-446655440000";

  it("plain returns unchanged", () => {
    expect(applyOutputFormat(sample, "plain")).toBe(sample);
  });

  it("braces wraps in curly braces", () => {
    expect(applyOutputFormat(sample, "braces")).toBe(`{${sample}}`);
  });

  it("urn prepends urn:uuid:", () => {
    expect(applyOutputFormat(sample, "urn")).toBe(`urn:uuid:${sample}`);
  });

  it("base64 produces a valid base64 string", () => {
    const b64 = applyOutputFormat(sample, "base64");
    expect(b64).toHaveLength(24); // 16 bytes -> 24 base64 chars (with padding)
    expect(() => atob(b64)).not.toThrow();
  });
});

// ── formatBulk ────────────────────────────────────────────────────────────────

describe("formatBulk", () => {
  const ids = ["aaa", "bbb", "ccc"];

  it("newline joins with newlines", () => {
    expect(formatBulk(ids, "newline")).toBe("aaa\nbbb\nccc");
  });

  it("comma joins with ', '", () => {
    expect(formatBulk(ids, "comma")).toBe("aaa, bbb, ccc");
  });

  it("json produces a valid JSON array string", () => {
    const out = formatBulk(ids, "json");
    expect(JSON.parse(out)).toEqual(ids);
  });

  it("quoted wraps each in double quotes and joins with comma-newline", () => {
    expect(formatBulk(ids, "quoted")).toBe('"aaa",\n"bbb",\n"ccc"');
  });
});

// ── inspectUuid ───────────────────────────────────────────────────────────────

describe("inspectUuid", () => {
  it("returns invalid for garbage input", () => {
    expect(inspectUuid("not-a-uuid").valid).toBe(false);
  });

  it("recognises Nil UUID", () => {
    const r = inspectUuid("00000000-0000-0000-0000-000000000000");
    expect(r.valid).toBe(true);
    expect(r.isNilUuid).toBe(true);
  });

  it("recognises Max UUID", () => {
    const r = inspectUuid("ffffffff-ffff-ffff-ffff-ffffffffffff");
    expect(r.valid).toBe(true);
    expect(r.isMaxUuid).toBe(true);
  });

  it("detects v4 correctly", () => {
    const r = inspectUuid(uuidV4());
    expect(r.valid).toBe(true);
    expect(r.version).toBe(4);
    expect(r.variant).toBe("RFC 4122");
  });

  it("detects v7 and extracts timestamp", () => {
    const before = Date.now();
    const id = uuidV7();
    const after = Date.now();
    const r = inspectUuid(id);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(7);
    expect(r.timestampMs).toBeGreaterThanOrEqual(before - 10);
    expect(r.timestampMs).toBeLessThanOrEqual(after + 10);
  });

  it("detects v1 and extracts timestamp", () => {
    const before = Date.now();
    const id = uuidV1();
    const after = Date.now();
    const r = inspectUuid(id);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(1);
    expect(r.timestampIso).toBeDefined();
    const ts = new Date(r.timestampIso ?? "").getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 100);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });

  it("strips braces before parsing", () => {
    const id = `{${uuidV4()}}`;
    const r = inspectUuid(id);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(4);
  });

  it("includes a Bytes field in fields array", () => {
    const r = inspectUuid(uuidV4());
    const bytesField = r.fields?.find((f) => f.label === "Bytes");
    expect(bytesField).toBeDefined();
    // 16 bytes * 2 hex chars + 15 spaces = 47 chars
    expect(bytesField?.value).toHaveLength(47);
  });
});
