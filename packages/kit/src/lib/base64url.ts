/**\n * Canonical base64url codec — RFC 4648 §5.\n *\n * Shared source of truth for base64url encoding/decoding. Imported by all\n * junkyard apps via `@junkyardsh/kit` (browser APIs: TextEncoder/btoa/atob).\n *\n * Mirrors packages/core/src/base64.ts encodeBase64Url/decodeBase64Url but\n * uses browser APIs instead of Node Buffer so it works in Vite browser builds.\n */

/**
 * Encode a UTF-8 string to URL-safe Base64 (RFC 4648 §5).
 * Replaces + with -, / with _, and strips = padding.
 */
export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a URL-safe Base64 string (RFC 4648 §5) to a UTF-8 string.
 * Validates the charset before decoding; throws on invalid characters.
 * Returns "" for empty or whitespace-only input.
 */
export function decodeBase64Url(encoded: string): string {
  const trimmed = encoded.trim();
  if (trimmed.length === 0) return "";
  // Validate base64url charset (no +, /, or =)
  if (!/^[A-Za-z0-9_-]*$/.test(trimmed)) {
    throw new Error("Cannot decode base64url: invalid characters");
  }
  // Restore standard base64 alphabet and re-add padding
  const standard =
    trimmed.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (trimmed.length % 4)) % 4);
  const binary = atob(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
