/**
 * UUID generation: v4 (random), v7 (time-ordered), and Nano ID.
 * Also: v1 (time + random node), v3 (MD5 name-based), v5 (SHA-1 name-based),
 * ULID generation, format conversion (braces, base64).
 *
 * All purely client-side using crypto.getRandomValues / SubtleCrypto.
 * No external dependencies.
 */

// ── UUID v4 (RFC 4122 random) ─────────────────────────────────────────────────

export function uuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version bits: 4 (0100) in byte 6 high nibble
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits: 10xx in byte 8 high bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuidBytes(bytes);
}

// ── UUID v7 (Unix ms timestamp + random) RFC 9562 ────────────────────────────

export function uuidV7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const ms = BigInt(Date.now());

  // Bytes 0-5: 48-bit Unix timestamp in milliseconds (big-endian)
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);

  // Bytes 6-7: version 7 (0111) in high nibble of byte 6; low 12 bits random
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Bytes 8-9: variant 10xx in high bits of byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return formatUuidBytes(bytes);
}

// ── UUID v1 (time-based + random node) ───────────────────────────────────────
// Uses a random node ID (browser has no MAC access) and current time.
// Gregorian epoch offset: 122192928000000000 (100ns ticks from 1582-10-15)

const GREGORIAN_OFFSET = 122192928000000000n;

// Track last v1 timestamp + clock sequence to avoid duplicates within same ms
let _v1LastTs = -1n;
let _v1ClockSeq = -1;

export function uuidV1(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 100-nanosecond intervals since Gregorian epoch
  // Date.now() gives ms; multiply by 10000 for 100ns ticks
  let ts = BigInt(Date.now()) * 10000n + GREGORIAN_OFFSET;

  if (_v1ClockSeq === -1) {
    // Initialize clock sequence randomly
    _v1ClockSeq = ((bytes[8] << 8) | bytes[9]) & 0x3fff;
  }

  if (ts <= _v1LastTs) {
    // Clock went backward or same ms: bump clock sequence
    _v1ClockSeq = (_v1ClockSeq + 1) & 0x3fff;
    ts = _v1LastTs + 1n;
  }
  _v1LastTs = ts;

  // time_low (32 bits)
  const timeLow = ts & 0xffffffffn;
  // time_mid (16 bits)
  const timeMid = (ts >> 32n) & 0xffffn;
  // time_hi_and_version (12 bits of time + 4-bit version 1)
  const timeHiVer = ((ts >> 48n) & 0x0fffn) | 0x1000n;

  // Pack bytes
  // time_low: bytes 0-3
  bytes[0] = Number((timeLow >> 24n) & 0xffn);
  bytes[1] = Number((timeLow >> 16n) & 0xffn);
  bytes[2] = Number((timeLow >> 8n) & 0xffn);
  bytes[3] = Number(timeLow & 0xffn);
  // time_mid: bytes 4-5
  bytes[4] = Number((timeMid >> 8n) & 0xffn);
  bytes[5] = Number(timeMid & 0xffn);
  // time_hi_and_version: bytes 6-7
  bytes[6] = Number((timeHiVer >> 8n) & 0xffn);
  bytes[7] = Number(timeHiVer & 0xffn);
  // clock_seq_hi_res (variant 10xx): byte 8
  bytes[8] = ((_v1ClockSeq >> 8) & 0x3f) | 0x80;
  // clock_seq_low: byte 9
  bytes[9] = _v1ClockSeq & 0xff;
  // node (48 bits random, bytes 10-15): already random from getRandomValues

  return formatUuidBytes(bytes);
}

// ── UUID v5 (SHA-1 name-based) ────────────────────────────────────────────────

export async function uuidV5(namespace: string, name: string): Promise<string> {
  const nsBytes = parseUuidToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(nsBytes.length + nameBytes.length);
  combined.set(nsBytes);
  combined.set(nameBytes, nsBytes.length);
  const hashBuf = await crypto.subtle.digest("SHA-1", combined);
  const bytes = new Uint8Array(hashBuf).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  return formatUuidBytes(bytes);
}

// MD5 is not available in SubtleCrypto -- implement a pure-JS fallback.
// This is a compact but correct MD5, used only for UUID v3.
function md5(input: Uint8Array): Uint8Array {
  // Per-round shift amounts
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  // Precomputed table: floor(abs(sin(i+1)) * 2^32)
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  const msgLen = input.length;
  const bitLen = msgLen * 8;

  // Pad to 448 mod 512 bits, then append 64-bit length
  const padLen = msgLen % 64 < 56 ? 56 - (msgLen % 64) : 120 - (msgLen % 64);
  const padded = new Uint8Array(msgLen + padLen + 8);
  padded.set(input);
  padded[msgLen] = 0x80;
  // Append bit length as little-endian 64-bit
  let lenLo = bitLen >>> 0;
  let lenHi = Math.floor(bitLen / 0x100000000) >>> 0;
  for (let i = 0; i < 4; i++) {
    padded[msgLen + padLen + i] = lenLo & 0xff;
    lenLo >>>= 8;
  }
  for (let i = 0; i < 4; i++) {
    padded[msgLen + padLen + 4 + i] = lenHi & 0xff;
    lenHi >>>= 8;
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const view = new DataView(padded.buffer);

  for (let offset = 0; offset < padded.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(offset + i * 4, true);
    }

    let [A, B, C, D] = [a0, b0, c0, d0];

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const result = new Uint8Array(16);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, a0, true);
  rv.setUint32(4, b0, true);
  rv.setUint32(8, c0, true);
  rv.setUint32(12, d0, true);
  return result;
}

// Override uuidV3 to use pure-JS MD5 (SubtleCrypto doesn't support MD5)
export async function uuidV3Impl(namespace: string, name: string): Promise<string> {
  const nsBytes = parseUuidToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(nsBytes.length + nameBytes.length);
  combined.set(nsBytes);
  combined.set(nameBytes, nsBytes.length);
  const bytes = md5(combined);
  bytes[6] = (bytes[6] & 0x0f) | 0x30; // version 3
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  return formatUuidBytes(bytes);
}

// ── ULID (Universally Unique Lexicographically Sortable Identifier) ───────────
// 48-bit ms timestamp + 80 bits random, Crockford base32, 26 chars.

const ULID_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(): string {
  const tsMs = Date.now();
  let t = tsMs;
  const tParts: string[] = [];
  for (let i = 0; i < 10; i++) {
    tParts.unshift(ULID_CHARS[t % 32]);
    t = Math.floor(t / 32);
  }

  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);

  // 80 bits = 16 Crockford base32 chars (5 bits each)
  // Pack 10 bytes into 16 chars
  const rParts: string[] = [];
  let buf = 0n;
  let bits = 0;
  for (const byte of randomBytes) {
    buf = (buf << 8n) | BigInt(byte);
    bits += 8;
  }
  for (let i = 0; i < 16; i++) {
    bits -= 5;
    rParts.unshift(ULID_CHARS[Number((buf >> BigInt(bits)) & 0x1fn)]);
  }

  return tParts.join("") + rParts.join("");
}

// ── Namespace UUIDs (RFC 4122 appendix C) ─────────────────────────────────────

export const UUID_NAMESPACES = {
  DNS: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  URL: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  OID: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  X500: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
} as const;

export type NamespaceKey = keyof typeof UUID_NAMESPACES;

// ── Nano ID (URL-safe, 21 chars, 126 bits) ────────────────────────────────────

const NANOID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
const NANOID_DEFAULT_SIZE = 21;

export function nanoid(size: number = NANOID_DEFAULT_SIZE): string {
  // Rejection-sampling against the 64-char alphabet using a 6-bit mask.
  const mask = 63; // 0b00111111
  const step = Math.ceil((1.6 * mask * size) / NANOID_ALPHABET.length);
  let id = "";
  while (id.length < size) {
    const bytes = new Uint8Array(step);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < step && id.length < size; i++) {
      const idx = bytes[i] & mask;
      if (idx < NANOID_ALPHABET.length) {
        id += NANOID_ALPHABET[idx];
      }
    }
  }
  return id;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatUuidBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function parseUuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error(`Invalid UUID: ${uuid}`);
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ── Format / display helpers ──────────────────────────────────────────────────

export type OutputFormat = "plain" | "braces" | "base64" | "urn";

export function applyOutputFormat(id: string, format: OutputFormat): string {
  // id here is already the raw UUID or ULID string (dashes/case already applied)
  switch (format) {
    case "braces":
      return `{${id}}`;
    case "base64": {
      // Convert UUID hex to bytes, then base64url
      const hex = id.replace(/-/g, "").replace(/[{}]/g, "");
      if (hex.length === 32) {
        // Standard UUID
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
          bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return btoa(String.fromCharCode(...bytes));
      }
      // ULID or Nano ID -- just base64-encode UTF-8 bytes
      return btoa(id);
    }
    case "urn":
      return `urn:uuid:${id}`;
    default:
      return id;
  }
}

export function applyOptions(
  id: string,
  opts: { uppercase: boolean; noDashes: boolean; format?: OutputFormat }
): string {
  let out = id;
  if (opts.noDashes) out = out.replace(/-/g, "");
  if (opts.uppercase) out = out.toUpperCase();
  if (opts.format && opts.format !== "plain") out = applyOutputFormat(out, opts.format);
  return out;
}

// ── Bulk copy format ──────────────────────────────────────────────────────────

export type CopyFormat = "newline" | "comma" | "json" | "quoted";

export function formatBulk(ids: string[], copyFormat: CopyFormat): string {
  switch (copyFormat) {
    case "comma":
      return ids.join(", ");
    case "json":
      return JSON.stringify(ids, null, 2);
    case "quoted":
      return ids.map((id) => `"${id}"`).join(",\n");
    default:
      return ids.join("\n");
  }
}

// ── Bulk generation ───────────────────────────────────────────────────────────

export type UuidKind = "v4" | "v7" | "v1" | "nanoid" | "ulid";

// generateBatch is sync for v4/v7/v1/nanoid/ulid
// v3/v5 are handled separately (async) via generateNameBased
export function generateBatch(kind: UuidKind, count: number): string[] {
  let gen: () => string;
  switch (kind) {
    case "v4":
      gen = uuidV4;
      break;
    case "v7":
      gen = uuidV7;
      break;
    case "v1":
      gen = uuidV1;
      break;
    case "ulid":
      gen = ulid;
      break;
    default:
      gen = nanoid;
  }
  return Array.from({ length: count }, () => gen());
}

export async function generateNameBased(
  kind: "v3" | "v5",
  namespace: string,
  name: string,
  count: number
): Promise<string[]> {
  const fn = kind === "v3" ? uuidV3Impl : uuidV5;
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    // For name-based, name is typically the same -- generate variants if count > 1
    // by appending index suffix (common UX behaviour)
    const nameArg = count > 1 ? `${name}/${i}` : name;
    results.push(await fn(namespace, nameArg));
  }
  return results;
}

// ── UUID Inspector ────────────────────────────────────────────────────────────

export type UuidVersion = 1 | 3 | 4 | 5 | 6 | 7 | 8;
export type UuidVariant = "RFC 4122" | "Microsoft" | "NCS" | "Reserved" | "Unknown";

export interface InspectResult {
  valid: boolean;
  raw: string;
  version?: UuidVersion;
  variant?: UuidVariant;
  // v1-specific
  timestampIso?: string;
  clockSeq?: number;
  node?: string;
  // v7-specific
  timestampMs?: number;
  // general
  isNilUuid?: boolean;
  isMaxUuid?: boolean;
  bytes?: string; // space-separated hex bytes
  fields?: { label: string; value: string }[];
}

export function inspectUuid(input: string): InspectResult {
  const trimmed = input.trim().replace(/^\{|\}$/g, "");

  // Nil UUID
  if (trimmed === "00000000-0000-0000-0000-000000000000") {
    return {
      valid: true,
      raw: trimmed,
      isNilUuid: true,
      bytes: formatBytes(parseUuidToBytes(trimmed)),
      fields: [{ label: "Type", value: "Nil UUID (all zeros)" }],
    };
  }
  // Max UUID
  if (trimmed === "ffffffff-ffff-ffff-ffff-ffffffffffff") {
    return {
      valid: true,
      raw: trimmed,
      isMaxUuid: true,
      bytes: formatBytes(parseUuidToBytes(trimmed)),
      fields: [{ label: "Type", value: "Max UUID (all ones, RFC 9562)" }],
    };
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!UUID_RE.test(trimmed)) {
    return { valid: false, raw: trimmed };
  }

  const lower = trimmed.toLowerCase();
  let bytes: Uint8Array;
  try {
    bytes = parseUuidToBytes(lower);
  } catch {
    return { valid: false, raw: trimmed };
  }

  // Version: top 4 bits of byte 6
  const versionNibble = (bytes[6] >> 4) & 0x0f;
  const version = (versionNibble >= 1 && versionNibble <= 8 ? versionNibble : undefined) as
    | UuidVersion
    | undefined;

  // Variant: top bits of byte 8
  const variantBits = bytes[8];
  let variant: UuidVariant;
  if ((variantBits & 0x80) === 0) {
    variant = "NCS";
  } else if ((variantBits & 0xc0) === 0x80) {
    variant = "RFC 4122";
  } else if ((variantBits & 0xe0) === 0xc0) {
    variant = "Microsoft";
  } else {
    variant = "Reserved";
  }

  const result: InspectResult = {
    valid: true,
    raw: lower,
    version,
    variant,
    bytes: formatBytes(bytes),
    fields: [],
  };

  const fields = result.fields ?? [];
  fields.push({ label: "Version", value: version != null ? `v${version}` : "Unknown" });
  fields.push({ label: "Variant", value: variant });

  if (version === 1) {
    // Reconstruct 60-bit timestamp from time_low (32), time_mid (16), time_hi (12)
    const timeLow =
      BigInt((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) & 0xffffffffn;
    const timeMid = BigInt((bytes[4] << 8) | bytes[5]);
    const timeHi = (BigInt(bytes[6] & 0x0f) << 8n) | BigInt(bytes[7]);
    const ts100ns = (timeHi << 48n) | (timeMid << 32n) | timeLow;
    const tsMs = Number((ts100ns - GREGORIAN_OFFSET) / 10000n);
    const tsDate = new Date(tsMs);
    const clockSeq = ((bytes[8] & 0x3f) << 8) | bytes[9];
    const node = Array.from(bytes.slice(10))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(":");

    result.timestampIso = tsDate.toISOString();
    result.clockSeq = clockSeq;
    result.node = node;
    fields.push({ label: "Timestamp", value: tsDate.toISOString() });
    fields.push({ label: "Clock Seq", value: clockSeq.toString() });
    fields.push({ label: "Node", value: node });
  }

  if (version === 7) {
    // First 48 bits = Unix timestamp in ms
    const tsMs =
      bytes[0] * 0x10000000000 +
      bytes[1] * 0x100000000 +
      bytes[2] * 0x1000000 +
      bytes[3] * 0x10000 +
      bytes[4] * 0x100 +
      bytes[5];
    const tsDate = new Date(tsMs);
    result.timestampMs = tsMs;
    fields.push({ label: "Timestamp", value: tsDate.toISOString() });
    fields.push({ label: "Unix ms", value: tsMs.toString() });
  }

  // Hex bytes grouped for readability
  fields.push({ label: "Bytes", value: formatBytes(bytes) });

  return result;
}

function formatBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

// ── Download ──────────────────────────────────────────────────────────────────

export function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
