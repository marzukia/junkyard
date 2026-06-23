/**
 * Colour-vision deficiency (CVD) simulation.
 *
 * Method: Machado, Oliveira & Fernandes (2009) "A Physiologically-based Model
 * for Simulation of Color Vision Deficiency". The 3×3 matrices below are taken
 * from Table 1 of that paper (severity = 1.0 / full deficiency).
 *
 * Pipeline:
 *   sRGB (0–1) → linearise → apply CVD matrix → de-linearise → clamp → hex
 *
 * The transform operates in linear light (not gamma-encoded) to avoid hue
 * shifts that would occur if you applied the matrix to gamma-compressed values.
 *
 * `none` is the identity — returns the input unchanged.
 * `achromatopsia` uses a luminance-preserving desaturation (no Machado matrix
 * exists; we use the standard WCAG luminance coefficients to collapse to grey).
 */

export type CvdType = "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";

/** All valid CVD types, in display order. */
export const CVD_TYPES: CvdType[] = [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
];

// ── Machado 2009 matrices (severity = 1.0) ───────────────────────────────────
// Each row: [Rout_coeff_R, Rout_coeff_G, Rout_coeff_B]

const PROTANOPIA_M: readonly [number, number, number][] = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
];

const DEUTERANOPIA_M: readonly [number, number, number][] = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968878],
];

const TRITANOPIA_M: readonly [number, number, number][] = [
  [1.255528, -0.076749, -0.178779],
  [-0.078411, 0.930809, 0.147602],
  [0.004733, 0.691367, 0.3039],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function linearise(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function delinearise(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function to2digit(n: number): string {
  return Math.round(clamp01(n) * 255)
    .toString(16)
    .padStart(2, "0");
}

function applyMatrix(
  r: number,
  g: number,
  b: number,
  m: readonly [number, number, number][]
): [number, number, number] {
  return [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Simulate how `hex` appears under the given CVD type.
 * Returns a normalised `#rrggbb` string. Always deterministic.
 * `none` returns the input unchanged (after normalising case/format).
 */
export function simulate(hex: string, type: CvdType): string {
  const stripped = hex.replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(stripped)) return hex;

  if (type === "none") return `#${stripped}`;

  // Parse sRGB 0–1
  const rs = Number.parseInt(stripped.slice(0, 2), 16) / 255;
  const gs = Number.parseInt(stripped.slice(2, 4), 16) / 255;
  const bs = Number.parseInt(stripped.slice(4, 6), 16) / 255;

  // Linearise
  const rl = linearise(rs);
  const gl = linearise(gs);
  const bl = linearise(bs);

  let ro: number;
  let go: number;
  let bo: number;

  if (type === "achromatopsia") {
    // Luminance-preserving full desaturation (WCAG luminance coefficients)
    const lum = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
    ro = lum;
    go = lum;
    bo = lum;
  } else {
    const matrix =
      type === "protanopia"
        ? PROTANOPIA_M
        : type === "deuteranopia"
          ? DEUTERANOPIA_M
          : TRITANOPIA_M;
    [ro, go, bo] = applyMatrix(rl, gl, bl, matrix);
  }

  // De-linearise and encode
  return `#${to2digit(delinearise(ro))}${to2digit(delinearise(go))}${to2digit(delinearise(bo))}`;
}
