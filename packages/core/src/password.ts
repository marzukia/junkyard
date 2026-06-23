/**
 * Password generation using Node.js crypto.randomBytes for randomness.
 * The app lib uses browser crypto.getRandomValues; here we use Node crypto.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { ToolDef } from "./types.js";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";

function randomInt(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  const limit = 2 ** 32 - (2 ** 32 % max);
  const buf = randomBytes(4);
  let val: number;
  do {
    // Re-read fresh random bytes each iteration
    const fresh = randomBytes(4);
    val = fresh.readUInt32BE(0);
  } while (val >= limit);
  void buf; // satisfy TS
  return randomBytes(4).readUInt32BE(0) % max;
}

function randomPick<T>(arr: readonly T[]): T {
  return arr[randomInt(arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
}

export function generatePassword(opts: PasswordOptions): string {
  const { length, upper, lower, digits, symbols } = opts;
  const pools: string[] = [];
  if (upper) pools.push(UPPER);
  if (lower) pools.push(LOWER);
  if (digits) pools.push(DIGITS);
  if (symbols) pools.push(SYMBOLS);
  if (pools.length === 0) throw new Error("At least one character set must be selected");

  const alphabet = pools.join("");
  const required = pools.map((pool) => randomPick(pool.split("")));
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(randomPick(alphabet.split("")));
  }
  return shuffle([...required, ...rest]).join("");
}

export function passwordEntropy(opts: PasswordOptions): number {
  let alphabetSize = 0;
  if (opts.upper) alphabetSize += UPPER.length;
  if (opts.lower) alphabetSize += LOWER.length;
  if (opts.digits) alphabetSize += DIGITS.length;
  if (opts.symbols) alphabetSize += SYMBOLS.length;
  if (alphabetSize === 0) return 0;
  return opts.length * Math.log2(alphabetSize);
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const passwordTool: ToolDef = {
  slug: "password",
  name: "Password",
  ops: [
    {
      name: "generate",
      description: "Generate a cryptographically random password",
      inputSchema: z.object({
        length: z.number().int().min(4).max(256).default(20),
        upper: z.boolean().default(true),
        lower: z.boolean().default(true),
        digits: z.boolean().default(true),
        symbols: z.boolean().default(true),
      }),
      run(opts) {
        const password = generatePassword(opts);
        const entropy = passwordEntropy(opts);
        return { password, entropy: Math.round(entropy) };
      },
    },
  ],
};
