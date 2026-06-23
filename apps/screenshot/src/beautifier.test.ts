import { describe, expect, it } from "vitest";
import {
  BRAND_SOLIDS,
  DEFAULT_SETTINGS,
  FRAME_BAR_HEIGHTS,
  GRADIENT_PRESETS,
  SIZE_PRESETS,
  angleToVector,
  canvasDimensions,
  clamp,
  exportFilename,
  mimeForFormat,
  resolveBackground,
  shadowCss,
} from "./beautifier";

describe("resolveBackground", () => {
  it("returns solid colour for bgKind=solid", () => {
    const result = resolveBackground({
      ...DEFAULT_SETTINGS,
      bgKind: "solid",
      solidColor: "#ff0000",
    });
    expect(result.type).toBe("solid");
    expect(result.color).toBe("#ff0000");
  });

  it("returns correct brand colour", () => {
    const result = resolveBackground({ ...DEFAULT_SETTINGS, bgKind: "brand", brandId: "coral" });
    expect(result.type).toBe("solid");
    expect(result.color).toBe("#d9594c");
  });

  it("falls back to first brand colour when brandId is unknown", () => {
    const result = resolveBackground({ ...DEFAULT_SETTINGS, bgKind: "brand", brandId: "nope" });
    expect(result.type).toBe("solid");
    expect(result.color).toBe("#2f9d8d");
  });

  it("returns gradient for bgKind=gradient", () => {
    const result = resolveBackground({
      ...DEFAULT_SETTINGS,
      bgKind: "gradient",
      gradientId: "ocean",
    });
    expect(result.type).toBe("gradient");
    expect(result.gradientStops).toBeDefined();
    expect(result.gradientStops?.[0]).toBe("#1a6b5a");
  });

  it("falls back to solid when gradient id is unknown", () => {
    const result = resolveBackground({
      ...DEFAULT_SETTINGS,
      bgKind: "gradient",
      gradientId: "unknown",
    });
    expect(result.type).toBe("solid");
  });
});

describe("shadowCss", () => {
  it("returns none for size 0", () => {
    expect(shadowCss(0)).toBe("none");
  });

  it("returns a non-empty string for sizes 1-3", () => {
    expect(shadowCss(1)).not.toBe("none");
    expect(shadowCss(2)).not.toBe("none");
    expect(shadowCss(3)).not.toBe("none");
  });

  it("increases shadow values with size", () => {
    // larger shadow size should produce longer strings (more blur/spread)
    expect(shadowCss(3).length).toBeGreaterThan(shadowCss(1).length);
  });
});

describe("canvasDimensions", () => {
  it("adds padding symmetrically without frame", () => {
    const { canvasW, canvasH, imgOffsetX, imgOffsetY } = canvasDimensions(800, 600, 60, "none");
    expect(canvasW).toBe(920);
    expect(canvasH).toBe(720);
    expect(imgOffsetX).toBe(60);
    expect(imgOffsetY).toBe(60);
  });

  it("adds macOS frame bar height (36px)", () => {
    const { canvasH, imgOffsetY } = canvasDimensions(800, 600, 60, "macos");
    expect(canvasH).toBe(720 + 36);
    expect(imgOffsetY).toBe(60 + 36);
  });

  it("adds browser frame bar height (44px)", () => {
    const { canvasH, imgOffsetY } = canvasDimensions(800, 600, 60, "browser");
    expect(canvasH).toBe(720 + 44);
    expect(imgOffsetY).toBe(60 + 44);
  });

  it("zero padding produces canvas equal to image size", () => {
    const { canvasW, canvasH } = canvasDimensions(400, 300, 0, "none");
    expect(canvasW).toBe(400);
    expect(canvasH).toBe(300);
  });
});

describe("angleToVector", () => {
  it("0 deg points straight up (x=0,y=-1 approximately)", () => {
    const [dx, dy] = angleToVector(0);
    expect(Math.abs(dx)).toBeLessThan(0.001);
    expect(dy).toBeCloseTo(-1, 3);
  });

  it("90 deg points right (x=1,y=0 approximately)", () => {
    const [dx, dy] = angleToVector(90);
    expect(dx).toBeCloseTo(1, 3);
    expect(Math.abs(dy)).toBeLessThan(0.001);
  });

  it("180 deg points down", () => {
    const [dx, dy] = angleToVector(180);
    expect(Math.abs(dx)).toBeLessThan(0.001);
    expect(dy).toBeCloseTo(1, 3);
  });
});

describe("clamp", () => {
  it("returns min when value is below min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("returns max when value is above max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("returns the value when within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe("exportFilename", () => {
  it("appends -beautiful.png and strips original extension (default)", () => {
    expect(exportFilename("my-screenshot.png")).toBe("my-screenshot-beautiful.png");
  });

  it("works with jpg extension", () => {
    expect(exportFilename("capture.jpg")).toBe("capture-beautiful.png");
  });

  it("handles filenames with multiple dots", () => {
    expect(exportFilename("screen.v2.final.png")).toBe("screen.v2.final-beautiful.png");
  });

  it("handles filenames with no extension", () => {
    expect(exportFilename("screenshot")).toBe("screenshot-beautiful.png");
  });

  it("uses the given format extension", () => {
    expect(exportFilename("screen.png", "jpg")).toBe("screen-beautiful.jpg");
    expect(exportFilename("screen.png", "webp")).toBe("screen-beautiful.webp");
  });
});

describe("mimeForFormat", () => {
  it("maps png to image/png", () => {
    expect(mimeForFormat("png")).toBe("image/png");
  });

  it("maps jpg to image/jpeg", () => {
    expect(mimeForFormat("jpg")).toBe("image/jpeg");
  });

  it("maps webp to image/webp", () => {
    expect(mimeForFormat("webp")).toBe("image/webp");
  });
});

describe("SIZE_PRESETS", () => {
  it("has a free preset with zero dimensions", () => {
    const free = SIZE_PRESETS.find((p) => p.id === "free");
    expect(free).toBeDefined();
    expect(free?.width).toBe(0);
    expect(free?.height).toBe(0);
  });

  it("has a twitter preset with 1200x600", () => {
    const tw = SIZE_PRESETS.find((p) => p.id === "twitter");
    expect(tw?.width).toBe(1200);
    expect(tw?.height).toBe(600);
  });

  it("all non-free presets have positive dimensions", () => {
    for (const p of SIZE_PRESETS.filter((p) => p.id !== "free")) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("includes exportFormat and sizePresetId", () => {
    expect(DEFAULT_SETTINGS.exportFormat).toBe("png");
    expect(DEFAULT_SETTINGS.sizePresetId).toBe("free");
  });
});

describe("GRADIENT_PRESETS", () => {
  it("has at least 6 presets", () => {
    expect(GRADIENT_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it("each preset has two stops and an angle", () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(preset.stops).toHaveLength(2);
      expect(typeof preset.angle).toBe("number");
    }
  });
});

describe("BRAND_SOLIDS", () => {
  it("contains teal as #2f9d8d", () => {
    const teal = BRAND_SOLIDS.find((b) => b.id === "teal");
    expect(teal?.color).toBe("#2f9d8d");
  });
});

describe("FRAME_BAR_HEIGHTS", () => {
  it("none has height 0", () => {
    expect(FRAME_BAR_HEIGHTS.none).toBe(0);
  });

  it("macos has height 36", () => {
    expect(FRAME_BAR_HEIGHTS.macos).toBe(36);
  });

  it("browser has height 44", () => {
    expect(FRAME_BAR_HEIGHTS.browser).toBe(44);
  });

  it("browser frame is taller than macos frame", () => {
    expect(FRAME_BAR_HEIGHTS.browser).toBeGreaterThan(FRAME_BAR_HEIGHTS.macos);
  });
});

describe("resolveBackground image kind", () => {
  it("returns type image with the provided imageUrl", () => {
    const result = resolveBackground({
      ...DEFAULT_SETTINGS,
      bgKind: "image",
      bgImageUrl: "blob:http://localhost/fake-id",
    });
    expect(result.type).toBe("image");
    expect(result.imageUrl).toBe("blob:http://localhost/fake-id");
  });

  it("returns type image with undefined imageUrl when bgImageUrl is null", () => {
    const result = resolveBackground({
      ...DEFAULT_SETTINGS,
      bgKind: "image",
      bgImageUrl: null,
    });
    expect(result.type).toBe("image");
    expect(result.imageUrl).toBeUndefined();
  });
});

describe("DEFAULT_SETTINGS new fields", () => {
  it("windowFrameType defaults to none", () => {
    expect(DEFAULT_SETTINGS.windowFrameType).toBe("none");
  });

  it("browserUrl has a default value", () => {
    expect(typeof DEFAULT_SETTINGS.browserUrl).toBe("string");
    expect(DEFAULT_SETTINGS.browserUrl.length).toBeGreaterThan(0);
  });

  it("bgImageUrl defaults to null", () => {
    expect(DEFAULT_SETTINGS.bgImageUrl).toBeNull();
  });
});

describe("GRADIENT_PRESETS extended library", () => {
  it("has at least 16 presets", () => {
    expect(GRADIENT_PRESETS.length).toBeGreaterThanOrEqual(16);
  });

  it("contains the new sunrise preset", () => {
    const preset = GRADIENT_PRESETS.find((p) => p.id === "sunrise");
    expect(preset).toBeDefined();
    expect(preset?.stops).toHaveLength(2);
  });

  it("all preset ids are unique", () => {
    const ids = GRADIENT_PRESETS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
