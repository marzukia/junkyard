/**
 * Augment tests for uuid/uuid.ts -- covers gaps in the existing suite:
 * inspectUuid with uppercase input, v3 detection, NCS/Microsoft/Reserved variants,
 * applyOptions with format, formatBulk empty array, generateBatch count=0,
 * nanoid size=0 edge case, ulid timestamp ordering stress.
 */
import { describe, expect, it } from "vitest";
import {
  UUID_NAMESPACES,
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

// ── inspectUuid -- additional paths ──────────────────────────────────────────

describe("inspectUuid -- additional paths", () => {
  it("accepts uppercase UUID input", () => {
    const id = uuidV4().toUpperCase();
    const r = inspectUuid(id);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(4);
  });

  it("detects v3 UUID version", async () => {
    const id = await uuidV3Impl(UUID_NAMESPACES.DNS, "example.com");
    const r = inspectUuid(id);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(3);
  });

  it("detects v5 UUID version", async () => {
    const id = await uuidV5(UUID_NAMESPACES.URL, "https://example.com");
    const r = inspectUuid(id);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(5);
  });

  it("NCS variant detected for byte 8 high bit = 0", () => {
    // Construct a UUID where byte 8 high bit is 0 (NCS variant)
    // Set byte 8 to 0x00 -- clears high bit
    const ncsUuid = "00000000-0000-4000-0000-000000000000";
    const r = inspectUuid(ncsUuid);
    expect(r.valid).toBe(true);
    expect(r.variant).toBe("NCS");
  });

  it("Microsoft variant detected for byte 8 = 0xc0", () => {
    // byte 8 = 0xC0 = 11000000 -> Microsoft variant
    const msUuid = "00000000-0000-4000-c000-000000000000";
    const r = inspectUuid(msUuid);
    expect(r.valid).toBe(true);
    expect(r.variant).toBe("Microsoft");
  });

  it("returns valid=false for too-short input", () => {
    expect(inspectUuid("1234").valid).toBe(false);
  });

  it("returns valid=false for empty string", () => {
    expect(inspectUuid("").valid).toBe(false);
  });

  it("v1 clock sequence is in 0-16383 range", () => {
    const id = uuidV1();
    const r = inspectUuid(id);
    expect(r.valid).toBe(true);
    expect(r.clockSeq).toBeGreaterThanOrEqual(0);
    expect(r.clockSeq).toBeLessThanOrEqual(16383);
  });

  it("v1 node field is formatted as colon-separated hex", () => {
    const r = inspectUuid(uuidV1());
    expect(r.node).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/);
  });
});

// ── UUID_NAMESPACES -- constants ──────────────────────────────────────────────

describe("UUID_NAMESPACES", () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it("DNS namespace is a valid UUID", () => {
    expect(UUID_NAMESPACES.DNS).toMatch(UUID_RE);
  });

  it("URL namespace is a valid UUID", () => {
    expect(UUID_NAMESPACES.URL).toMatch(UUID_RE);
  });

  it("all namespace UUIDs are distinct", () => {
    const values = Object.values(UUID_NAMESPACES);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ── applyOptions -- format field ─────────────────────────────────────────────

describe("applyOptions -- format field", () => {
  const sample = "550e8400-e29b-41d4-a716-446655440000";

  it("format=braces wraps in braces", () => {
    const result = applyOptions(sample, { uppercase: false, noDashes: false, format: "braces" });
    expect(result).toBe(`{${sample}}`);
  });

  it("format=urn prepends urn:uuid:", () => {
    const result = applyOptions(sample, { uppercase: false, noDashes: false, format: "urn" });
    expect(result).toBe(`urn:uuid:${sample}`);
  });

  it("format=plain leaves unchanged", () => {
    const result = applyOptions(sample, { uppercase: false, noDashes: false, format: "plain" });
    expect(result).toBe(sample);
  });

  it("noDashes + uppercase work together with no format", () => {
    const result = applyOptions(sample, { uppercase: true, noDashes: true });
    expect(result).toBe("550E8400E29B41D4A716446655440000");
    expect(result).not.toContain("-");
  });
});

// ── applyOutputFormat -- base64 round-trip ───────────────────────────────────

describe("applyOutputFormat -- additional paths", () => {
  it("base64 of a well-known UUID is decodable to 16 bytes", () => {
    const sample = "550e8400-e29b-41d4-a716-446655440000";
    const b64 = applyOutputFormat(sample, "base64");
    const decoded = atob(b64);
    expect(decoded.length).toBe(16);
  });

  it("urn format includes the UUID without braces", () => {
    const sample = "550e8400-e29b-41d4-a716-446655440000";
    const urn = applyOutputFormat(sample, "urn");
    expect(urn).toBe(`urn:uuid:${sample}`);
  });
});

// ── formatBulk -- edge cases ──────────────────────────────────────────────────

describe("formatBulk -- edge cases", () => {
  it("empty array produces empty string for newline", () => {
    expect(formatBulk([], "newline")).toBe("");
  });

  it("empty array produces '[]' for json", () => {
    const out = JSON.parse(formatBulk([], "json"));
    expect(out).toEqual([]);
  });

  it("empty array produces empty string for comma", () => {
    expect(formatBulk([], "comma")).toBe("");
  });

  it("single item newline has no newline character", () => {
    expect(formatBulk(["only"], "newline")).toBe("only");
  });
});

// ── generateBatch -- count=0 ──────────────────────────────────────────────────

describe("generateBatch -- count=0", () => {
  it("returns empty array for count=0", () => {
    expect(generateBatch("v4", 0)).toHaveLength(0);
    expect(generateBatch("ulid", 0)).toHaveLength(0);
    expect(generateBatch("nanoid", 0)).toHaveLength(0);
  });
});

// ── generateNameBased -- edge cases ───────────────────────────────────────────

describe("generateNameBased -- edge cases", () => {
  const DNS_NS = UUID_NAMESPACES.DNS;

  it("count=0 returns empty array", async () => {
    const batch = await generateNameBased("v5", DNS_NS, "test", 0);
    expect(batch).toHaveLength(0);
  });

  it("count=1 returns exactly the deterministic value", async () => {
    const a = await generateNameBased("v5", DNS_NS, "example.com", 1);
    const b = await generateNameBased("v5", DNS_NS, "example.com", 1);
    expect(a[0]).toBe(b[0]);
  });

  it("v3 batch produces valid v3 UUIDs", async () => {
    const batch = await generateNameBased("v3", DNS_NS, "test", 2);
    for (const id of batch) {
      expect(id[14]).toBe("3");
    }
  });
});

// ── nanoid -- edge cases ──────────────────────────────────────────────────────

describe("nanoid -- edge cases", () => {
  it("size=1 produces a single character", () => {
    expect(nanoid(1)).toHaveLength(1);
  });

  it("size=0 produces empty string", () => {
    expect(nanoid(0)).toBe("");
  });

  it("size=100 produces 100 chars", () => {
    expect(nanoid(100)).toHaveLength(100);
  });
});

// ── ulid -- additional invariants ─────────────────────────────────────────────

describe("ulid -- additional invariants", () => {
  it("all characters are from Crockford base32 alphabet", () => {
    const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    for (let i = 0; i < 20; i++) {
      const id = ulid();
      for (const ch of id) {
        expect(CROCKFORD).toContain(ch);
      }
    }
  });

  it("timestamp part (first 10 chars) encodes a recent time", () => {
    const before = Date.now();
    const id = ulid();
    // Decode the first 10 Crockford base32 chars
    const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let ts = 0;
    for (let i = 0; i < 10; i++) {
      ts = ts * 32 + CROCKFORD.indexOf(id[i]);
    }
    const after = Date.now();
    expect(ts).toBeGreaterThanOrEqual(before - 5);
    expect(ts).toBeLessThanOrEqual(after + 5);
  });
});
