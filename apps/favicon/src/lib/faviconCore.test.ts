import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CANVAS_OPTIONS,
  FAVICON_SIZES,
  buildHtmlSnippet,
  buildIco,
  buildManifest,
  drawTextToCanvas,
  drawToCanvas,
  sanitiseAppName,
} from "./faviconCore";

describe("sanitiseAppName", () => {
  it("returns input unchanged for a normal name", () => {
    expect(sanitiseAppName("My App")).toBe("My App");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitiseAppName("  Trimmed  ")).toBe("Trimmed");
  });

  it("clamps to 45 characters", () => {
    const long = "A".repeat(60);
    expect(sanitiseAppName(long)).toHaveLength(45);
  });

  it("falls back to 'My App' for blank input", () => {
    expect(sanitiseAppName("")).toBe("My App");
    expect(sanitiseAppName("   ")).toBe("My App");
  });
});

describe("buildManifest", () => {
  it("produces valid JSON", () => {
    const json = buildManifest("Test App");
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes 192 and 512 icon entries", () => {
    const manifest = JSON.parse(buildManifest("Test App")) as {
      icons: { sizes: string }[];
    };
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("embeds the provided app name", () => {
    const manifest = JSON.parse(buildManifest("Fabulous Site")) as { name: string };
    expect(manifest.name).toBe("Fabulous Site");
  });
});

describe("buildHtmlSnippet", () => {
  it("includes a rel=manifest link", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet).toContain('rel="manifest"');
  });

  it("includes apple-touch-icon 180x180", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet).toContain("180x180");
    expect(snippet).toContain("apple-touch-icon");
  });

  it("includes theme-color meta", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet).toContain("theme-color");
  });

  it("includes a comment with the generator URL", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet).toContain("junkyard.mrzk.io/favicon/");
  });
});

describe("FAVICON_SIZES", () => {
  it("includes 16, 32, 48, 180, 192, 512", () => {
    const sizes = FAVICON_SIZES.map((s) => s.size);
    expect(sizes).toContain(16);
    expect(sizes).toContain(32);
    expect(sizes).toContain(48);
    expect(sizes).toContain(180);
    expect(sizes).toContain(192);
    expect(sizes).toContain(512);
  });

  it("has unique filenames", () => {
    const names = FAVICON_SIZES.map((s) => s.filename);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("buildIco", () => {
  // Synthesise minimal valid PNG frames
  function makePngBytes(size: number): Uint8Array {
    // PNG signature: 8 bytes
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    // IHDR chunk: length(4) + type(4) + data(13) + crc(4) = 25
    const ihdrData = new Uint8Array(13);
    const view = new DataView(ihdrData.buffer);
    view.setUint32(0, size);
    view.setUint32(4, size);
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 2; // colour type RGB
    // For test purposes the CRC can be wrong — we only care about ICO container structure
    const ihdrLen = new Uint8Array([0, 0, 0, 13]);
    const ihdrType = new TextEncoder().encode("IHDR");
    const ihdrCrc = new Uint8Array([0, 0, 0, 0]);
    // IEND chunk
    const iendLen = new Uint8Array([0, 0, 0, 0]);
    const iendType = new TextEncoder().encode("IEND");
    const iendCrc = new Uint8Array([174, 66, 96, 130]);

    const total = sig.length + 4 + 4 + 13 + 4 + 4 + 4 + 4;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const chunk of [sig, ihdrLen, ihdrType, ihdrData, ihdrCrc, iendLen, iendType, iendCrc]) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out;
  }

  it("produces a buffer starting with the ICO header magic bytes", () => {
    const frames = [
      { size: 16, data: makePngBytes(16) },
      { size: 32, data: makePngBytes(32) },
    ];
    const ico = buildIco(frames);
    const view = new DataView(ico.buffer);
    // ICO header: reserved=0, type=1, count=2
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
  });

  it("directory entry count matches frames passed", () => {
    const frames = [
      { size: 16, data: makePngBytes(16) },
      { size: 32, data: makePngBytes(32) },
      { size: 48, data: makePngBytes(48) },
    ];
    const ico = buildIco(frames);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(4, true)).toBe(3);
  });

  it("records correct sizes in directory entries", () => {
    const frames = [{ size: 16, data: makePngBytes(16) }];
    const ico = buildIco(frames);
    // Directory entry starts at byte 6; byte 0 = width, byte 1 = height
    expect(ico[6]).toBe(16);
    expect(ico[7]).toBe(16);
  });

  it("uses 0 for width/height when size >= 256", () => {
    const frames = [{ size: 256, data: makePngBytes(256) }];
    const ico = buildIco(frames);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });
});

describe("DEFAULT_CANVAS_OPTIONS", () => {
  it("has transparent bg, zero padding and zero corner radius", () => {
    expect(DEFAULT_CANVAS_OPTIONS.bgColor).toBe("");
    expect(DEFAULT_CANVAS_OPTIONS.padding).toBe(0);
    expect(DEFAULT_CANVAS_OPTIONS.cornerRadius).toBe(0);
  });
});

// jsdom does not implement canvas.getContext("2d"), so we inject a mock context
// before testing drawToCanvas/drawTextToCanvas and restore it after.
describe("drawTextToCanvas (mocked canvas)", () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    // biome-ignore lint/suspicious/noExplicitAny: mock for jsdom
    (HTMLCanvasElement.prototype as any).getContext = () => ({
      clearRect: () => {},
      fillRect: () => {},
      fillText: () => {},
      beginPath: () => {},
      roundRect: () => {},
      clip: () => {},
      drawImage: () => {},
      getImageData: () => ({
        data: new Uint8ClampedArray(32 * 32 * 4).fill(128),
      }),
      save: () => {},
      restore: () => {},
      font: "",
      textAlign: "",
      textBaseline: "",
      fillStyle: "",
      shadowColor: "",
      shadowBlur: 0,
    });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("returns a canvas with the requested square dimensions", () => {
    const canvas = drawTextToCanvas("A", 64, DEFAULT_CANVAS_OPTIONS);
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
  });

  it("handles multi-character text without throwing", () => {
    expect(() => drawTextToCanvas("AB", 32, DEFAULT_CANVAS_OPTIONS)).not.toThrow();
  });

  it("accepts strings longer than 2 chars without throwing (slices internally)", () => {
    expect(() => drawTextToCanvas("Hello", 32, DEFAULT_CANVAS_OPTIONS)).not.toThrow();
  });

  it("applies background colour when bgColor is set", () => {
    const canvas = drawTextToCanvas("A", 32, { ...DEFAULT_CANVAS_OPTIONS, bgColor: "#ff0000" });
    expect(canvas.width).toBe(32);
  });

  it("respects padding option without throwing", () => {
    expect(() =>
      drawTextToCanvas("B", 64, { ...DEFAULT_CANVAS_OPTIONS, padding: 0.2 })
    ).not.toThrow();
  });
});

describe("drawToCanvas with options (mocked canvas)", () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  function makeImg(w: number, h: number): HTMLImageElement {
    const img = new Image(w, h);
    Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
    return img;
  }

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    // biome-ignore lint/suspicious/noExplicitAny: mock for jsdom
    (HTMLCanvasElement.prototype as any).getContext = () => ({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      roundRect: () => {},
      clip: () => {},
      drawImage: () => {},
      fillStyle: "",
    });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("returns correct canvas dimensions", () => {
    const img = makeImg(512, 512);
    const canvas = drawToCanvas(img, 32, DEFAULT_CANVAS_OPTIONS);
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(32);
  });

  it("applies padding without throwing", () => {
    const img = makeImg(512, 512);
    expect(() => drawToCanvas(img, 64, { ...DEFAULT_CANVAS_OPTIONS, padding: 0.1 })).not.toThrow();
  });

  it("applies corner radius without throwing", () => {
    const img = makeImg(512, 512);
    expect(() =>
      drawToCanvas(img, 64, { ...DEFAULT_CANVAS_OPTIONS, cornerRadius: 0.25 })
    ).not.toThrow();
  });

  it("handles non-square source images without throwing", () => {
    const img = makeImg(800, 200);
    expect(() => drawToCanvas(img, 64, DEFAULT_CANVAS_OPTIONS)).not.toThrow();
  });
});
