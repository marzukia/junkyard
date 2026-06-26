/**
 * Augmentation tests for faviconCore.ts — pathways not covered by faviconCore.test.ts:
 *   - sanitiseAppName boundary at exactly 45 chars
 *   - buildManifest theme_color and display fields
 *   - buildHtmlSnippet includes SVG fallback link
 *   - buildIco single-frame
 *   - buildIco large frame (size >= 256)
 *   - buildIco data offsets are correct
 *   - FAVICON_SIZES all entries have valid structure
 *   - DEFAULT_CANVAS_OPTIONS exports correct defaults
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CANVAS_OPTIONS,
  FAVICON_SIZES,
  buildHtmlSnippet,
  buildIco,
  buildManifest,
  sanitiseAppName,
} from "./faviconCore";

// ── sanitiseAppName boundary ───────────────────────────────────────────────

describe("sanitiseAppName boundary cases", () => {
  it("returns exactly 45 chars when input is exactly 45", () => {
    const name = "A".repeat(45);
    expect(sanitiseAppName(name)).toHaveLength(45);
  });

  it("returns 45 chars (truncated) when input is 46", () => {
    const name = "B".repeat(46);
    expect(sanitiseAppName(name)).toHaveLength(45);
  });

  it("returns input unchanged when length < 45", () => {
    expect(sanitiseAppName("Short Name")).toBe("Short Name");
  });

  it("falls back to 'My App' for whitespace-only input", () => {
    expect(sanitiseAppName("   ")).toBe("My App");
    expect(sanitiseAppName("\t")).toBe("My App");
  });

  it("trims whitespace before length check", () => {
    // "  Hello  " trims to "Hello" which is < 45 chars
    expect(sanitiseAppName("  Hello  ")).toBe("Hello");
  });

  it("returns single character name unchanged", () => {
    expect(sanitiseAppName("X")).toBe("X");
  });
});

// ── buildManifest additional fields ───────────────────────────────────────

describe("buildManifest additional fields", () => {
  it("sets display to standalone", () => {
    const manifest = JSON.parse(buildManifest("App")) as { display: string };
    expect(manifest.display).toBe("standalone");
  });

  it("sets theme_color", () => {
    const manifest = JSON.parse(buildManifest("App")) as { theme_color: string };
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.theme_color).toMatch(/^#/);
  });

  it("sets background_color", () => {
    const manifest = JSON.parse(buildManifest("App")) as { background_color: string };
    expect(manifest.background_color).toBeTruthy();
  });

  it("short_name matches name", () => {
    const manifest = JSON.parse(buildManifest("My Site")) as { name: string; short_name: string };
    expect(manifest.short_name).toBe(manifest.name);
  });

  it("icon entries have type image/png", () => {
    const manifest = JSON.parse(buildManifest("App")) as { icons: { type: string }[] };
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
    }
  });

  it("produces valid JSON for an app name with special chars", () => {
    expect(() => JSON.parse(buildManifest('App "Name"'))).not.toThrow();
  });
});

// ── buildHtmlSnippet additional ────────────────────────────────────────────

describe("buildHtmlSnippet additional", () => {
  it("includes SVG favicon link", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet).toContain("image/svg+xml");
    expect(snippet).toContain("favicon.svg");
  });

  it("includes 32x32 favicon link", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet).toContain("32x32");
  });

  it("includes 16x16 favicon link", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet).toContain("16x16");
  });

  it("includes the app name in the comment", () => {
    const snippet = buildHtmlSnippet("My Awesome App");
    expect(snippet).toContain("My Awesome App");
  });

  it("is a multi-line string", () => {
    const snippet = buildHtmlSnippet("Test");
    expect(snippet.split("\n").length).toBeGreaterThan(1);
  });
});

// ── FAVICON_SIZES structure ────────────────────────────────────────────────

describe("FAVICON_SIZES structure", () => {
  it("every entry has a positive size", () => {
    for (const s of FAVICON_SIZES) {
      expect(s.size).toBeGreaterThan(0);
    }
  });

  it("every entry has a non-empty label matching its size", () => {
    for (const s of FAVICON_SIZES) {
      expect(s.label).toContain(String(s.size));
    }
  });

  it("every entry has a non-empty filename ending in .png", () => {
    for (const s of FAVICON_SIZES) {
      expect(s.filename).toMatch(/\.png$/);
      expect(s.filename.length).toBeGreaterThan(4);
    }
  });

  it("apple-touch-icon is 180px", () => {
    const icon = FAVICON_SIZES.find((s) => s.filename === "apple-touch-icon.png");
    expect(icon).toBeDefined();
    expect(icon?.size).toBe(180);
  });
});

// ── DEFAULT_CANVAS_OPTIONS ────────────────────────────────────────────────

describe("DEFAULT_CANVAS_OPTIONS structure", () => {
  it("bgColor is empty string (transparent)", () => {
    expect(DEFAULT_CANVAS_OPTIONS.bgColor).toBe("");
  });

  it("cornerRadius is 0", () => {
    expect(DEFAULT_CANVAS_OPTIONS.cornerRadius).toBe(0);
  });

  it("padding is 0", () => {
    expect(DEFAULT_CANVAS_OPTIONS.padding).toBe(0);
  });
});

// ── buildIco edge cases ────────────────────────────────────────────────────

function makePngBytes(size: number): Uint8Array {
  // Minimal synthetic PNG (not valid image, but valid enough for ICO container test)
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrLen = new Uint8Array([0, 0, 0, 13]);
  const ihdrType = new TextEncoder().encode("IHDR");
  const ihdrData = new Uint8Array(13);
  new DataView(ihdrData.buffer).setUint32(0, size);
  new DataView(ihdrData.buffer).setUint32(4, size);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  const ihdrCrc = new Uint8Array(4);
  const iendLen = new Uint8Array([0, 0, 0, 0]);
  const iendType = new TextEncoder().encode("IEND");
  const iendCrc = new Uint8Array([174, 66, 96, 130]);
  const total =
    sig.length +
    ihdrLen.length +
    ihdrType.length +
    ihdrData.length +
    ihdrCrc.length +
    iendLen.length +
    iendType.length +
    iendCrc.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of [sig, ihdrLen, ihdrType, ihdrData, ihdrCrc, iendLen, iendType, iendCrc]) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

describe("buildIco edge cases", () => {
  it("single frame: count = 1", () => {
    const ico = buildIco([{ size: 16, data: makePngBytes(16) }]);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(4, true)).toBe(1);
  });

  it("size 256 uses width=0 in directory (ICO spec)", () => {
    const ico = buildIco([{ size: 256, data: makePngBytes(256) }]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });

  it("size 48 records correct width/height", () => {
    const ico = buildIco([{ size: 48, data: makePngBytes(48) }]);
    expect(ico[6]).toBe(48);
    expect(ico[7]).toBe(48);
  });

  it("total byte length matches header + dir + data", () => {
    const data16 = makePngBytes(16);
    const data32 = makePngBytes(32);
    const ico = buildIco([
      { size: 16, data: data16 },
      { size: 32, data: data32 },
    ]);
    // 6 header + 2*16 dir + data16.length + data32.length
    const expected = 6 + 32 + data16.length + data32.length;
    expect(ico.length).toBe(expected);
  });

  it("first data offset is immediately after header + directory", () => {
    const data = makePngBytes(16);
    const ico = buildIco([{ size: 16, data }]);
    const view = new DataView(ico.buffer);
    // data offset is at directory entry bytes 12-15 (little-endian uint32)
    const offset = view.getUint32(6 + 12, true);
    // should be 6 header + 1*16 dir = 22
    expect(offset).toBe(22);
  });

  it("bits per pixel entry is 32 in directory", () => {
    const ico = buildIco([{ size: 16, data: makePngBytes(16) }]);
    const view = new DataView(ico.buffer);
    // Directory entry base at 6; bits per pixel at offset 6
    expect(view.getUint16(6 + 6, true)).toBe(32);
  });
});
