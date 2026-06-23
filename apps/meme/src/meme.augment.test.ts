/**
 * Augmented tests for meme.ts.
 * Covers pathways not reached by existing tests:
 * - FONT_FAMILIES and FONT_LABELS completeness
 * - templateDefaultLayers for every template variant
 * - updateLayer with multiple patches
 * - clamp01 boundary precision
 * - resolvedFontSize exact minimum
 * - buildFont for all font keys including weight checks
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT,
  DEFAULT_TEXT_COLOR,
  FONT_FAMILIES,
  FONT_LABELS,
  TEMPLATES,
  addLayer,
  buildFont,
  clamp01,
  makeDefaultLayers,
  removeLayer,
  resolvedFontSize,
  templateDefaultLayers,
  updateLayer,
} from "./meme";

// ── FONT_FAMILIES constant ────────────────────────────────────────────────────

describe("FONT_FAMILIES", () => {
  const keys = ["impact", "arial", "comic", "mono"] as const;

  it("has entries for all four font keys", () => {
    for (const key of keys) {
      expect(FONT_FAMILIES[key]).toBeTruthy();
    }
  });

  it("impact family string contains Impact", () => {
    expect(FONT_FAMILIES.impact).toContain("Impact");
  });

  it("arial family string contains Arial", () => {
    expect(FONT_FAMILIES.arial).toContain("Arial");
  });

  it("comic family string contains Comic Sans", () => {
    expect(FONT_FAMILIES.comic).toContain("Comic Sans");
  });

  it("mono family string contains Courier", () => {
    expect(FONT_FAMILIES.mono).toContain("Courier");
  });
});

// ── FONT_LABELS constant ──────────────────────────────────────────────────────

describe("FONT_LABELS", () => {
  it("has a label for each key in FONT_FAMILIES", () => {
    for (const key of Object.keys(FONT_FAMILIES) as Array<keyof typeof FONT_FAMILIES>) {
      expect(FONT_LABELS[key]).toBeTruthy();
    }
  });

  it("labels are non-empty strings", () => {
    for (const label of Object.values(FONT_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ── DEFAULT constants ─────────────────────────────────────────────────────────

describe("DEFAULT_TEXT_COLOR and DEFAULT_FONT", () => {
  it("DEFAULT_TEXT_COLOR is a valid CSS hex color", () => {
    expect(DEFAULT_TEXT_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("DEFAULT_FONT is a key in FONT_FAMILIES", () => {
    expect(DEFAULT_FONT in FONT_FAMILIES).toBe(true);
  });
});

// ── buildFont — additional cases ──────────────────────────────────────────────

describe("buildFont — additional cases", () => {
  it("arial uses weight 700", () => {
    const f = buildFont(24, "arial");
    expect(f).toContain("700");
  });

  it("comic uses weight 700", () => {
    const f = buildFont(24, "comic");
    expect(f).toContain("700");
  });

  it("mono font string uses weight 700", () => {
    const f = buildFont(24, "mono");
    expect(f).toContain("700");
  });

  it("impact uses weight 900", () => {
    const f = buildFont(24, "impact");
    expect(f).toContain("900");
  });

  it("font string includes px unit", () => {
    const f = buildFont(48, "impact");
    expect(f).toContain("48px");
  });
});

// ── resolvedFontSize — exact boundary ────────────────────────────────────────

describe("resolvedFontSize — boundary cases", () => {
  it("returns exactly 12 for input of 12 (not clamped)", () => {
    expect(resolvedFontSize(12, 400)).toBe(12);
  });

  it("returns 12 for input of 11 (clamped to minimum)", () => {
    expect(resolvedFontSize(11, 400)).toBe(12);
  });

  it("returns 12 for input of 1", () => {
    expect(resolvedFontSize(1, 400)).toBe(12);
  });
});

// ── clamp01 — precision boundary ─────────────────────────────────────────────

describe("clamp01 — precision boundary", () => {
  it("does not alter exact boundary 0.0", () => {
    expect(clamp01(0.0)).toBe(0.0);
  });

  it("does not alter exact boundary 1.0", () => {
    expect(clamp01(1.0)).toBe(1.0);
  });

  it("clamps small negative epsilon", () => {
    expect(clamp01(-Number.EPSILON)).toBe(0);
  });
});

// ── templateDefaultLayers — all template variants ─────────────────────────────

describe("templateDefaultLayers — all templates", () => {
  for (const template of TEMPLATES) {
    it(`${template.id}: returns non-empty layers array`, () => {
      const layers = templateDefaultLayers(template);
      expect(layers.length).toBeGreaterThan(0);
    });

    it(`${template.id}: all layers have valid position (0..1) and positive sizePx`, () => {
      const layers = templateDefaultLayers(template);
      for (const layer of layers) {
        expect(layer.x).toBeGreaterThanOrEqual(0);
        expect(layer.x).toBeLessThanOrEqual(1);
        expect(layer.y).toBeGreaterThanOrEqual(0);
        expect(layer.y).toBeLessThanOrEqual(1);
        expect(layer.sizePx).toBeGreaterThan(0);
      }
    });
  }

  it("three-panel template returns exactly 3 layers", () => {
    const t = TEMPLATES.find((t) => t.id === "three-panel");
    if (!t) throw new Error("three-panel missing");
    const layers = templateDefaultLayers(t);
    expect(layers).toHaveLength(3);
  });

  it("top-only template returns exactly 1 layer", () => {
    const t = TEMPLATES.find((t) => t.id === "top-only");
    if (!t) throw new Error("top-only missing");
    const layers = templateDefaultLayers(t);
    expect(layers).toHaveLength(1);
  });

  it("bottom-only template returns exactly 1 layer", () => {
    const t = TEMPLATES.find((t) => t.id === "bottom-only");
    if (!t) throw new Error("bottom-only missing");
    const layers = templateDefaultLayers(t);
    expect(layers).toHaveLength(1);
  });
});

// ── updateLayer — multiple field patch ───────────────────────────────────────

describe("updateLayer — multiple field patch", () => {
  it("applies multiple fields in one patch", () => {
    const layers = makeDefaultLayers();
    const id = layers[0].id;
    const updated = updateLayer(layers, id, { text: "HELLO", sizePx: 80, color: "#ff0000" });
    expect(updated[0].text).toBe("HELLO");
    expect(updated[0].sizePx).toBe(80);
    expect(updated[0].color).toBe("#ff0000");
  });

  it("leaves non-patched fields unchanged", () => {
    const layers = makeDefaultLayers();
    const id = layers[0].id;
    const original = { ...layers[0] };
    const updated = updateLayer(layers, id, { text: "NEW" });
    expect(updated[0].font).toBe(original.font);
    expect(updated[0].x).toBe(original.x);
    expect(updated[0].y).toBe(original.y);
  });
});

// ── addLayer + removeLayer — chaining ────────────────────────────────────────

describe("addLayer + removeLayer — chaining", () => {
  it("add then remove by id returns original length", () => {
    const base = makeDefaultLayers();
    const extended = addLayer(base);
    const newLayer = extended[extended.length - 1];
    const back = removeLayer(extended, newLayer.id);
    expect(back).toHaveLength(base.length);
  });

  it("removing all layers returns empty array", () => {
    const base = makeDefaultLayers();
    let layers = base;
    for (const l of base) {
      layers = removeLayer(layers, l.id);
    }
    expect(layers).toHaveLength(0);
  });
});
