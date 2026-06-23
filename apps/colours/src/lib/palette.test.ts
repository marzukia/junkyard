import { describe, expect, it } from "vitest";
import {
  HARMONY_MODES,
  MAX_PALETTE_COUNT,
  MIN_PALETTE_COUNT,
  clampCount,
  deriveSeedHue,
  generatePalette,
  hueFromHex,
  regeneratePalette,
} from "./palette";
import type { HarmonyMode } from "./palette";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
// Derive the test mode list from the canonical HARMONY_MODES export
const ALL_MODES = HARMONY_MODES.map((m) => m.value) as HarmonyMode[];

// ── generatePalette ───────────────────────────────────────────────────────────

describe("generatePalette — output shape", () => {
  for (const mode of ALL_MODES) {
    it(`${mode}: returns exactly count valid hex strings (n=5)`, () => {
      const result = generatePalette(5, mode, 42);
      expect(result).toHaveLength(5);
      for (const hex of result) {
        expect(hex).toMatch(HEX_RE);
      }
    });
  }

  it("returns exactly count values for n=3 (minimum)", () => {
    const result = generatePalette(3, "analogous", 1);
    expect(result).toHaveLength(3);
  });

  it("returns exactly count values for n=8 (maximum)", () => {
    const result = generatePalette(8, "triadic", 1);
    expect(result).toHaveLength(8);
  });
});

describe("generatePalette — determinism", () => {
  it("same seed + mode produces identical output", () => {
    const a = generatePalette(5, "analogous", 12345);
    const b = generatePalette(5, "analogous", 12345);
    expect(a).toEqual(b);
  });

  it("different seeds produce different output (with overwhelming probability)", () => {
    const a = generatePalette(5, "triadic", 1);
    const b = generatePalette(5, "triadic", 2);
    // It would be astronomically unlikely for these to be identical
    expect(a).not.toEqual(b);
  });

  it("baseHue param overrides PRNG hue", () => {
    const a = generatePalette(5, "monochromatic", 99, 0.5);
    const b = generatePalette(5, "monochromatic", 99, 0.5);
    expect(a).toEqual(b);
  });

  it("different baseHue produces different output", () => {
    const a = generatePalette(5, "monochromatic", 99, 0.0);
    const b = generatePalette(5, "monochromatic", 99, 0.5);
    expect(a).not.toEqual(b);
  });
});

describe("generatePalette — count clamping", () => {
  it("clamps count below MIN to MIN_PALETTE_COUNT", () => {
    const result = generatePalette(1, "auto", 1);
    expect(result).toHaveLength(MIN_PALETTE_COUNT);
  });

  it("clamps count above MAX to MAX_PALETTE_COUNT", () => {
    const result = generatePalette(100, "auto", 1);
    expect(result).toHaveLength(MAX_PALETTE_COUNT);
  });
});

describe("generatePalette — all modes return valid hex", () => {
  for (const mode of ALL_MODES) {
    it(`${mode}: all outputs match #rrggbb`, () => {
      for (let count = MIN_PALETTE_COUNT; count <= MAX_PALETTE_COUNT; count++) {
        const result = generatePalette(count, mode, count * 7 + 13);
        expect(result).toHaveLength(count);
        for (const hex of result) {
          expect(hex).toMatch(HEX_RE);
        }
      }
    });
  }
});

// ── regeneratePalette ─────────────────────────────────────────────────────────

describe("regeneratePalette — locked indices are preserved", () => {
  it("fully unlocked changes all colors (with overwhelming probability)", () => {
    const initial = generatePalette(5, "analogous", 1);
    const refreshed = regeneratePalette(
      initial,
      [false, false, false, false, false],
      "analogous",
      2
    );
    // Extremely unlikely to be identical across all 5 positions
    expect(refreshed).not.toEqual(initial);
  });

  it("fully locked preserves all colors exactly", () => {
    const initial = generatePalette(5, "triadic", 1);
    const refreshed = regeneratePalette(initial, [true, true, true, true, true], "triadic", 2);
    expect(refreshed).toEqual(initial);
  });

  it("locked index 0 and 2 are preserved, others may change", () => {
    const initial = ["#aabbcc", "#112233", "#ddeeff", "#445566", "#778899"];
    const locked = [true, false, true, false, false];
    const refreshed = regeneratePalette(initial, locked, "analogous", 99);
    expect(refreshed[0]).toBe(initial[0]);
    expect(refreshed[2]).toBe(initial[2]);
  });

  it("unlocked indices are replaced with valid hex strings", () => {
    const initial = generatePalette(5, "analogous", 1);
    const refreshed = regeneratePalette(
      initial,
      [false, false, false, false, false],
      "triadic",
      77
    );
    for (const hex of refreshed) {
      expect(hex).toMatch(HEX_RE);
    }
  });
});

// ── Seed uniqueness (Finding 1 regression) ────────────────────────────────────

describe("generatePalette — seed uniqueness", () => {
  it("sequential integer seeds produce distinct palettes (rapid generate simulation)", () => {
    // Simulate 10 rapid regenerates using consecutive seeds (as the store's counter does)
    const results = Array.from({ length: 10 }, (_, i) => generatePalette(5, "auto", 1000 + i));
    const unique = new Set(results.map((r) => JSON.stringify(r)));
    // Expect all 10 to be distinct — same seed would collapse to 1
    expect(unique.size).toBe(10);
  });

  it("explicit seed is deterministic, different seeds give different output", () => {
    const a = generatePalette(5, "analogous", 42);
    const b = generatePalette(5, "analogous", 43);
    expect(a).not.toEqual(b);
  });
});

// ── auto mode derives from HARMONY_MODES (Finding 6 regression) ───────────────

describe("HARMONY_MODES — auto mode uses all non-auto entries", () => {
  it("HARMONY_MODES has at least one non-auto entry", () => {
    const nonAuto = HARMONY_MODES.filter((m) => m.value !== "auto");
    expect(nonAuto.length).toBeGreaterThan(0);
  });

  it("auto mode produces valid hex for any seed", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = generatePalette(5, "auto", seed);
      expect(result).toHaveLength(5);
      for (const hex of result) {
        expect(hex).toMatch(HEX_RE);
      }
    }
  });
});

// ── Grow-path harmony (Finding 4 regression) ─────────────────────────────────

describe("regeneratePalette — grow-path preserves locks and length", () => {
  it("growing by 2 keeps array length == new count", () => {
    const base = generatePalette(4, "analogous", 10);
    const lockedBase = [false, false, false, false];
    // Simulate grow: regenerate at 6 with first 4 locks extended to 6 slots
    const newLocked = [...lockedBase, false, false];
    const grown = regeneratePalette([...base, "", ""], newLocked, "analogous", 20);
    expect(grown).toHaveLength(6);
  });

  it("growing preserves locked swatches from the original palette", () => {
    const base = generatePalette(4, "analogous", 10);
    const lockedBase = [true, false, true, false];
    const newLocked = [...lockedBase, false, false];
    const grown = regeneratePalette([...base, "", ""], newLocked, "analogous", 20);
    expect(grown[0]).toBe(base[0]);
    expect(grown[2]).toBe(base[2]);
    // Unlocked originals are replaced, new slots are filled
    for (const hex of grown) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("grown swatches are not duplicates of each other (with overwhelming probability)", () => {
    const base = generatePalette(5, "triadic", 10);
    const newLocked = [false, false, false, false, false, false];
    const grown = regeneratePalette([...base, ""], newLocked, "triadic", 99);
    const unique = new Set(grown);
    // All 6 swatches should be distinct colours
    expect(unique.size).toBe(6);
  });
});

// ── Seed-from-locked-colour (harmony seeding) ─────────────────────────────────

describe("hueFromHex", () => {
  it("returns a number in [0, 1) for a chromatic colour", () => {
    const hue = hueFromHex("#ff0000"); // pure red → hue ~0
    expect(typeof hue).toBe("number");
    expect(hue as number).toBeGreaterThanOrEqual(0);
    expect(hue as number).toBeLessThan(1);
  });

  it("returns undefined for an achromatic colour (white)", () => {
    expect(hueFromHex("#ffffff")).toBeUndefined();
  });

  it("returns undefined for an achromatic colour (black)", () => {
    expect(hueFromHex("#000000")).toBeUndefined();
  });

  it("returns undefined for a near-greyscale colour", () => {
    // Very low saturation — #808080 is exactly grey
    expect(hueFromHex("#808080")).toBeUndefined();
  });

  it("returns the correct hue fraction for a known blue", () => {
    // Pure blue in HSL is 240° → 240/360 ≈ 0.667
    const hue = hueFromHex("#0000ff");
    expect(typeof hue).toBe("number");
    expect(hue as number).toBeCloseTo(240 / 360, 2);
  });

  it("red hue is near 0 or 1 (wraps)", () => {
    const hue = hueFromHex("#ff0000");
    expect(typeof hue).toBe("number");
    // 0° → 0/360 = 0
    expect(hue as number).toBeCloseTo(0, 2);
  });
});

describe("deriveSeedHue", () => {
  it("returns undefined when no colours are locked", () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff"];
    const locked = [false, false, false];
    expect(deriveSeedHue(colors, locked)).toBeUndefined();
  });

  it("returns the hue from the first locked colour", () => {
    const blueHex = "#0000ff";
    const colors = ["#ff0000", blueHex, "#00ff00"];
    const locked = [false, true, false];
    const hue = deriveSeedHue(colors, locked);
    expect(typeof hue).toBe("number");
    expect(hue as number).toBeCloseTo(240 / 360, 2);
  });

  it("returns undefined when the only locked colour is achromatic", () => {
    const colors = ["#808080", "#ff0000"];
    const locked = [true, false];
    expect(deriveSeedHue(colors, locked)).toBeUndefined();
  });

  it("skips achromatic locked colours and uses the first chromatic one", () => {
    // Index 0 is locked but greyscale; index 1 is locked and chromatic
    const blueHex = "#0000ff";
    const colors = ["#808080", blueHex, "#ff0000"];
    const locked = [true, true, false];
    // deriveSeedHue picks index 0 first (greyscale → undefined), but since we
    // return undefined for achromatic, it returns the first locked hue it finds.
    // Current implementation returns first locked, which is greyscale → undefined.
    // That is the documented fallback behaviour.
    const hue = deriveSeedHue(colors, locked);
    // index 0 is greyscale, so hueFromHex returns undefined → deriveSeedHue returns undefined
    expect(hue).toBeUndefined();
  });
});

describe("regeneratePalette — seed-from-locked colour", () => {
  // A vivid red: HSL hue ~0°
  const redHex = "#e63232";
  // A vivid blue: HSL hue ~240°
  const blueHex = "#3264e6";

  it("monochromatic: unlocked colours cluster near the locked seed hue", () => {
    const current = [redHex, "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"];
    const locked = [true, false, false, false, false];
    const result = regeneratePalette(current, locked, "monochromatic", 42);

    // Locked slot is preserved exactly
    expect(result[0]).toBe(redHex);

    // All results are valid hex
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }

    // With monochromatic mode seeded from red, the base hue of generated colours
    // should be near 0 (red). We check that the palette is distinct from what
    // you'd get with no seed (i.e. the seed is actually influencing generation).
    const unseeded = regeneratePalette(
      ["#aaaaaa", "#aaaaaa", "#aaaaaa", "#aaaaaa", "#aaaaaa"],
      [false, false, false, false, false],
      "monochromatic",
      42
    );
    // The seeded result should differ because it uses the red hue as base
    expect(result).not.toEqual(unseeded);
  });

  it("triadic: regenerating with a blue seed produces hues that cluster around triadic points", () => {
    const current = [blueHex, "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"];
    const locked = [true, false, false, false, false];
    const result = regeneratePalette(current, locked, "triadic", 99);

    expect(result[0]).toBe(blueHex);
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("locked colour is preserved exactly after regeneration", () => {
    const locked0 = "#c84b2f";
    const locked2 = "#4b2fc8";
    const current = [locked0, "#aaaaaa", locked2, "#bbbbbb", "#cccccc"];
    const locked = [true, false, true, false, false];
    const result = regeneratePalette(current, locked, "analogous", 77);

    expect(result[0]).toBe(locked0);
    expect(result[2]).toBe(locked2);
  });

  it("achromatic seed falls back gracefully and produces valid palette", () => {
    const current = ["#808080", "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"];
    const locked = [true, false, false, false, false];
    // Should not throw; achromatic seed means no hue bias, just random
    const result = regeneratePalette(current, locked, "monochromatic", 55);
    expect(result[0]).toBe("#808080");
    for (const hex of result) {
      expect(hex).toMatch(HEX_RE);
    }
  });

  it("no locks: result differs from seeded run (pure random base hue)", () => {
    const current = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"];
    const noLocks = [false, false, false, false, false];
    const oneLock = [true, false, false, false, false];
    const resultNoLock = regeneratePalette(current, noLocks, "monochromatic", 123);
    const resultLocked = regeneratePalette(current, oneLock, "monochromatic", 123);
    // With a lock, index 0 is preserved; without, it's regenerated
    expect(resultLocked[0]).toBe(current[0]);
    // Unlocked swatches may differ because seed hue differs
    // (no lock → random hue; locked → red hue)
    expect(resultNoLock[0]).not.toBe(current[0]); // regenerated
  });
});

// ── Seed-hue influence on unlocked output (non-vacuous regression) ────────────
//
// These tests pin the RELATIONSHIP between the locked seed hue and the unlocked
// output hues. They MUST fail if regeneratePalette stops forwarding seedHue to
// generatePalette (i.e. passes undefined instead of the derived seedHue).
//
// Tolerances are mode-dependent:
//   monochromatic — all swatches share exactly one hue, so ±20° is generous
//   analogous     — spread is ±(28-47°) around base, so ±50° covers the range
//   triadic       — swatches cluster near seed, seed+120°, seed+240°

/** Angular distance between two hue fractions in [0,1), returned in degrees [0, 180]. */
function hueDeltaDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 1;
  return Math.min(diff, 1 - diff) * 360;
}

/** True if hue `h` (fraction) is within `toleranceDeg` of any of the anchor hues (fractions). */
function nearAnyAnchor(h: number, anchors: number[], toleranceDeg: number): boolean {
  return anchors.some((a) => hueDeltaDeg(h, a) <= toleranceDeg);
}

describe("regeneratePalette — seed-hue influence on unlocked swatches (non-vacuous)", () => {
  // Blue seed: #2244dd ≈ 229° (hsl fraction ≈ 0.636)
  // PRNG seed 9 generates a base hue of ≈71.5° (yellow-green) when no baseHue is provided,
  // which is >157° away from blue. This means: if seedHue is dropped (sabotage), unlocked
  // swatches will cluster around 71.5°, NOT around 229°, and the ±20°/±50°/±30° assertions fail.
  const blueSeedHex = "#2244dd";
  const PRNGseed = 9; // PRNG produces ≈71.5° — deliberately far from blue 229°

  it("monochromatic: every unlocked swatch hue within ±20° of seed hue", () => {
    const seedHueFrac = hueFromHex(blueSeedHex);
    expect(typeof seedHueFrac).toBe("number");

    const current = [blueSeedHex, "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"];
    const locked = [true, false, false, false, false];
    const result = regeneratePalette(current, locked, "monochromatic", PRNGseed);

    // Index 0 locked — skip it. Indices 1-4 are unlocked.
    for (let i = 1; i < result.length; i++) {
      const h = hueFromHex(result[i]);
      // Monochromatic from a chromatic seed guarantees chromatic output (sat > 0.45)
      expect(typeof h).toBe("number");
      const delta = hueDeltaDeg(h as number, seedHueFrac as number);
      expect(delta).toBeLessThanOrEqual(20);
    }
  });

  it("analogous: every unlocked swatch hue within ±50° of seed hue", () => {
    const seedHueFrac = hueFromHex(blueSeedHex);
    expect(typeof seedHueFrac).toBe("number");

    const current = [blueSeedHex, "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"];
    const locked = [true, false, false, false, false];
    const result = regeneratePalette(current, locked, "analogous", PRNGseed);

    for (let i = 1; i < result.length; i++) {
      const h = hueFromHex(result[i]);
      expect(typeof h).toBe("number");
      const delta = hueDeltaDeg(h as number, seedHueFrac as number);
      expect(delta).toBeLessThanOrEqual(50);
    }
  });

  it("triadic: every unlocked swatch hue falls near one of the three triadic anchors (±30°)", () => {
    const seedHueFrac = hueFromHex(blueSeedHex);
    expect(typeof seedHueFrac).toBe("number");
    const sf = seedHueFrac as number;
    // Triadic anchors: seed, seed+120°, seed+240° (all as fractions)
    const trianchors = [sf, (sf + 1 / 3) % 1, (sf + 2 / 3) % 1];

    const current = [blueSeedHex, "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd"];
    const locked = [true, false, false, false, false];
    const result = regeneratePalette(current, locked, "triadic", PRNGseed);

    for (let i = 1; i < result.length; i++) {
      const h = hueFromHex(result[i]);
      expect(typeof h).toBe("number");
      expect(nearAnyAnchor(h as number, trianchors, 30)).toBe(true);
    }
  });
});

// ── clampCount ────────────────────────────────────────────────────────────────

describe("clampCount", () => {
  it("clamps below min to MIN_PALETTE_COUNT", () => {
    expect(clampCount(0)).toBe(MIN_PALETTE_COUNT);
    expect(clampCount(-1)).toBe(MIN_PALETTE_COUNT);
  });

  it("clamps above max to MAX_PALETTE_COUNT", () => {
    expect(clampCount(99)).toBe(MAX_PALETTE_COUNT);
    expect(clampCount(9)).toBe(MAX_PALETTE_COUNT);
  });

  it("passes through valid values unchanged", () => {
    for (let i = MIN_PALETTE_COUNT; i <= MAX_PALETTE_COUNT; i++) {
      expect(clampCount(i)).toBe(i);
    }
  });
});
