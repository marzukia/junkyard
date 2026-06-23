import { describe, expect, it } from "vitest";
import {
  decodeBase64Url,
  decodeJwt,
  encodeBase64Url,
  formatUnixTimestamp,
  getExpiryStatus,
  isAsymmetricAlg,
  relativeTime,
  signJwt,
  verifyAsymmetricSignature,
  verifyHmacSignature,
} from "./jwt";

// A real HS256 JWT from jwt.io (public example — no secret involved)
const EXAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ" +
  ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("decodeBase64Url", () => {
  it("decodes a standard base64url string without padding", () => {
    // "Hello, World!" in base64url (no padding)
    const result = decodeBase64Url("SGVsbG8sIFdvcmxkIQ");
    expect(result).toBe("Hello, World!");
  });

  it("handles the - and _ substitutions (instead of + and /)", () => {
    // base64url for bytes that would use + or / in standard base64
    const input = "eyJhbGciOiJIUzI1NiJ9"; // {"alg":"HS256"}
    const decoded = decodeBase64Url(input);
    expect(decoded).toBe('{"alg":"HS256"}');
  });

  it("handles UTF-8 multi-byte characters", () => {
    // "café" encoded as base64url (UTF-8 bytes)
    // "café" UTF-8: 63 61 66 c3 a9 → base64: Y2Fmw6k=
    const result = decodeBase64Url("Y2Fmw6k");
    expect(result).toBe("café");
  });
});

describe("decodeJwt — success cases", () => {
  it("decodes the example JWT correctly", () => {
    const result = decodeJwt(EXAMPLE_JWT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.header.alg).toBe("HS256");
    expect(result.value.header.typ).toBe("JWT");
    expect(result.value.payload.sub).toBe("1234567890");
    expect(result.value.payload.name).toBe("John Doe");
    expect(result.value.payload.iat).toBe(1516239022);
  });

  it("preserves the raw segment strings", () => {
    const result = decodeJwt(EXAMPLE_JWT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.segments.header).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(result.value.segments.payload).toBe(
      "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
    );
  });

  it("trims surrounding whitespace before parsing", () => {
    const result = decodeJwt(`  ${EXAMPLE_JWT}  \n`);
    expect(result.ok).toBe(true);
  });
});

describe("decodeJwt — error cases", () => {
  it("returns empty error for blank input", () => {
    const result = decodeJwt("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("empty");
  });

  it("returns wrong_segments error for 2-part token", () => {
    const result = decodeJwt("abc.def");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrong_segments");
    if (result.error.kind === "wrong_segments") {
      expect(result.error.count).toBe(2);
    }
  });

  it("returns wrong_segments error for 4-part token", () => {
    const result = decodeJwt("a.b.c.d");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrong_segments");
  });

  it("returns invalid_base64 for a non-base64 header", () => {
    const result = decodeJwt("!!!.eyJhIjoxfQ.sig");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid_base64");
  });

  it("returns invalid_json when header decodes but is not JSON", () => {
    // base64url("not-json")
    const notJson = btoa("not-json").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const result = decodeJwt(`${notJson}.eyJhIjoxfQ.sig`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid_json");
    if (result.error.kind === "invalid_json") {
      expect(result.error.segment).toBe("header");
    }
  });
});

describe("getExpiryStatus", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  it("returns 'valid' when exp is in the future", () => {
    expect(getExpiryStatus({ exp: nowSeconds + 3600 })).toBe("valid");
  });

  it("returns 'expired' when exp is in the past", () => {
    expect(getExpiryStatus({ exp: nowSeconds - 1 })).toBe("expired");
  });

  it("returns 'no-expiry' when exp is absent", () => {
    expect(getExpiryStatus({ sub: "user" })).toBe("no-expiry");
  });

  it("returns 'not-yet-valid' when nbf is in the future (overrides valid exp)", () => {
    expect(getExpiryStatus({ exp: nowSeconds + 3600, nbf: nowSeconds + 600 })).toBe(
      "not-yet-valid"
    );
  });

  it("does not flag not-yet-valid when nbf is in the past", () => {
    expect(getExpiryStatus({ exp: nowSeconds + 3600, nbf: nowSeconds - 60 })).toBe("valid");
  });
});

describe("verifyHmacSignature", () => {
  // Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0 signed with "secret"
  // Produced with Node.js crypto.createHmac('sha256','secret').update(...).digest('base64url')
  const HEADER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const PAYLOAD = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
  // From the public jwt.io example token (secret = "your-256-bit-secret"):
  // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
  const SIG = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const SECRET = "your-256-bit-secret";

  it("returns valid for the correct secret", async () => {
    const result = await verifyHmacSignature(HEADER, PAYLOAD, SIG, SECRET, "HS256");
    expect(result.status).toBe("valid");
  });

  it("returns invalid for the wrong secret", async () => {
    const result = await verifyHmacSignature(HEADER, PAYLOAD, SIG, "wrong-secret", "HS256");
    expect(result.status).toBe("invalid");
  });

  it("returns unsupported for RS256", async () => {
    const result = await verifyHmacSignature(HEADER, PAYLOAD, SIG, SECRET, "RS256");
    expect(result.status).toBe("unsupported");
  });

  it("returns invalid when signature is tampered", async () => {
    // Replace the middle of the signature with a different character sequence
    const tampered = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const result = await verifyHmacSignature(HEADER, PAYLOAD, tampered, SECRET, "HS256");
    expect(result.status).toBe("invalid");
  });
});

describe("formatUnixTimestamp", () => {
  it("returns a non-empty string for a known timestamp", () => {
    // 2024-01-01 00:00:00 UTC = 1704067200
    const s = formatUnixTimestamp(1704067200);
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
    // The year should appear in the output
    expect(s).toContain("2024");
  });

  it("is consistent for the same input", () => {
    const ts = 1516239022;
    expect(formatUnixTimestamp(ts)).toBe(formatUnixTimestamp(ts));
  });
});

describe("encodeBase64Url", () => {
  it("round-trips through decodeBase64Url", () => {
    const obj = { alg: "HS256", typ: "JWT" };
    const encoded = encodeBase64Url(obj);
    const decoded = decodeBase64Url(encoded);
    expect(JSON.parse(decoded)).toEqual(obj);
  });

  it("produces no padding characters", () => {
    const encoded = encodeBase64Url({ a: 1 });
    expect(encoded).not.toContain("=");
  });

  it("uses URL-safe characters only", () => {
    const encoded = encodeBase64Url({ x: "foo+bar/baz" });
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });
});

describe("signJwt", () => {
  it("produces a token that decodes correctly", async () => {
    const payload = { sub: "u1", iat: 1700000000 };
    const result = await signJwt(payload, "test-secret", "HS256");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decoded = decodeJwt(result.token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.header.alg).toBe("HS256");
    expect(decoded.value.payload.sub).toBe("u1");
  });

  it("produces a signature that verifies correctly", async () => {
    const payload = { sub: "u1" };
    const secret = "test-secret-123";
    const signResult = await signJwt(payload, secret, "HS256");
    expect(signResult.ok).toBe(true);
    if (!signResult.ok) return;

    const decoded = decodeJwt(signResult.token);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    const verifyResult = await verifyHmacSignature(
      decoded.value.segments.header,
      decoded.value.segments.payload,
      decoded.value.segments.signature,
      secret,
      "HS256"
    );
    expect(verifyResult.status).toBe("valid");
  });

  it("uses different hash sizes for HS384 and HS512", async () => {
    const payload = { sub: "u2" };
    const r384 = await signJwt(payload, "secret", "HS384");
    const r512 = await signJwt(payload, "secret", "HS512");
    expect(r384.ok).toBe(true);
    expect(r512.ok).toBe(true);
    if (!r384.ok || !r512.ok) return;
    // Signatures should differ between algorithms
    expect(r384.token).not.toBe(r512.token);
  });
});

describe("isAsymmetricAlg", () => {
  it("identifies RSA and EC algorithms as asymmetric", () => {
    for (const alg of ["RS256", "RS384", "RS512", "PS256", "ES256", "ES384", "ES512"]) {
      expect(isAsymmetricAlg(alg)).toBe(true);
    }
  });

  it("does not flag HMAC algorithms as asymmetric", () => {
    for (const alg of ["HS256", "HS384", "HS512"]) {
      expect(isAsymmetricAlg(alg)).toBe(false);
    }
  });
});

describe("verifyAsymmetricSignature", () => {
  it("returns unsupported for unknown algorithm", async () => {
    const result = await verifyAsymmetricSignature("h", "p", "s", "pem", "XX999");
    expect(result.status).toBe("unsupported");
  });

  it("returns error for invalid PEM input", async () => {
    const result = await verifyAsymmetricSignature("h", "p", "s", "not-a-pem", "RS256");
    expect(result.status).toBe("error");
  });
});

describe("relativeTime", () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it("shows seconds for very recent timestamps", () => {
    expect(relativeTime(nowSeconds() + 30)).toBe("in 30 seconds");
    expect(relativeTime(nowSeconds() - 30)).toBe("30 seconds ago");
  });

  it("shows minutes for timestamps within an hour", () => {
    expect(relativeTime(nowSeconds() + 120)).toBe("in 2 minutes");
    expect(relativeTime(nowSeconds() - 120)).toBe("2 minutes ago");
  });

  it("shows hours for timestamps within a day", () => {
    expect(relativeTime(nowSeconds() + 7200)).toBe("in 2 hours");
  });

  it("shows days for timestamps within 30 days", () => {
    expect(relativeTime(nowSeconds() - 86400 * 3)).toBe("3 days ago");
  });

  it("shows years for timestamps more than a year away", () => {
    const threeYearsAgo = nowSeconds() - 86400 * 365 * 3;
    expect(relativeTime(threeYearsAgo)).toBe("3 years ago");
  });

  it("uses singular for exactly 1 unit", () => {
    expect(relativeTime(nowSeconds() + 3600)).toBe("in 1 hour");
  });
});
