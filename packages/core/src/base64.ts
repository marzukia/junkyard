/**
 * Base64 encode/decode using Node.js Buffer (no btoa/atob browser globals needed,
 * though both are also available in Node 18+). Buffer is used here for clarity
 * and to ensure headless-safe operation.
 */
import { z } from "zod";
import type { ToolDef } from "./types.js";

export function encodeBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

export function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.trim(), "base64").toString("utf8");
}

export function encodeBase64Url(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

export function decodeBase64Url(encoded: string): string {
  // Restore standard base64 alphabet and padding then decode
  const standard = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
  return Buffer.from(standard, "base64").toString("utf8");
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const base64Tool: ToolDef = {
  slug: "base64",
  name: "Base64",
  ops: [
    {
      name: "encode",
      description: "Encode text to Base64 (standard or URL-safe)",
      inputSchema: z.object({
        text: z.string(),
        urlSafe: z.boolean().default(false),
      }),
      run({ text, urlSafe }) {
        return { encoded: urlSafe ? encodeBase64Url(text) : encodeBase64(text) };
      },
    },
    {
      name: "decode",
      description: "Decode Base64 (standard or URL-safe) to text",
      inputSchema: z.object({
        encoded: z.string(),
        urlSafe: z.boolean().default(false),
      }),
      run({ encoded, urlSafe }) {
        return { text: urlSafe ? decodeBase64Url(encoded) : decodeBase64(encoded) };
      },
    },
  ],
};
