/**
 * Pure Base64 and URL encoding/decoding logic.
 * All functions are synchronous and side-effect free — safe to unit-test in Node.
 *
 * UTF-8 handling strategy:
 *   encode: TextEncoder → Uint8Array → btoa (avoid Latin-1 truncation)
 *   decode: atob → Uint8Array → TextDecoder (round-trips emoji, CJK, etc.)
 */

export type EncodingMode = "base64" | "base64url" | "url" | "hex";

// ── Base64 (standard) ─────────────────────────────────────────────────────────

/** Encode a UTF-8 string to standard Base64. */
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Decode a standard Base64 string to UTF-8. Throws on invalid input. */
export function decodeBase64(encoded: string): string {
  const binary = atob(encoded.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ── Base64 URL-safe variant ───────────────────────────────────────────────────
// RFC 4648 §5: replace + → - and / → _ ; strip padding =

/** Encode a UTF-8 string to URL-safe Base64 (no padding). */
export function encodeBase64Url(text: string): string {
  return encodeBase64(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a URL-safe Base64 string to UTF-8. Throws on invalid input. */
export function decodeBase64Url(encoded: string): string {
  // Restore standard Base64 alphabet and padding
  const standard =
    encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
  return decodeBase64(standard);
}

// ── Hex encoding ─────────────────────────────────────────────────────────────

/** Encode a UTF-8 string to lowercase hex. */
export function encodeHex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Decode a hex string (with optional spaces/colons as separators) to UTF-8.
 * Throws on invalid hex input.
 */
export function decodeHex(encoded: string): string {
  const clean = encoded.trim().replace(/[\s:]/g, "");
  if (clean.length === 0) return "";
  if (!/^[0-9a-fA-F]+$/.test(clean)) throw new Error("Invalid hex input");
  if (clean.length % 2 !== 0) throw new Error("Hex string must have even length");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Convert raw bytes to lowercase hex (used for binary file hex output,
 * analogous to bytesToBase64).
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── URL encoding ──────────────────────────────────────────────────────────────

/** Percent-encode a string (encodeURIComponent semantics). */
export function encodeUrl(text: string): string {
  return encodeURIComponent(text);
}

/** Decode a percent-encoded string. Throws on malformed sequences. */
export function decodeUrl(encoded: string): string {
  return decodeURIComponent(encoded);
}

// ── Dispatch helpers ──────────────────────────────────────────────────────────

export function encode(text: string, mode: EncodingMode): string {
  switch (mode) {
    case "base64":
      return encodeBase64(text);
    case "base64url":
      return encodeBase64Url(text);
    case "url":
      return encodeUrl(text);
    case "hex":
      return encodeHex(text);
  }
}

export function decode(text: string, mode: EncodingMode): string {
  switch (mode) {
    case "base64":
      return decodeBase64(text);
    case "base64url":
      return decodeBase64Url(text);
    case "url":
      return decodeUrl(text);
    case "hex":
      return decodeHex(text);
  }
}

// ── File helpers (return data-URIs; used from FileReader callbacks) ───────────

/**
 * Convert a raw Uint8Array to a standard Base64 string.
 * Used when encoding file bytes (not UTF-8 text) to Base64.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Decode a standard Base64 string to raw bytes.
 * The caller is responsible for wrapping in a Blob/data-URI.
 */
export function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Strip a data-URI prefix from a string and return the raw Base64 payload.
 * e.g. "data:image/png;base64,iVBORw0K..." → "iVBORw0K..."
 * Returns the original string unchanged if it has no data-URI prefix.
 */
export function stripDataUri(s: string): string {
  const match = /^data:[^;]+;base64,(.+)$/s.exec(s.trim());
  return match ? match[1] : s.trim();
}

/**
 * Detect whether a Base64 string (possibly with data-URI prefix) is an image
 * by checking for a data-URI image MIME type, or by sniffing the raw magic bytes.
 */
export function isImageDataUri(s: string): boolean {
  return /^data:image\//.test(s.trim());
}

/**
 * Return true if `s` is almost certainly a base64-encoded payload rather than
 * plain text. Heuristic: at least 12 chars, >= 85% base64 alphabet chars,
 * and valid padding if present. Not foolproof, but good enough for a nudge UI.
 */
export function looksLikeBase64(s: string): boolean {
  const t = s.trim();
  if (t.length < 12) return false;
  // data-URI is definitely base64-derived
  if (/^data:[^;]+;base64,/.test(t)) return true;
  const b64Chars = t.replace(/[A-Za-z0-9+/=\n\r]/g, "").length;
  const ratio = b64Chars / t.length;
  if (ratio > 0.15) return false; // too many non-base64 chars
  // Must end correctly (padding or none)
  const stripped = t.replace(/[\n\r]/g, "");
  const padMatch = /^[A-Za-z0-9+/]+={0,2}$/.test(stripped);
  return padMatch && stripped.length % 4 === 0;
}

/**
 * Detect if a string value is a data-URI (any MIME type, not just image).
 * Returns the full data-URI prefix if detected, null otherwise.
 */
export function parseDataUri(s: string): { mime: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(s.trim());
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

/**
 * Compress a UTF-8 string using gzip via CompressionStream, then base64-encode.
 * Returns a promise. Falls back to plain base64 if CompressionStream unavailable.
 */
export async function encodeGzipBase64(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  return bytesToBase64(new Uint8Array(compressed));
}

/**
 * Decode a gzip+base64 string: base64-decode then gunzip.
 */
export async function decodeGzipBase64(encoded: string): Promise<string> {
  const bytes = base64ToBytes(encoded.trim());
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  void writer.write(bytes.buffer as ArrayBuffer);
  void writer.close();
  const decompressed = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}
