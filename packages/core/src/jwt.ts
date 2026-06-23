/**
 * JWT decode and HMAC verify using Node.js crypto (no SubtleCrypto/browser globals).
 * Only HS256/HS384/HS512 verification is supported (symmetric, no private key needed).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ToolDef } from "./types.js";

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  segments: { header: string; payload: string; signature: string };
}

function decodeBase64UrlSegment(input: string): string {
  const standard = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(standard, "base64").toString("utf8");
}

export function decodeJwt(raw: string): { ok: true; value: DecodedJwt } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Empty token." };

  const parts = trimmed.split(".");
  if (parts.length !== 3) return { ok: false, error: `Expected 3 segments, got ${parts.length}.` };

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let header: unknown;
  try { header = JSON.parse(decodeBase64UrlSegment(headerB64)); } catch { return { ok: false, error: "Header segment is not valid base64url JSON." }; }
  if (typeof header !== "object" || header === null || Array.isArray(header)) return { ok: false, error: "Header must be a JSON object." };

  let payload: unknown;
  try { payload = JSON.parse(decodeBase64UrlSegment(payloadB64)); } catch { return { ok: false, error: "Payload segment is not valid base64url JSON." }; }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return { ok: false, error: "Payload must be a JSON object." };

  return {
    ok: true,
    value: {
      header: header as JwtHeader,
      payload: payload as JwtPayload,
      segments: { header: headerB64, payload: payloadB64, signature: signatureB64 },
    },
  };
}

const HMAC_HASH_MAP: Record<string, string> = { HS256: "sha256", HS384: "sha384", HS512: "sha512" };

export function verifyHmac(token: string, secret: string): { valid: boolean; error?: string } {
  const decoded = decodeJwt(token);
  if (!decoded.ok) return { valid: false, error: decoded.error };

  const { header, segments } = decoded.value;
  const alg = String(header.alg ?? "");
  const hashAlgo = HMAC_HASH_MAP[alg];
  if (!hashAlgo) return { valid: false, error: `Unsupported algorithm: ${alg}. Only HS256/384/512 supported.` };

  const signingInput = `${segments.header}.${segments.payload}`;
  const expected = createHmac(hashAlgo, secret).update(signingInput).digest();

  const b64 = segments.signature.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (segments.signature.length % 4)) % 4);
  const received = Buffer.from(b64, "base64");

  if (expected.length !== received.length) return { valid: false };
  try {
    const isValid = timingSafeEqual(expected, received);
    return { valid: isValid };
  } catch {
    return { valid: false, error: "Comparison failed." };
  }
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const jwtTool: ToolDef = {
  slug: "jwt",
  name: "JWT Decoder",
  ops: [
    {
      name: "decode",
      description: "Decode a JWT token and return header and payload (no verification)",
      inputSchema: z.object({ token: z.string() }),
      run({ token }) {
        const result = decodeJwt(token);
        if (!result.ok) throw new Error(result.error);
        return { header: result.value.header, payload: result.value.payload };
      },
    },
    {
      name: "verifyHmac",
      description: "Verify an HS256/HS384/HS512 JWT signature with a secret",
      inputSchema: z.object({ token: z.string(), secret: z.string() }),
      run({ token, secret }) {
        return verifyHmac(token, secret);
      },
    },
  ],
};
