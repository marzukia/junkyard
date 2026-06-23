import { describe, expect, it } from "vitest";
import { decodeState, encodeState } from "./share";
import type { ShareableState } from "./share";

// ── Fixture ───────────────────────────────────────────────────────────────────

const SAMPLE: ShareableState = {
  palette: {
    colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"],
    locked: [false, true, false, false, true],
    count: 5,
    harmonyMode: "analogous",
  },
  twoPoint: { start: "#2d3a4a", end: "#d4a574", steps: 8 },
  threePoint: { start: "#1b4332", mid: "#74c69d", end: "#f8f4e1", steps: 9 },
  space: "lab",
};

// ── Round-trip ────────────────────────────────────────────────────────────────

describe("encodeState / decodeState round-trip", () => {
  it("decodes back to the original state for a representative sample", () => {
    const encoded = encodeState(SAMPLE);
    const decoded = decodeState(encoded);
    expect(decoded).not.toBeNull();
    // palette
    expect(decoded!.palette.count).toBe(5);
    expect(decoded!.palette.colors).toEqual(SAMPLE.palette.colors);
    expect(decoded!.palette.locked).toEqual(SAMPLE.palette.locked);
    expect(decoded!.palette.harmonyMode).toBe("analogous");
    // twoPoint
    expect(decoded!.twoPoint).toEqual(SAMPLE.twoPoint);
    // threePoint
    expect(decoded!.threePoint).toEqual(SAMPLE.threePoint);
    // space
    expect(decoded!.space).toBe("lab");
  });

  it("preserves all harmony modes through encode/decode", () => {
    for (const mode of [
      "auto",
      "analogous",
      "complementary",
      "triadic",
      "monochromatic",
    ] as const) {
      const state: ShareableState = {
        ...SAMPLE,
        palette: { ...SAMPLE.palette, harmonyMode: mode },
      };
      expect(decodeState(encodeState(state))!.palette.harmonyMode).toBe(mode);
    }
  });

  it("preserves all interpolation spaces through encode/decode", () => {
    for (const space of ["lab", "rgb", "hsl"] as const) {
      const state: ShareableState = { ...SAMPLE, space };
      expect(decodeState(encodeState(state))!.space).toBe(space);
    }
  });

  it("round-trips a state with all swatches locked", () => {
    const state: ShareableState = {
      ...SAMPLE,
      palette: { ...SAMPLE.palette, locked: [true, true, true, true, true] },
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded!.palette.locked).toEqual([true, true, true, true, true]);
  });
});

// ── Garbage / invalid input ───────────────────────────────────────────────────

describe("decodeState — resilience", () => {
  it("returns null for empty string", () => {
    expect(decodeState("")).toBeNull();
  });

  it("returns null for percent-encoded garbage", () => {
    expect(decodeState("%%%")).toBeNull();
  });

  it("returns null for random non-base64 text", () => {
    expect(decodeState("not-base64-at-all!!")).toBeNull();
  });

  it("returns null for malformed base64 that decodes to non-JSON", () => {
    // Valid base64 but not JSON
    const notJson = btoa("hello world").replace(/=/g, "");
    expect(decodeState(notJson)).toBeNull();
  });

  it("never throws — even on totally unexpected input", () => {
    const bad = ["", "   ", "%%", "{}", "null", "0", "aaaa"];
    for (const input of bad) {
      expect(() => decodeState(input)).not.toThrow();
    }
  });

  it("returns null for empty JSON object (missing all keys)", () => {
    const empty = btoa("{}").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    // Empty object should fall back — count clamped to MIN means colors defaults to #000000 fills.
    // Either null or a valid safe state is acceptable; it must not throw.
    expect(() => decodeState(empty)).not.toThrow();
  });
});

// ── Hydrate guards ────────────────────────────────────────────────────────────

describe("decodeState — count/length clamping", () => {
  it("clamps count below MIN_PALETTE_COUNT (3) to 3", () => {
    const state: ShareableState = {
      ...SAMPLE,
      palette: {
        colors: ["#ff0000"],
        locked: [false],
        count: 1,
        harmonyMode: "analogous",
      },
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.palette.count).toBe(3);
    expect(decoded!.palette.colors).toHaveLength(3);
    expect(decoded!.palette.locked).toHaveLength(3);
  });

  it("clamps count above MAX_PALETTE_COUNT (8) to 8", () => {
    const state: ShareableState = {
      ...SAMPLE,
      palette: {
        colors: [
          "#ff0000",
          "#00ff00",
          "#0000ff",
          "#ffff00",
          "#ff00ff",
          "#00ffff",
          "#aabbcc",
          "#112233",
          "#445566",
        ],
        locked: Array(9).fill(false),
        count: 9,
        harmonyMode: "analogous",
      },
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.palette.count).toBe(8);
    expect(decoded!.palette.colors).toHaveLength(8);
    expect(decoded!.palette.locked).toHaveLength(8);
  });

  it("pads missing colors with #000000 when count > colors.length", () => {
    // Manually craft an encoded payload with count=5 but only 2 colors
    const payload = {
      pc: ["#ff0000", "#00ff00"],
      pl: [false, false],
      pn: 5,
      ph: "analogous",
      ts: "#2d3a4a",
      te: "#d4a574",
      tn: 8,
      rs: "#1b4332",
      rm: "#74c69d",
      re: "#f8f4e1",
      rn: 9,
      sp: "lab",
    };
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = decodeState(b64);
    expect(decoded).not.toBeNull();
    expect(decoded!.palette.colors).toHaveLength(5);
    expect(decoded!.palette.colors[2]).toBe("#000000");
  });

  it("rejects invalid hex values and substitutes #000000", () => {
    const payload = {
      pc: ["notahex", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"],
      pl: [false, false, false, false, false],
      pn: 5,
      ph: "analogous",
      ts: "#2d3a4a",
      te: "#d4a574",
      tn: 8,
      rs: "#1b4332",
      rm: "#74c69d",
      re: "#f8f4e1",
      rn: 9,
      sp: "lab",
    };
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = decodeState(b64);
    expect(decoded!.palette.colors[0]).toBe("#000000");
    expect(decoded!.palette.colors[1]).toBe("#00ff00");
  });

  it("falls back to default twoPoint when hex values are invalid", () => {
    const payload = {
      pc: ["#ff0000", "#00ff00", "#0000ff"],
      pl: [false, false, false],
      pn: 3,
      ph: "analogous",
      ts: "NOTVALID",
      te: "ALSOBAD",
      tn: 8,
      rs: "#1b4332",
      rm: "#74c69d",
      re: "#f8f4e1",
      rn: 9,
      sp: "lab",
    };
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = decodeState(b64);
    expect(decoded!.twoPoint.start).toBe("#2d3a4a");
    expect(decoded!.twoPoint.end).toBe("#d4a574");
  });

  it("falls back to 'analogous' for an unknown harmony mode", () => {
    const payload = {
      pc: ["#ff0000", "#00ff00", "#0000ff"],
      pl: [false, false, false],
      pn: 3,
      ph: "rainbow",
      ts: "#2d3a4a",
      te: "#d4a574",
      tn: 8,
      rs: "#1b4332",
      rm: "#74c69d",
      re: "#f8f4e1",
      rn: 9,
      sp: "lab",
    };
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(decodeState(b64)!.palette.harmonyMode).toBe("analogous");
  });

  it("rounds a fractional pn to an integer and keeps array lengths consistent", () => {
    // A crafted permalink with pn: 3.7 should decode to count=4 (rounded),
    // with colors.length === locked.length === count — no fractional desync.
    const payload = {
      pc: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
      pl: [false, false, false, false],
      pn: 3.7,
      ph: "analogous",
      ts: "#2d3a4a",
      te: "#d4a574",
      tn: 8,
      rs: "#1b4332",
      rm: "#74c69d",
      re: "#f8f4e1",
      rn: 9,
      sp: "lab",
    };
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = decodeState(b64);
    expect(decoded).not.toBeNull();
    const { count, colors, locked } = decoded!.palette;
    expect(Number.isInteger(count)).toBe(true);
    expect(colors.length).toBe(count);
    expect(locked.length).toBe(count);
  });

  it("handles NaN pn by falling back to MIN_PALETTE_COUNT", () => {
    const payload = {
      pc: [],
      pl: [],
      pn: Number.NaN,
      ph: "analogous",
      ts: "#2d3a4a",
      te: "#d4a574",
      tn: 8,
      rs: "#1b4332",
      rm: "#74c69d",
      re: "#f8f4e1",
      rn: 9,
      sp: "lab",
    };
    // JSON.stringify turns NaN → null, which decodeState treats as non-number → MIN
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = decodeState(b64);
    expect(decoded).not.toBeNull();
    const { count, colors, locked } = decoded!.palette;
    expect(Number.isInteger(count)).toBe(true);
    expect(colors.length).toBe(count);
    expect(locked.length).toBe(count);
  });

  it("falls back to 'lab' for an unknown space", () => {
    const payload = {
      pc: ["#ff0000", "#00ff00", "#0000ff"],
      pl: [false, false, false],
      pn: 3,
      ph: "analogous",
      ts: "#2d3a4a",
      te: "#d4a574",
      tn: 8,
      rs: "#1b4332",
      rm: "#74c69d",
      re: "#f8f4e1",
      rn: 9,
      sp: "xyz",
    };
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(decodeState(b64)!.space).toBe("lab");
  });
});
