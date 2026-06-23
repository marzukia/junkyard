/**
 * Hash operations using Node.js crypto (sync, no browser globals).
 * The app lib uses SubtleCrypto (browser async) for SHA-1/256/512 and a
 * pure-TS MD5. Here we use Node crypto for everything so it is sync and
 * headless-safe across all 17 ops.
 */
import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import type { ToolDef } from "./types.js";

export type HashAlgo = "md5" | "sha1" | "sha256" | "sha512";

export function hash(text: string, algo: HashAlgo): string {
  return createHash(algo).update(text, "utf8").digest("hex");
}

export function hmac(text: string, secret: string, algo: HashAlgo = "sha256"): string {
  return createHmac(algo, secret).update(text, "utf8").digest("hex");
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const hashTool: ToolDef = {
  slug: "hash",
  name: "Hash",
  ops: [
    {
      name: "hash",
      description: "Compute MD5, SHA-1, SHA-256 or SHA-512 hash of text",
      inputSchema: z.object({
        text: z.string(),
        algo: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),
      }),
      run({ text, algo }) {
        return { hash: hash(text, algo as HashAlgo), algo };
      },
    },
    {
      name: "hmac",
      description: "Compute HMAC of text with a secret key",
      inputSchema: z.object({
        text: z.string(),
        secret: z.string(),
        algo: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),
      }),
      run({ text, secret, algo }) {
        return { hmac: hmac(text, secret, algo as HashAlgo), algo };
      },
    },
  ],
};
