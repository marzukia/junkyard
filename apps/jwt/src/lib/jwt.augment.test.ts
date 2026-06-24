/**
 * Augmented tests for jwt.ts.
 * Covers pathways not reached by the existing tests:
 * - decodeErrorMessage (all branches)
 * - decodeJwt not_object / invalid_json on payload
 * - relativeTime edge cases (months, exact 0)
 */
import { describe, expect, it } from "vitest";
import {
  decodeBase64Url,
  decodeErrorMessage,
  decodeJwt,
  encodeBase64Url,
  getExpiryStatus,
  relativeTime,
  signJwt,
} from "./jwt";
import type { DecodeError } from "./jwt";

// ── decodeErrorMessage (all 5 branches) ──────────────────────────────────────

describe("decodeErrorMessage", () => {
  it("handles 'empty' error", () => {
    const err: DecodeError = { kind: "empty" };
    expect(decodeErrorMessage(err)).toContain("Paste a JWT");
  });

  it("handles 'wrong_segments' error", () => {
    const err: DecodeError = { kind: "wrong_segments", count: 2 };
    const msg = decodeErrorMessage(err);
    expect(msg).toContain("3");
    expect(msg).toContain("2");
  });

  it("handles 'invalid_base64' for header segment", () => {
    const err: DecodeError = { kind: "invalid_base64", segment: "header" };
    const msg = decodeErrorMessage(err);
    expect(msg).toContain("header");
    expect(msg).toContain("base64url");
  });

  it("handles 'invalid_base64' for payload segment", () => {
    const err: DecodeError = { kind: "invalid_base64", segment: "payload" };
    const msg = decodeErrorMessage(err);
    expect(msg).toContain("payload");
  });

  it("handles 'invalid_json' for header segment", () => {
    const err: DecodeError = { kind: "invalid_json", segment: "header" };
    expect(decodeErrorMessage(err)).toContain("header");
  });

  it("handles 'invalid_json' for payload segment", () => {
    const err: DecodeError = { kind: "invalid_json", segment: "payload" };
    expect(decodeErrorMessage(err)).toContain("payload");
  });

  it("handles 'not_object' for header segment", () => {
    const err: DecodeError = { kind: "not_object", segment: "header" };
    const msg = decodeErrorMessage(err);
    expect(msg).toContain("object");
  });

  it("handles 'not_object' for payload segment", () => {
    const err: DecodeError = { kind: "not_object", segment: "payload" };
    const msg = decodeErrorMessage(err);
    expect(msg).toContain("payload");
  });
});

// ── decodeJwt — payload error paths ──────────────────────────────────────────

describe("decodeJwt — payload error paths", () => {
  // Build a valid header b64 for reuse
  const validHeader = encodeBase64Url({ alg: "HS256", typ: "JWT" });

  it("returns invalid_json when payload is not JSON", () => {
    const badPayload = btoa("not-json").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const result = decodeJwt(`${validHeader}.${badPayload}.sig`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_json");
      if (result.error.kind === "invalid_json") {
        expect(result.error.segment).toBe("payload");
      }
    }
  });

  it("returns not_object when payload is a JSON array", () => {
    // JSON array is valid JSON but not an object
    const arrayPayload = encodeBase64Url([1, 2, 3]);
    const result = decodeJwt(`${validHeader}.${arrayPayload}.sig`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not_object");
      if (result.error.kind === "not_object") {
        expect(result.error.segment).toBe("payload");
      }
    }
  });

  it("returns not_object when payload is a JSON number", () => {
    const numPayload = encodeBase64Url(42);
    const result = decodeJwt(`${validHeader}.${numPayload}.sig`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not_object");
    }
  });

  it("returns not_object when header is a JSON array", () => {
    const arrayHeader = encodeBase64Url([1, 2, 3]);
    const validPayload = encodeBase64Url({ sub: "u1" });
    const result = decodeJwt(`${arrayHeader}.${validPayload}.sig`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not_object");
      if (result.error.kind === "not_object") {
        expect(result.error.segment).toBe("header");
      }
    }
  });
});

// ── decodeBase64Url — negative cases ─────────────────────────────────────────

describe("decodeBase64Url — negative cases", () => {
  it("decodes empty string to empty string", () => {
    // base64url of empty bytes is ""
    expect(decodeBase64Url("")).toBe("");
  });

  it("throws for a string with non-base64 characters (after normalise)", () => {
    // Characters like ! are not valid base64; atob should throw
    expect(() => decodeBase64Url("!!!")).toThrow();
  });

  it("throws for standard base64 chars that are invalid in base64url (+)", () => {
    // '+' is valid standard base64 but NOT valid base64url (must be '-' instead).
    // The canonical charset validator catches this before atob, pinning the drift
    // between the old lenient jwt/colours implementations and the robust canonical.
    expect(() => decodeBase64Url("SGVs+G8")).toThrow(/invalid characters/);
  });

  it("throws for standard base64 chars that are invalid in base64url (/)", () => {
    // '/' is valid standard base64 but NOT valid base64url (must be '_' instead).
    expect(() => decodeBase64Url("SGVs/G8")).toThrow(/invalid characters/);
  });
});

// ── getExpiryStatus — additional cases ───────────────────────────────────────

describe("getExpiryStatus — additional cases", () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it("returns 'no-expiry' when exp is undefined but nbf is set in the past", () => {
    expect(getExpiryStatus({ nbf: nowSeconds() - 60 })).toBe("no-expiry");
  });

  it("returns 'not-yet-valid' when exp is absent but nbf is in the future", () => {
    expect(getExpiryStatus({ nbf: nowSeconds() + 3600 })).toBe("not-yet-valid");
  });
});

// ── relativeTime — additional and edge cases ──────────────────────────────────

describe("relativeTime — additional cases", () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it("shows 0 seconds for exactly now", () => {
    const result = relativeTime(nowSeconds());
    // Should be "0 seconds ago" or "in 0 seconds" depending on rounding
    expect(result).toMatch(/0 second/);
  });

  it("shows months for 45-day timestamps", () => {
    const result = relativeTime(nowSeconds() - 86400 * 45);
    expect(result).toMatch(/month/);
  });

  it("shows months in the future", () => {
    const result = relativeTime(nowSeconds() + 86400 * 60);
    expect(result).toMatch(/month/);
    expect(result).toContain("in");
  });

  it("uses singular 'month' for 1 month", () => {
    // ~30 days = 1 month
    const result = relativeTime(nowSeconds() - 86400 * 30);
    expect(result).toBe("1 month ago");
  });

  it("uses plural 'days' for multiple days", () => {
    const result = relativeTime(nowSeconds() - 86400 * 5);
    expect(result).toBe("5 days ago");
  });
});

// ── signJwt — negative cases ──────────────────────────────────────────────────

describe("signJwt — negative cases", () => {
  it("produces different tokens for different payloads with same secret", async () => {
    const r1 = await signJwt({ sub: "u1" }, "secret", "HS256");
    const r2 = await signJwt({ sub: "u2" }, "secret", "HS256");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.token).not.toBe(r2.token);
  });

  it("produces different tokens for different secrets with same payload", async () => {
    const payload = { sub: "u1", iat: 1000 };
    const r1 = await signJwt(payload, "secret1", "HS256");
    const r2 = await signJwt(payload, "secret2", "HS256");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.token).not.toBe(r2.token);
  });

  it("produces a token with exactly 3 dot-separated segments", async () => {
    const result = await signJwt({ sub: "u1" }, "secret", "HS256");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("token header segment encodes correct alg field for HS384", async () => {
    const result = await signJwt({ sub: "u1" }, "secret", "HS384");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const decoded = decodeJwt(result.token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.header.alg).toBe("HS384");
  });
});
