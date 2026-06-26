/**
 * Pure client-side JWT decode utilities.
 *
 * No verification — this is an inspector, not a validator.
 * The token never leaves the browser; all processing is synchronous JS.
 */
import {
  decodeBase64Url as decodeBase64UrlCanonical,
  encodeBase64Url as encodeBase64UrlString,
} from "@junkyardsh/ui";

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  // Standard registered claims
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
  /** Raw base64url segments as-received */
  segments: { header: string; payload: string; signature: string };
}

export type DecodeError =
  | { kind: "empty" }
  | { kind: "wrong_segments"; count: number }
  | { kind: "invalid_base64"; segment: "header" | "payload" }
  | { kind: "invalid_json"; segment: "header" | "payload" }
  | { kind: "not_object"; segment: "header" | "payload" };

export type DecodeResult = { ok: true; value: DecodedJwt } | { ok: false; error: DecodeError };

/**
 * Decode a base64url-encoded string to a UTF-8 string.
 * Delegates to the canonical base64url codec (kit/lib/base64url.ts, vendored).
 * Validates charset and throws on invalid input so the caller can classify the error.
 */
export function decodeBase64Url(input: string): string {
  return decodeBase64UrlCanonical(input);
}

/**
 * Decode a JWT token string into its three parts.
 * Returns a typed result union — no exceptions bubble to the caller.
 */
export function decodeJwt(raw: string): DecodeResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: { kind: "empty" } };

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: { kind: "wrong_segments", count: parts.length } };
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  // Decode header
  let headerJson: string;
  try {
    headerJson = decodeBase64Url(headerB64);
  } catch {
    return { ok: false, error: { kind: "invalid_base64", segment: "header" } };
  }

  let header: unknown;
  try {
    header = JSON.parse(headerJson);
  } catch {
    return { ok: false, error: { kind: "invalid_json", segment: "header" } };
  }

  if (typeof header !== "object" || header === null || Array.isArray(header)) {
    return { ok: false, error: { kind: "not_object", segment: "header" } };
  }

  // Decode payload
  let payloadJson: string;
  try {
    payloadJson = decodeBase64Url(payloadB64);
  } catch {
    return { ok: false, error: { kind: "invalid_base64", segment: "payload" } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: { kind: "invalid_json", segment: "payload" } };
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, error: { kind: "not_object", segment: "payload" } };
  }

  return {
    ok: true,
    value: {
      header: header as JwtHeader,
      payload: payload as JwtPayload,
      segments: { header: headerB64, payload: payloadB64, signature: signatureB64 },
    },
  };
}

/** Format a Unix timestamp (seconds) as a human-readable local datetime string. */
export function formatUnixTimestamp(seconds: number): string {
  const d = new Date(seconds * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export type ExpiryStatus = "valid" | "expired" | "not-yet-valid" | "no-expiry";

/** Determine expiry status based on exp/nbf fields relative to the current time. */
export function getExpiryStatus(payload: JwtPayload): ExpiryStatus {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds) {
    return "not-yet-valid";
  }
  if (typeof payload.exp !== "number") {
    return "no-expiry";
  }
  return payload.exp > nowSeconds ? "valid" : "expired";
}

// ── Signature verification ────────────────────────────────────────────────

export type VerifyResult =
  | { status: "valid" }
  | { status: "invalid" }
  | { status: "error"; message: string }
  | { status: "unsupported"; alg: string };

/**
 * Verify an HMAC-SHA2 JWT signature using the Web Crypto API.
 * Only HS256 / HS384 / HS512 are supported client-side without a key server.
 */
export async function verifyHmacSignature(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  secret: string,
  alg: string
): Promise<VerifyResult> {
  const hashMap: Record<string, string> = {
    HS256: "SHA-256",
    HS384: "SHA-384",
    HS512: "SHA-512",
  };
  const hash = hashMap[alg];
  if (!hash) return { status: "unsupported", alg };

  const enc = new TextEncoder();
  const signingInput = `${headerB64}.${payloadB64}`;

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash }, false, [
      "sign",
    ]);
  } catch {
    return { status: "error", message: "Failed to import key." };
  }

  let expectedSig: ArrayBuffer;
  try {
    expectedSig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  } catch {
    return { status: "error", message: "Signing failed." };
  }

  // Decode the received signature from base64url
  const b64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  let receivedBytes: Uint8Array;
  try {
    const binary = atob(padded);
    receivedBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) receivedBytes[i] = binary.charCodeAt(i);
  } catch {
    return { status: "error", message: "Signature segment is not valid base64url." };
  }

  const expectedBytes = new Uint8Array(expectedSig);
  if (expectedBytes.length !== receivedBytes.length) return { status: "invalid" };

  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expectedBytes.length; i++) diff |= expectedBytes[i] ^ receivedBytes[i];
  return diff === 0 ? { status: "valid" } : { status: "invalid" };
}

// ── RS/ES public-key verification ────────────────────────────────────────

/** Maps JWT alg header to WebCrypto importKey / verify parameters. */
const ASYMMETRIC_ALG_MAP: Record<
  string,
  {
    name: string;
    hash: string;
    namedCurve?: string;
  }
> = {
  RS256: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  RS384: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
  RS512: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
  PS256: { name: "RSA-PSS", hash: "SHA-256" },
  PS384: { name: "RSA-PSS", hash: "SHA-384" },
  PS512: { name: "RSA-PSS", hash: "SHA-512" },
  ES256: { name: "ECDSA", hash: "SHA-256", namedCurve: "P-256" },
  ES384: { name: "ECDSA", hash: "SHA-384", namedCurve: "P-384" },
  ES512: { name: "ECDSA", hash: "SHA-512", namedCurve: "P-521" },
};

export function isAsymmetricAlg(alg: string): boolean {
  return alg in ASYMMETRIC_ALG_MAP;
}

/**
 * Parse a PEM string and extract the raw DER bytes.
 * Strips the header/footer lines and decodes the base64 body.
 */
function pemToDer(pem: string): Uint8Array {
  const lines = pem
    .trim()
    .split("\n")
    .filter((l) => !l.startsWith("-----"));
  const b64 = lines.join("").replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Verify an RSA or EC JWT signature using a PEM public key and the Web Crypto API.
 * Supports RS256/384/512, PS256/384/512, ES256/384/512.
 */
export async function verifyAsymmetricSignature(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  publicKeyPem: string,
  alg: string
): Promise<VerifyResult> {
  const algParams = ASYMMETRIC_ALG_MAP[alg];
  if (!algParams) return { status: "unsupported", alg };

  let der: Uint8Array;
  try {
    der = pemToDer(publicKeyPem);
  } catch {
    return { status: "error", message: "Could not parse public key PEM." };
  }

  const importParams =
    algParams.name === "ECDSA"
      ? { name: algParams.name, namedCurve: algParams.namedCurve ?? "P-256" }
      : { name: algParams.name, hash: algParams.hash };

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "spki",
      der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer,
      importParams,
      false,
      ["verify"]
    );
  } catch {
    return {
      status: "error",
      message: "Failed to import public key. Paste a SPKI PEM (-----BEGIN PUBLIC KEY-----).",
    };
  }

  // Decode signature from base64url
  const b64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  let sigBytes: Uint8Array;
  try {
    const binary = atob(padded);
    sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) sigBytes[i] = binary.charCodeAt(i);
  } catch {
    return { status: "error", message: "Signature segment is not valid base64url." };
  }

  const enc = new TextEncoder();
  const signingInput = enc.encode(`${headerB64}.${payloadB64}`);

  const verifyParams =
    algParams.name === "RSA-PSS"
      ? {
          name: algParams.name,
          saltLength: Number.parseInt(algParams.hash.replace("SHA-", ""), 10) / 8,
        }
      : { name: algParams.name, hash: algParams.hash };

  try {
    const ok = await crypto.subtle.verify(
      verifyParams,
      key,
      sigBytes.buffer.slice(
        sigBytes.byteOffset,
        sigBytes.byteOffset + sigBytes.byteLength
      ) as ArrayBuffer,
      signingInput.buffer.slice(
        signingInput.byteOffset,
        signingInput.byteOffset + signingInput.byteLength
      ) as ArrayBuffer
    );
    return ok ? { status: "valid" } : { status: "invalid" };
  } catch {
    return { status: "error", message: "Verification failed. Key may not match algorithm." };
  }
}

// ── JWT encode / sign ─────────────────────────────────────────────────────

export const HMAC_SIGN_ALGS = ["HS256", "HS384", "HS512"] as const;
export type HmacSignAlg = (typeof HMAC_SIGN_ALGS)[number];

/**
 * Encode a JS object as a base64url string (UTF-8 JSON).
 * JSON-serializes the object then delegates to the canonical string encoder
 * (kit/lib/base64url.ts, vendored).
 */
export function encodeBase64Url(obj: unknown): string {
  return encodeBase64UrlString(JSON.stringify(obj));
}

export type SignResult = { ok: true; token: string } | { ok: false; error: string };

/**
 * Sign a JWT with an HMAC secret and return the compact serialisation.
 * Only HS256/384/512 are supported (symmetric keys only, no private key needed).
 */
export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  alg: HmacSignAlg
): Promise<SignResult> {
  const hashMap: Record<HmacSignAlg, string> = {
    HS256: "SHA-256",
    HS384: "SHA-384",
    HS512: "SHA-512",
  };

  const header = { alg, typ: "JWT" };
  const headerB64 = encodeBase64Url(header);
  const payloadB64 = encodeBase64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const enc = new TextEncoder();
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: hashMap[alg] },
      false,
      ["sign"]
    );
  } catch {
    return { ok: false, error: "Failed to import signing key." };
  }

  let sig: ArrayBuffer;
  try {
    sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  } catch {
    return { ok: false, error: "Signing failed." };
  }

  // Encode signature as base64url
  const sigBytes = new Uint8Array(sig);
  let binary = "";
  for (const b of sigBytes) binary += String.fromCharCode(b);
  const sigB64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return { ok: true, token: `${signingInput}.${sigB64}` };
}

// ── Relative time formatting ──────────────────────────────────────────────

/**
 * Render a Unix timestamp relative to now.
 * Examples: "in 3 hours", "5 days ago", "2 years ago".
 */
export function relativeTime(secondsEpoch: number): string {
  const diffSeconds = secondsEpoch - Math.floor(Date.now() / 1000);
  const abs = Math.abs(diffSeconds);
  const future = diffSeconds > 0;

  let amount: number;
  let unit: string;

  if (abs < 60) {
    amount = abs;
    unit = "second";
  } else if (abs < 3600) {
    amount = Math.round(abs / 60);
    unit = "minute";
  } else if (abs < 86400) {
    amount = Math.round(abs / 3600);
    unit = "hour";
  } else if (abs < 86400 * 30) {
    amount = Math.round(abs / 86400);
    unit = "day";
  } else if (abs < 86400 * 365) {
    amount = Math.round(abs / (86400 * 30));
    unit = "month";
  } else {
    amount = Math.round(abs / (86400 * 365));
    unit = "year";
  }

  const plural = amount !== 1 ? "s" : "";
  return future ? `in ${amount} ${unit}${plural}` : `${amount} ${unit}${plural} ago`;
}

/** Human-readable error message for a DecodeError. */
export function decodeErrorMessage(error: DecodeError): string {
  switch (error.kind) {
    case "empty":
      return "Paste a JWT token above to inspect it.";
    case "wrong_segments":
      return `A JWT must have exactly 3 parts (header.payload.signature). Found ${error.count}.`;
    case "invalid_base64":
      return `The ${error.segment} segment is not valid base64url.`;
    case "invalid_json":
      return `The ${error.segment} segment does not contain valid JSON.`;
    case "not_object":
      return `The ${error.segment} segment must be a JSON object.`;
  }
}
