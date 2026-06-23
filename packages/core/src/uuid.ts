/**
 * UUID generation using Node.js crypto.randomUUID() and randomBytes().
 * The app lib uses browser crypto.getRandomValues; here we use Node crypto
 * equivalents for headless-safe operation.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { ToolDef } from "./types.js";

export type UuidVersion = "v4" | "v7";

export function uuidV4(): string {
  return randomUUID();
}

export function uuidV7(): string {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

export function generateUuids(version: UuidVersion, count: number): string[] {
  const gen = version === "v7" ? uuidV7 : uuidV4;
  return Array.from({ length: count }, () => gen());
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const uuidTool: ToolDef = {
  slug: "uuid",
  name: "UUID",
  ops: [
    {
      name: "generate",
      description: "Generate one or more UUID v4 (random) or v7 (time-ordered) identifiers",
      inputSchema: z.object({
        version: z.enum(["v4", "v7"]).default("v4"),
        count: z.number().int().min(1).max(1000).default(1),
      }),
      run({ version, count }) {
        return { uuids: generateUuids(version as UuidVersion, count) };
      },
    },
  ],
};
