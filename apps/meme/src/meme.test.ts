import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MEME_STATE,
  TEMPLATES,
  addLayer,
  buildFont,
  clamp01,
  copyImageToClipboard,
  drawMemeText,
  exportPng,
  hitTestLayers,
  hitTestText,
  makeDefaultLayers,
  removeLayer,
  renderMeme,
  renderMemeWithLayers,
  resolvedFontSize,
  templateDefaultLayers,
  updateLayer,
} from "./meme";

// jsdom provides a canvas via canvas package, but drawImage/toBlob aren't available.
// We test pure-logic functions only (no actual pixel drawing).

describe("resolvedFontSize", () => {
  it("returns the px value when above minimum", () => {
    expect(resolvedFontSize(52, 400)).toBe(52);
    expect(resolvedFontSize(100, 600)).toBe(100);
  });

  it("clamps to minimum 12px", () => {
    expect(resolvedFontSize(5, 400)).toBe(12);
    expect(resolvedFontSize(0, 400)).toBe(12);
  });
});

describe("clamp01", () => {
  it("returns value unchanged when in range", () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });

  it("clamps values above 1 to 1", () => {
    expect(clamp01(1.1)).toBe(1);
    expect(clamp01(999)).toBe(1);
  });
});

describe("buildFont", () => {
  it("includes the font size in the result", () => {
    const f = buildFont(52, "impact");
    expect(f).toContain("52px");
  });

  it("includes Impact for impact key", () => {
    expect(buildFont(52, "impact")).toContain("Impact");
  });

  it("includes Comic Sans for comic key", () => {
    expect(buildFont(52, "comic")).toContain("Comic Sans");
  });

  it("includes Courier for mono key", () => {
    expect(buildFont(52, "mono")).toContain("Courier");
  });
});

describe("makeDefaultLayers", () => {
  it("returns exactly two layers", () => {
    expect(makeDefaultLayers()).toHaveLength(2);
  });

  it("first layer is near top", () => {
    const [top] = makeDefaultLayers();
    expect(top.y).toBeLessThan(0.3);
    expect(top.x).toBe(0.5);
  });

  it("second layer is near bottom", () => {
    const [, bottom] = makeDefaultLayers();
    expect(bottom.y).toBeGreaterThan(0.7);
    expect(bottom.x).toBe(0.5);
  });

  it("both layers have empty text by default", () => {
    for (const l of makeDefaultLayers()) {
      expect(l.text).toBe("");
    }
  });

  it("both layers have unique ids", () => {
    const layers = makeDefaultLayers();
    expect(layers[0].id).not.toBe(layers[1].id);
  });
});

describe("updateLayer", () => {
  it("updates only the targeted layer", () => {
    const layers = makeDefaultLayers();
    const updated = updateLayer(layers, layers[0].id, { text: "HELLO" });
    expect(updated[0].text).toBe("HELLO");
    expect(updated[1].text).toBe("");
  });

  it("is immutable - does not modify original array", () => {
    const layers = makeDefaultLayers();
    const original0Text = layers[0].text;
    updateLayer(layers, layers[0].id, { text: "CHANGED" });
    expect(layers[0].text).toBe(original0Text);
  });

  it("returns array of same length", () => {
    const layers = makeDefaultLayers();
    const updated = updateLayer(layers, layers[0].id, { sizePx: 80 });
    expect(updated).toHaveLength(layers.length);
  });

  it("does nothing when id not found", () => {
    const layers = makeDefaultLayers();
    const updated = updateLayer(layers, "nonexistent", { text: "NOPE" });
    expect(updated[0].text).toBe("");
    expect(updated[1].text).toBe("");
  });
});

describe("addLayer", () => {
  it("adds one layer", () => {
    const layers = makeDefaultLayers();
    expect(addLayer(layers)).toHaveLength(layers.length + 1);
  });

  it("new layer has a unique id", () => {
    const layers = makeDefaultLayers();
    const next = addLayer(layers);
    const ids = next.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("new layer starts with empty text", () => {
    const layers = makeDefaultLayers();
    const next = addLayer(layers);
    expect(next[next.length - 1].text).toBe("");
  });
});

describe("removeLayer", () => {
  it("removes the targeted layer", () => {
    const layers = makeDefaultLayers();
    const id = layers[0].id;
    const remaining = removeLayer(layers, id);
    expect(remaining.find((l) => l.id === id)).toBeUndefined();
  });

  it("returns array one shorter", () => {
    const layers = makeDefaultLayers();
    expect(removeLayer(layers, layers[0].id)).toHaveLength(layers.length - 1);
  });

  it("is a no-op when id not found", () => {
    const layers = makeDefaultLayers();
    expect(removeLayer(layers, "nonexistent")).toHaveLength(layers.length);
  });
});

describe("DEFAULT_MEME_STATE", () => {
  it("has empty strings for text", () => {
    expect(DEFAULT_MEME_STATE.topText).toBe("");
    expect(DEFAULT_MEME_STATE.bottomText).toBe("");
  });

  it("positions top near top and bottom near bottom", () => {
    expect(DEFAULT_MEME_STATE.topPos.y).toBeLessThan(0.3);
    expect(DEFAULT_MEME_STATE.bottomPos.y).toBeGreaterThan(0.7);
  });

  it("top and bottom are centered horizontally", () => {
    expect(DEFAULT_MEME_STATE.topPos.x).toBe(0.5);
    expect(DEFAULT_MEME_STATE.bottomPos.x).toBe(0.5);
  });
});

describe("TEMPLATES", () => {
  it("has at least 4 templates", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it("all templates have positive aspectRatio", () => {
    for (const t of TEMPLATES) {
      expect(t.aspectRatio).toBeGreaterThan(0);
    }
  });

  it("all templates have unique ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("classic template is square (aspectRatio=1)", () => {
    const classic = TEMPLATES.find((t) => t.id === "classic");
    expect(classic).toBeDefined();
    expect(classic?.aspectRatio).toBe(1);
  });
});

describe("templateDefaultLayers", () => {
  it("returns makeDefaultLayers() for templates without defaultLayers", () => {
    const t = TEMPLATES.find((t) => t.id === "classic");
    expect(t).toBeDefined();
    if (!t) return;
    const layers = templateDefaultLayers(t);
    expect(layers).toHaveLength(2);
  });

  it("returns the template-specific layers when provided", () => {
    const t = TEMPLATES.find((t) => t.id === "three-panel");
    expect(t).toBeDefined();
    if (!t) return;
    const layers = templateDefaultLayers(t);
    expect(layers).toHaveLength(3);
  });
});

describe("hitTestLayers", () => {
  function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: w,
      height: h,
      right: w,
      bottom: h,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    return c;
  }

  it("returns layer id when clicking near a layer with text", () => {
    const canvas = makeCanvas(600, 400);
    const layers = makeDefaultLayers();
    const withText = updateLayer(layers, layers[0].id, { text: "HELLO" });
    const result = hitTestLayers(canvas, 300, 40, withText); // near top (0.5*600=300, 0.1*400=40)
    expect(result).toBe(layers[0].id);
  });

  it("returns null for empty-text layers", () => {
    const canvas = makeCanvas(600, 400);
    const layers = makeDefaultLayers(); // all empty
    expect(hitTestLayers(canvas, 300, 40, layers)).toBeNull();
  });

  it("returns null when clicking away from all layers", () => {
    const canvas = makeCanvas(600, 400);
    const layers = makeDefaultLayers().map((l) => ({ ...l, text: "HI" }));
    // Middle of canvas - away from top (40px) and bottom (368px)
    expect(hitTestLayers(canvas, 300, 200, layers)).toBeNull();
  });
});

describe("hitTestText (legacy)", () => {
  function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: w,
      height: h,
      right: w,
      bottom: h,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    return c;
  }

  it("returns 'top' when clicking near top text anchor", () => {
    const canvas = makeCanvas(600, 400);
    const state = {
      ...DEFAULT_MEME_STATE,
      topText: "HELLO",
      topPos: { x: 0.5, y: 0.1 },
    };
    const result = hitTestText(canvas, 300, 40, state);
    expect(result).toBe("top");
  });

  it("returns 'bottom' when clicking near bottom text anchor", () => {
    const canvas = makeCanvas(600, 400);
    const state = {
      ...DEFAULT_MEME_STATE,
      bottomText: "WORLD",
      bottomPos: { x: 0.5, y: 0.92 },
    };
    const result = hitTestText(canvas, 300, 368, state);
    expect(result).toBe("bottom");
  });

  it("returns null when clicking away from any text", () => {
    const canvas = makeCanvas(600, 400);
    const state = {
      ...DEFAULT_MEME_STATE,
      topText: "HELLO",
      bottomText: "WORLD",
      topPos: { x: 0.5, y: 0.1 },
      bottomPos: { x: 0.5, y: 0.92 },
    };
    const result = hitTestText(canvas, 300, 200, state);
    expect(result).toBeNull();
  });

  it("returns null for empty text even near anchor", () => {
    const canvas = makeCanvas(600, 400);
    const state = {
      ...DEFAULT_MEME_STATE,
      topText: "",
      bottomText: "",
    };
    const result = hitTestText(canvas, 300, 40, state);
    expect(result).toBeNull();
  });
});

describe("drawMemeText", () => {
  it("does not throw when called with valid context", () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    expect(() => drawMemeText(ctx, "TEST", 300, 200, 52)).not.toThrow();
  });

  it("does not throw on empty string", () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    expect(() => drawMemeText(ctx, "", 300, 200, 52)).not.toThrow();
  });

  it("does not throw with different font keys", () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    for (const fk of ["impact", "arial", "comic", "mono"] as const) {
      expect(() => drawMemeText(ctx, "TEST", 300, 200, 52, "#fff", fk)).not.toThrow();
    }
  });
});

describe("renderMeme", () => {
  it("does not throw when called with a valid canvas and image source", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const src = document.createElement("canvas");
    src.width = 600;
    src.height = 400;
    expect(() => renderMeme(canvas, src, DEFAULT_MEME_STATE)).not.toThrow();
  });
});

describe("renderMemeWithLayers", () => {
  it("does not throw with multiple layers", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const src = document.createElement("canvas");
    src.width = 600;
    src.height = 400;
    const layers = makeDefaultLayers().map((l) => ({ ...l, text: "HI" }));
    expect(() => renderMemeWithLayers(canvas, src, layers)).not.toThrow();
  });

  it("does not throw with empty layers array", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const src = document.createElement("canvas");
    src.width = 600;
    src.height = 400;
    expect(() => renderMemeWithLayers(canvas, src, [])).not.toThrow();
  });
});

describe("exportPng", () => {
  it("rejects when canvas.toBlob calls back with null", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    canvas.toBlob = (cb) => cb(null);
    await expect(exportPng(canvas)).rejects.toThrow("Failed to export PNG");
  });

  it("resolves with blob when canvas.toBlob succeeds", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const fakeBlob = new Blob(["fake"], { type: "image/png" });
    canvas.toBlob = (cb) => cb(fakeBlob);
    await expect(exportPng(canvas)).resolves.toBe(fakeBlob);
  });
});

describe("copyImageToClipboard", () => {
  it("calls navigator.clipboard.write with one item when blob is available", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;

    const fakeBlob = new Blob(["fake"], { type: "image/png" });
    canvas.toBlob = (cb) => cb(fakeBlob);

    const writeMock = vi.fn().mockResolvedValue(undefined);
    class ClipboardItemStub {
      data: Record<string, Blob>;
      constructor(data: Record<string, Blob>) {
        this.data = data;
      }
    }
    Object.defineProperty(globalThis, "ClipboardItem", {
      value: ClipboardItemStub,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock },
      configurable: true,
    });

    await copyImageToClipboard(canvas);

    expect(writeMock).toHaveBeenCalledOnce();
    expect(writeMock.mock.calls[0][0]).toHaveLength(1);
  });

  it("propagates rejection when clipboard.write fails", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;

    const fakeBlob = new Blob(["fake"], { type: "image/png" });
    canvas.toBlob = (cb) => cb(fakeBlob);

    class ClipboardItemStub2 {
      data: Record<string, Blob>;
      constructor(data: Record<string, Blob>) {
        this.data = data;
      }
    }
    Object.defineProperty(globalThis, "ClipboardItem", {
      value: ClipboardItemStub2,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { write: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });

    await expect(copyImageToClipboard(canvas)).rejects.toThrow("denied");
  });
});
