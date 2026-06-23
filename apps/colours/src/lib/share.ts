/**
 * Shareable permalink encoding/decoding for the Colours app state.
 *
 * Encoding scheme: compact JSON (keys abbreviated) → base64url → stored in
 * the URL hash as `#s=<base64url>`. Hash is chosen over query params so the
 * state never reaches the server and round-trips cleanly through copy/paste.
 *
 * base64url (RFC 4648 §5) replaces +/= with -_~ so the fragment survives
 * copy/paste without percent-encoding.
 *
 * decodeState is deliberately defensive — any parse error or invalid value
 * returns null; callers should fall back to store defaults.
 */

import type { PaletteState, ThreePointState, TwoPointState } from "../store";
import { COLOR_SPACES, normalizeHex } from "./color";
import type { ColorSpace } from "./color";
import { HARMONY_MODES, MIN_PALETTE_COUNT, clampCount } from "./palette";
import type { HarmonyMode } from "./palette";

// ── Abbreviated key shape written to the hash ─────────────────────────────────

interface EncodedPayload {
  /** palette colors */
  pc: string[];
  /** palette locked flags */
  pl: boolean[];
  /** palette count */
  pn: number;
  /** palette harmony mode */
  ph: string;
  /** two-point start */
  ts: string;
  /** two-point end */
  te: string;
  /** two-point steps */
  tn: number;
  /** three-point start */
  rs: string;
  /** three-point mid */
  rm: string;
  /** three-point end */
  re: string;
  /** three-point steps */
  rn: number;
  /** interpolation space */
  sp: string;
}

// ── Serialization ─────────────────────────────────────────────────────────────

function toBase64url(str: string): string {
  // btoa expects a binary string; TextEncoder handles any Unicode
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(b64: string): string {
  // Re-pad and convert +/_ back to standard base64
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const rem = padded.length % 4;
  const padded2 = rem === 0 ? padded : padded + "====".slice(rem);
  const binary = atob(padded2);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ShareableState {
  palette: PaletteState;
  twoPoint: TwoPointState;
  threePoint: ThreePointState;
  space: ColorSpace;
}

const VALID_HARMONY_MODES = new Set<string>(HARMONY_MODES.map((m) => m.value));
const VALID_SPACES = new Set<string>(COLOR_SPACES);

export function encodeState(state: ShareableState): string {
  const payload: EncodedPayload = {
    pc: state.palette.colors,
    pl: state.palette.locked,
    pn: state.palette.count,
    ph: state.palette.harmonyMode,
    ts: state.twoPoint.start,
    te: state.twoPoint.end,
    tn: state.twoPoint.steps,
    rs: state.threePoint.start,
    rm: state.threePoint.mid,
    re: state.threePoint.end,
    rn: state.threePoint.steps,
    sp: state.space,
  };
  return toBase64url(JSON.stringify(payload));
}

/**
 * Decode a base64url-encoded state string. Returns null (never throws) on any
 * parse error, invalid value, or structural mismatch — callers use defaults.
 */
export function decodeState(encoded: string): ShareableState | null {
  if (!encoded || typeof encoded !== "string") return null;
  try {
    const raw = fromBase64url(encoded);
    const p: Partial<EncodedPayload> = JSON.parse(raw);

    // Validate and clamp count first — it governs array lengths
    const count = clampCount(typeof p.pn === "number" ? p.pn : MIN_PALETTE_COUNT);

    // Validate colors array
    const rawColors = Array.isArray(p.pc) ? p.pc : [];
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      const normalized = normalizeHex(String(rawColors[i] ?? ""));
      colors.push(normalized ?? "#000000");
    }

    // Validate locked array — must match count
    const rawLocked = Array.isArray(p.pl) ? p.pl : [];
    const locked: boolean[] = Array.from({ length: count }, (_, i) =>
      Boolean(rawLocked[i] ?? false)
    );

    // Validate harmony mode
    const harmonyMode: HarmonyMode = VALID_HARMONY_MODES.has(String(p.ph))
      ? (p.ph as HarmonyMode)
      : "analogous";

    // Validate interpolation space
    const space: ColorSpace = VALID_SPACES.has(String(p.sp)) ? (p.sp as ColorSpace) : "lab";

    // Validate two-point hex values (fall back to defaults on bad input)
    const twoStart = normalizeHex(String(p.ts ?? "")) ?? "#2d3a4a";
    const twoEnd = normalizeHex(String(p.te ?? "")) ?? "#d4a574";
    const twoSteps = typeof p.tn === "number" && p.tn >= 2 && p.tn <= 32 ? p.tn : 8;

    // Validate three-point hex values
    const threeStart = normalizeHex(String(p.rs ?? "")) ?? "#1b4332";
    const threeMid = normalizeHex(String(p.rm ?? "")) ?? "#74c69d";
    const threeEnd = normalizeHex(String(p.re ?? "")) ?? "#f8f4e1";
    const threeSteps = typeof p.rn === "number" && p.rn >= 2 && p.rn <= 32 ? p.rn : 9;

    return {
      palette: { colors, locked, count, harmonyMode },
      twoPoint: { start: twoStart, end: twoEnd, steps: twoSteps },
      threePoint: { start: threeStart, mid: threeMid, end: threeEnd, steps: threeSteps },
      space,
    };
  } catch {
    return null;
  }
}

/** Read the encoded state from the URL hash, if present. */
export function readHashState(): ShareableState | null {
  try {
    const hash = window.location.hash; // "#s=..."
    if (!hash.startsWith("#s=")) return null;
    return decodeState(hash.slice(3));
  } catch {
    return null;
  }
}

/** Write the encoded state into the URL hash without pushing a history entry. */
export function writeHashState(state: ShareableState): void {
  try {
    const encoded = encodeState(state);
    const url = `${window.location.pathname}${window.location.search}#s=${encoded}`;
    window.history.replaceState(null, "", url);
  } catch {
    // silently ignore (e.g. in test environments without history API)
  }
}
