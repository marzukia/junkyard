/**
 * Pure helpers for checksum verification and algorithm detection.
 * These are extracted from App.tsx so they can be unit-tested.
 */
import type { HashResult } from "./hash";

export type AlgoName =
  | "MD5"
  | "CRC32"
  | "SHA-1"
  | "SHA-224"
  | "SHA-256"
  | "SHA-384"
  | "SHA-512"
  | "SHA3-256"
  | "SHA3-512";

export const ALGO_LENGTHS: Record<AlgoName, number> = {
  CRC32: 8,
  MD5: 32,
  "SHA-1": 40,
  "SHA-224": 56,
  "SHA-256": 64,
  "SHA-384": 96,
  "SHA-512": 128,
  "SHA3-256": 64,
  "SHA3-512": 128,
};

/**
 * Returns the algorithm names that are consistent with the length and
 * character set of the given hex string. Does NOT require a computed result.
 */
export function detectAlgos(hex: string): AlgoName[] {
  const cleaned = hex.trim().toLowerCase();
  if (!cleaned || !/^[0-9a-f]+$/.test(cleaned)) return [];
  return (Object.entries(ALGO_LENGTHS) as [AlgoName, number][])
    .filter(([, len]) => cleaned.length === len)
    .map(([name]) => name);
}

/**
 * Returns which hash result field corresponds to a given AlgoName.
 * SHA3-256 and SHA-256 share the same hex length (64 chars), so we check
 * both via matchedAlgo which tries all fields.
 */
function resultForAlgo(result: HashResult, algo: AlgoName): string {
  const map: Record<AlgoName, string> = {
    MD5: result.md5,
    CRC32: result.crc32,
    "SHA-1": result.sha1,
    "SHA-224": result.sha224,
    "SHA-256": result.sha256,
    "SHA-384": result.sha384,
    "SHA-512": result.sha512,
    "SHA3-256": result.sha3_256,
    "SHA3-512": result.sha3_512,
  };
  return map[algo];
}

/**
 * Given a computed HashResult and a target checksum string, returns which
 * algorithm produced a match, or null if none matches.
 */
export function matchedAlgo(result: HashResult, target: string): AlgoName | null {
  const t = target.trim().toLowerCase();
  if (!t) return null;
  // Check in a consistent order
  const order: AlgoName[] = [
    "CRC32",
    "MD5",
    "SHA-1",
    "SHA-224",
    "SHA-256",
    "SHA3-256",
    "SHA-384",
    "SHA-512",
    "SHA3-512",
  ];
  for (const algo of order) {
    if (resultForAlgo(result, algo).toLowerCase() === t) return algo;
  }
  return null;
}

/**
 * Determines the match status for a single hash row.
 *
 * Bug fix: previously all rows showed "mismatch" when a SHA-256 checksum was
 * pasted. The correct behaviour is:
 *   - If the target matches this row: "match"
 *   - If the target's length/chars could only be this algorithm: "mismatch"
 *   - Otherwise (length doesn't match this row's algo): null (no badge)
 *
 * This way, pasting a 64-char SHA-256 hash only shows a badge on SHA-256 and
 * SHA3-256 rows (the only ambiguous candidates at that length); MD5/SHA-1/etc
 * stay silent.
 */
export function rowMatchStatus(
  rowAlgo: AlgoName,
  _rowHex: string,
  target: string,
  matchedResult: AlgoName | null
): "match" | "mismatch" | null {
  const t = target.trim().toLowerCase();
  if (!t) return null;

  // If this row is the confirmed match, show match
  if (matchedResult === rowAlgo) return "match";

  // Only show mismatch if the target length is consistent with this algo
  const detected = detectAlgos(t);
  if (!detected.includes(rowAlgo)) return null;

  // Target length matches this algo but the value didn't match
  return "mismatch";
}
