/**
 * Client-side hash computation.
 *
 * - MD5: pure-TS implementation (SubtleCrypto does not expose MD5).
 * - CRC32: pure-TS lookup-table implementation.
 * - SHA-3 (256/512): pure-TS Keccak-based implementation.
 * - SHA-1 / SHA-224 / SHA-256 / SHA-384 / SHA-512: SubtleCrypto.
 * - HMAC: SubtleCrypto sign().
 *
 * All functions accept string | ArrayBuffer and return lowercase hex.
 */

// ── MD5 ──────────────────────────────────────────────────────────────────────

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K: number[] = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
);

function safe32(n: number): number {
  return n >>> 0;
}

export function md5Hex(input: string | ArrayBuffer): string {
  const msg: Uint8Array =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);

  const msgLen = msg.length;
  const bitLen = msgLen * 8;

  // MD5 padding: append 0x80, then zero bytes until length ≡ 56 (mod 64),
  // then the 64-bit LE bit-count. Total padded length is always a multiple of 64.
  const paddedLen = msgLen + 1 + ((55 - (msgLen % 64) + 64) % 64) + 8;
  const padded = new Uint8Array(paddedLen);
  padded.set(msg);
  padded[msgLen] = 0x80;
  // Write 64-bit LE bit length at the end
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
  dv.setUint32(paddedLen - 4, Math.floor(bitLen / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const chunks = paddedLen / 64;
  for (let chunk = 0; chunk < chunks; chunk++) {
    const off = chunk * 64;
    const M: number[] = Array.from({ length: 16 }, (_, i) => dv.getUint32(off + i * 4, true));

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = safe32(safe32(safe32(f + a) + safe32(MD5_K[i])) + safe32(M[g]));
      a = d;
      d = c;
      c = b;
      const rot = MD5_S[i];
      b = safe32(b + safe32((f << rot) | (f >>> (32 - rot))));
    }

    a0 = safe32(a0 + a);
    b0 = safe32(b0 + b);
    c0 = safe32(c0 + c);
    d0 = safe32(d0 + d);
  }

  // Output is four 32-bit words in little-endian order
  return [a0, b0, c0, d0]
    .map((n) => {
      // Convert to little-endian hex
      const le =
        ((n & 0xff) << 24) |
        (((n >>> 8) & 0xff) << 16) |
        (((n >>> 16) & 0xff) << 8) |
        ((n >>> 24) & 0xff);
      return safe32(le).toString(16).padStart(8, "0");
    })
    .join("");
}

// ── CRC32 ─────────────────────────────────────────────────────────────────────

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

export function crc32Hex(input: string | ArrayBuffer): string {
  const bytes: Uint8Array =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  const result = (crc ^ 0xffffffff) >>> 0;
  return result.toString(16).padStart(8, "0");
}

// ── SHA-3 (Keccak) ────────────────────────────────────────────────────────────
// Pure-TS Keccak-f[1600] implementing SHA3-256 and SHA3-512.

const KECCAK_RC: bigint[] = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

const KECCAK_RHO: number[] = [
  1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
];

// Pi permutation: destination index for each step in the chain starting at lane 1.
// Derived from (x,y) -> (y, 2x+3y mod 5), flat index = 5*y + x.
const KECCAK_PI: number[] = [
  10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
];

const MASK64 = 0xffffffffffffffffn;

function rotL64(x: bigint, n: number): bigint {
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;
}

function keccakF(state: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    // Theta
    const C: bigint[] = Array.from(
      { length: 5 },
      (_, i) => state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20]
    );
    const D: bigint[] = Array.from(
      { length: 5 },
      (_, i) => C[(i + 4) % 5] ^ rotL64(C[(i + 1) % 5], 1)
    );
    for (let i = 0; i < 25; i++) state[i] ^= D[i % 5];

    // Rho and Pi (in-place rotation through the permutation cycle)
    // Each step: move state[KECCAK_PI[i]] to the next position after rotating.
    let last = state[1];
    for (let i = 0; i < 24; i++) {
      const j = KECCAK_PI[i];
      const tmp = state[j];
      state[j] = rotL64(last, KECCAK_RHO[i]);
      last = tmp;
    }

    // Chi
    for (let i = 0; i < 25; i += 5) {
      const a0 = state[i];
      const a1 = state[i + 1];
      const a2 = state[i + 2];
      const a3 = state[i + 3];
      const a4 = state[i + 4];
      state[i] = a0 ^ (~a1 & a2);
      state[i + 1] = a1 ^ (~a2 & a3);
      state[i + 2] = a2 ^ (~a3 & a4);
      state[i + 3] = a3 ^ (~a4 & a0);
      state[i + 4] = a4 ^ (~a0 & a1);
    }

    // Iota
    state[0] ^= KECCAK_RC[round];
  }
}

function keccakHash(input: string | ArrayBuffer, bitLen: number, padding: number): string {
  const bytes: Uint8Array =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);

  const rate = (1600 - bitLen * 2) / 8; // in bytes
  const state: bigint[] = new Array(25).fill(0n);

  // Absorb
  let offset = 0;
  while (offset + rate <= bytes.length) {
    for (let i = 0; i < rate / 8; i++) {
      let word = 0n;
      for (let j = 0; j < 8; j++) {
        word |= BigInt(bytes[offset + i * 8 + j]) << BigInt(j * 8);
      }
      state[i] ^= word;
    }
    keccakF(state);
    offset += rate;
  }

  // Pad last block
  const last = new Uint8Array(rate);
  last.set(bytes.slice(offset));
  last[bytes.length - offset] ^= padding;
  last[rate - 1] ^= 0x80;
  for (let i = 0; i < rate / 8; i++) {
    let word = 0n;
    for (let j = 0; j < 8; j++) {
      word |= BigInt(last[i * 8 + j]) << BigInt(j * 8);
    }
    state[i] ^= word;
  }
  keccakF(state);

  // Squeeze
  const outputBytes = bitLen / 8;
  const out: number[] = [];
  for (let i = 0; i < outputBytes / 8; i++) {
    const word = state[i];
    for (let j = 0; j < 8; j++) {
      out.push(Number((word >> BigInt(j * 8)) & 0xffn));
    }
  }
  return out.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-3 uses 0x06 domain padding; plain Keccak uses 0x01
export function sha3_256Hex(input: string | ArrayBuffer): string {
  return keccakHash(input, 256, 0x06);
}

export function sha3_512Hex(input: string | ArrayBuffer): string {
  return keccakHash(input, 512, 0x06);
}

// ── SHA-224 (pure-TS) ─────────────────────────────────────────────────────────
// SHA-224 is SHA-256 with different initial hash values, truncated to 224 bits.
// SubtleCrypto supports SHA-224 in browsers but not in Node.js / jsdom, so we
// use a pure implementation for portability.

const SHA256_K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256Core(input: string | ArrayBuffer, H: number[]): number[] {
  const bytes: Uint8Array =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);

  const msgLen = bytes.length;
  const bitLen = msgLen * 8;
  // SHA-256 padding: same as MD5 but big-endian length
  const paddedLen = msgLen + 1 + ((55 - (msgLen % 64) + 64) % 64) + 8;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const dv = new DataView(padded.buffer);
  // 64-bit big-endian bit length
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const state = [...H];

  for (let off = 0; off < paddedLen; off += 64) {
    const W: number[] = new Array(64);
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(W[i - 15], 7) ^ rotr32(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr32(W[i - 2], 17) ^ rotr32(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  return state;
}

const SHA224_H0 = [
  0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4,
];

export function sha224Hex(input: string | ArrayBuffer): string {
  const state = sha256Core(input, [...SHA224_H0]);
  // SHA-224 uses only first 7 of 8 words
  return state
    .slice(0, 7)
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
}

// ── SubtleCrypto helpers ──────────────────────────────────────────────────────

type SubtleAlgo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

async function subtleHex(algo: SubtleAlgo, input: string | ArrayBuffer): Promise<string> {
  const data: ArrayBuffer =
    typeof input === "string" ? (new TextEncoder().encode(input).buffer as ArrayBuffer) : input;
  const hashBuf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const sha1Hex = (input: string | ArrayBuffer): Promise<string> => subtleHex("SHA-1", input);

export const sha256Hex = (input: string | ArrayBuffer): Promise<string> =>
  subtleHex("SHA-256", input);

export const sha384Hex = (input: string | ArrayBuffer): Promise<string> =>
  subtleHex("SHA-384", input);

export const sha512Hex = (input: string | ArrayBuffer): Promise<string> =>
  subtleHex("SHA-512", input);

// ── HMAC ─────────────────────────────────────────────────────────────────────

export type HmacAlgo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export async function hmacHex(
  algo: HmacAlgo,
  key: string | ArrayBuffer,
  message: string | ArrayBuffer
): Promise<string> {
  const keyData: ArrayBuffer =
    typeof key === "string" ? (new TextEncoder().encode(key).buffer as ArrayBuffer) : key;
  const msgData: ArrayBuffer =
    typeof message === "string"
      ? (new TextEncoder().encode(message).buffer as ArrayBuffer)
      : message;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: algo } },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Encoding helpers ─────────────────────────────────────────────────────────

export type OutputEncoding = "hex" | "base64" | "base64url";

/** Convert a lowercase hex string to a base64 string. */
export function hexToBase64(hex: string, urlSafe = false): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const b64 = btoa(String.fromCharCode(...bytes));
  if (urlSafe) {
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return b64;
}

/** Encode a hex output according to the requested encoding. */
export function encodeOutput(hex: string, encoding: OutputEncoding, uppercase: boolean): string {
  if (encoding === "base64") return hexToBase64(hex, false);
  if (encoding === "base64url") return hexToBase64(hex, true);
  // hex
  return uppercase ? hex.toUpperCase() : hex.toLowerCase();
}

// ── Batch: all algos ──────────────────────────────────────────────────────────

export interface HashResult {
  md5: string;
  sha1: string;
  sha224: string;
  sha256: string;
  sha384: string;
  sha512: string;
  sha3_256: string;
  sha3_512: string;
  crc32: string;
}

export async function hashAll(input: string | ArrayBuffer): Promise<HashResult> {
  const [sha1, sha224, sha256, sha384, sha512] = await Promise.all([
    sha1Hex(input),
    sha224Hex(input),
    sha256Hex(input),
    sha384Hex(input),
    sha512Hex(input),
  ]);
  return {
    md5: md5Hex(input),
    sha1,
    sha224,
    sha256,
    sha384,
    sha512,
    sha3_256: sha3_256Hex(input),
    sha3_512: sha3_512Hex(input),
    crc32: crc32Hex(input),
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function readFileBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
