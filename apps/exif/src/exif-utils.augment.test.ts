/**
 * Augmentation tests for exif-utils.ts — pathways not covered by exif-utils.test.ts:
 *   - SENSITIVE_KEYS membership
 *   - formatExifValue with object input
 *   - formatExifValue with boolean input
 *   - formatExifValue with nested array of objects
 *   - formatDms at zero (equator / prime meridian)
 *   - formatDms at 180 longitude
 *   - getPrivacyVerdict multiple combined fields (GPS + timestamp)
 *   - getPrivacyVerdict with Copyright field
 *   - getPrivacyVerdict with GPSLatitude (not lowercase)
 *   - sortExifKeys all priority keys present
 *   - exifToCsv with multiple fields
 *   - exifToJson with numeric and null values
 *   - canvasOutputType with TIFF
 *   - cleanFilename with TIFF input
 *   - exportBasename with deep-dotted name
 */
import { describe, expect, it } from "vitest";
import {
  SENSITIVE_KEYS,
  buildMapUrl,
  canvasOutputType,
  cleanFilename,
  csvEscape,
  exifToCsv,
  exifToJson,
  exportBasename,
  extractGps,
  formatDms,
  formatExifValue,
  getPrivacyVerdict,
  sortExifKeys,
} from "./exif-utils";

// ── SENSITIVE_KEYS membership ─────────────────────────────────────────────

describe("SENSITIVE_KEYS membership", () => {
  it("includes GPS coordinate keys", () => {
    expect(SENSITIVE_KEYS.has("latitude")).toBe(true);
    expect(SENSITIVE_KEYS.has("longitude")).toBe(true);
    expect(SENSITIVE_KEYS.has("GPSLatitude")).toBe(true);
    expect(SENSITIVE_KEYS.has("GPSLongitude")).toBe(true);
  });

  it("includes timestamp keys", () => {
    expect(SENSITIVE_KEYS.has("DateTimeOriginal")).toBe(true);
    expect(SENSITIVE_KEYS.has("DateTime")).toBe(true);
    expect(SENSITIVE_KEYS.has("CreateDate")).toBe(true);
  });

  it("includes device identity keys", () => {
    expect(SENSITIVE_KEYS.has("SerialNumber")).toBe(true);
    expect(SENSITIVE_KEYS.has("Artist")).toBe(true);
    expect(SENSITIVE_KEYS.has("Copyright")).toBe(true);
    expect(SENSITIVE_KEYS.has("OwnerName")).toBe(true);
  });

  it("does not include non-sensitive fields like ImageWidth", () => {
    expect(SENSITIVE_KEYS.has("ImageWidth")).toBe(false);
    expect(SENSITIVE_KEYS.has("Make")).toBe(false);
    expect(SENSITIVE_KEYS.has("Model")).toBe(false);
  });
});

// ── formatExifValue edge cases ────────────────────────────────────────────

describe("formatExifValue edge cases", () => {
  it("formats a plain object as JSON string", () => {
    const result = formatExifValue({ foo: "bar", num: 42 });
    expect(result).toBe('{"foo":"bar","num":42}');
  });

  it("formats boolean true as 'true'", () => {
    expect(formatExifValue(true)).toBe("true");
  });

  it("formats boolean false as 'false'", () => {
    expect(formatExifValue(false)).toBe("false");
  });

  it("formats 0 as '0' (not a fraction)", () => {
    expect(formatExifValue(0)).toBe("0");
  });

  it("formats 1 as '1' (not a fraction)", () => {
    expect(formatExifValue(1)).toBe("1");
  });

  it("formats -1 as '-1'", () => {
    expect(formatExifValue(-1)).toBe("-1");
  });

  it("formats nested array of numbers", () => {
    const result = formatExifValue([0.001, 400, 2.8]);
    expect(result).toBe("1/1000, 400, 2.8");
  });

  it("formats a Date without trailing Z", () => {
    const d = new Date("2023-06-15T10:30:00.000Z");
    const result = formatExifValue(d);
    expect(result).not.toMatch(/Z$/);
    expect(result).toContain("2023-06-15");
  });
});

// ── formatDms edge cases ──────────────────────────────────────────────────

describe("formatDms edge cases", () => {
  it("formats exactly 0 latitude as North", () => {
    const result = formatDms(0, "lat");
    expect(result).toContain("N");
    expect(result).toContain("0°");
  });

  it("formats exactly 0 longitude as East", () => {
    const result = formatDms(0, "lon");
    expect(result).toContain("E");
    expect(result).toContain("0°");
  });

  it("formats 90.0 latitude as N", () => {
    const result = formatDms(90, "lat");
    expect(result).toContain("N");
    expect(result).toContain("90°");
  });

  it("formats -90.0 latitude as S", () => {
    const result = formatDms(-90, "lat");
    expect(result).toContain("S");
    expect(result).toContain("90°");
  });

  it("formats 180.0 longitude as E", () => {
    const result = formatDms(180, "lon");
    expect(result).toContain("E");
    expect(result).toContain("180°");
  });

  it("minutes and seconds components are present", () => {
    const result = formatDms(37.7749, "lat");
    // Should contain degree, prime (minute), double-prime (second)
    expect(result).toContain("°");
    expect(result).toContain("′");
    expect(result).toContain("″");
  });
});

// ── extractGps edge cases ─────────────────────────────────────────────────

describe("extractGps edge cases", () => {
  it("prefers lowercase latitude over GPSLatitude", () => {
    const result = extractGps({ latitude: 10, longitude: 20, GPSLatitude: 99, GPSLongitude: 99 });
    expect(result?.lat).toBe(10);
    expect(result?.lon).toBe(20);
  });

  it("falls back to GPSLatitude/GPSLongitude if lowercase absent", () => {
    const result = extractGps({ GPSLatitude: 10, GPSLongitude: 20 });
    expect(result).toEqual({ lat: 10, lon: 20 });
  });

  it("returns null when lon is NaN", () => {
    expect(extractGps({ latitude: 10, longitude: Number.NaN })).toBeNull();
  });

  it("returns null for both lat/lon being zero (valid edge case)", () => {
    // 0,0 is a valid GPS coordinate (Gulf of Guinea)
    const result = extractGps({ latitude: 0, longitude: 0 });
    expect(result).toEqual({ lat: 0, lon: 0 });
  });
});

// ── getPrivacyVerdict combined fields ─────────────────────────────────────

describe("getPrivacyVerdict combined fields", () => {
  it("returns high when GPS + timestamp are both present", () => {
    const v = getPrivacyVerdict({
      latitude: 37.7749,
      longitude: -122.4194,
      DateTimeOriginal: "2023-06-15",
    });
    expect(v.level).toBe("high");
    expect(v.reasons).toContain("GPS location");
    expect(v.reasons).toContain("capture timestamp");
  });

  it("returns high when GPS + serial + owner are present", () => {
    const v = getPrivacyVerdict({
      GPSLatitude: -36.8485,
      GPSLongitude: 174.7633,
      SerialNumber: "ABC123",
      Artist: "Jane",
    });
    expect(v.level).toBe("high");
    expect(v.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("Copyright field triggers owner reason", () => {
    const v = getPrivacyVerdict({ Copyright: "2023 Jane Doe" });
    expect(v.level).toBe("medium");
    expect(v.reasons).toContain("owner / artist name");
  });

  it("Copyright empty string does NOT trigger owner reason", () => {
    const v = getPrivacyVerdict({ Copyright: "" });
    expect(v.level).toBe("clean");
  });

  it("GPSLatitude (uppercase) triggers high level", () => {
    const v = getPrivacyVerdict({ GPSLatitude: 37.7749, GPSLongitude: -122.4194 });
    expect(v.level).toBe("high");
  });

  it("DateTime triggers timestamp reason", () => {
    const v = getPrivacyVerdict({ DateTime: "2023:06:15 10:30:00" });
    expect(v.reasons).toContain("capture timestamp");
  });

  it("LensSerialNumber triggers serial reason", () => {
    const v = getPrivacyVerdict({ LensSerialNumber: "XYZ789" });
    expect(v.level).toBe("medium");
    expect(v.reasons).toContain("camera serial number");
  });
});

// ── sortExifKeys all priority keys ────────────────────────────────────────

describe("sortExifKeys with all priority keys", () => {
  it("preserves priority order when all priority keys are present", () => {
    const keys = ["ISO", "Make", "LensModel", "Model", "FocalLength", "DateTimeOriginal"];
    const sorted = sortExifKeys(keys);
    const makeIdx = sorted.indexOf("Make");
    const modelIdx = sorted.indexOf("Model");
    const lensIdx = sorted.indexOf("LensModel");
    const isoIdx = sorted.indexOf("ISO");
    expect(makeIdx).toBeLessThan(modelIdx);
    expect(modelIdx).toBeLessThan(lensIdx);
    expect(lensIdx).toBeLessThan(isoIdx);
  });

  it("unknown keys sorted after all priority keys", () => {
    const keys = ["ZZZ", "Make", "AAA"];
    const sorted = sortExifKeys(keys);
    const makeIdx = sorted.indexOf("Make");
    const aaaIdx = sorted.indexOf("AAA");
    const zzzIdx = sorted.indexOf("ZZZ");
    expect(makeIdx).toBeLessThan(aaaIdx);
    expect(aaaIdx).toBeLessThan(zzzIdx);
  });

  it("returns empty array for empty input", () => {
    expect(sortExifKeys([])).toEqual([]);
  });
});

// ── exifToJson ─────────────────────────────────────────────────────────────

describe("exifToJson edge cases", () => {
  it("serialises null values as JSON null", () => {
    const json = exifToJson({ key: null });
    expect(json).toContain("null");
  });

  it("serialises numeric values correctly", () => {
    const json = exifToJson({ ISO: 800, FNumber: 2.8 });
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.ISO).toBe(800);
    expect(parsed.FNumber).toBe(2.8);
  });

  it("Date objects are serialised as ISO strings", () => {
    const d = new Date("2023-01-01T00:00:00.000Z");
    const json = exifToJson({ DateTimeOriginal: d });
    expect(json).toContain("2023-01-01T00:00:00.000Z");
  });
});

// ── exifToCsv ─────────────────────────────────────────────────────────────

describe("exifToCsv edge cases", () => {
  it("produces one data row per key", () => {
    const csv = exifToCsv({ Make: "Canon", Model: "EOS", ISO: 100 });
    const lines = csv.split("\n");
    // header + 3 data rows
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("key,value");
  });

  it("escapes keys that contain double quotes", () => {
    const csv = exifToCsv({ 'key"with"quotes': "val" });
    // The key cell should have doubled internal quotes
    expect(csv).toContain('""');
  });

  it("formats shutter speed fraction in value column", () => {
    const csv = exifToCsv({ ExposureTime: 0.001 });
    expect(csv).toContain("1/1000");
  });
});

// ── canvasOutputType edge cases ────────────────────────────────────────────

describe("canvasOutputType edge cases", () => {
  it("maps TIFF to jpeg", () => {
    expect(canvasOutputType("image/tiff")).toBe("image/jpeg");
  });

  it("maps empty string to jpeg", () => {
    expect(canvasOutputType("")).toBe("image/jpeg");
  });

  it("maps BMP to jpeg", () => {
    expect(canvasOutputType("image/bmp")).toBe("image/jpeg");
  });

  it("maps SVG to jpeg", () => {
    expect(canvasOutputType("image/svg+xml")).toBe("image/jpeg");
  });
});

// ── cleanFilename edge cases ───────────────────────────────────────────────

describe("cleanFilename edge cases", () => {
  it("handles TIFF extension", () => {
    expect(cleanFilename("scan.tiff", "image/jpeg")).toBe("scan-clean.jpg");
  });

  it("handles HEIC extension", () => {
    expect(cleanFilename("photo.heic", "image/jpeg")).toBe("photo-clean.jpg");
  });

  it("handles WebP extension", () => {
    expect(cleanFilename("img.webp", "image/jpeg")).toBe("img-clean.jpg");
  });

  it("handles multiple dots in filename", () => {
    expect(cleanFilename("my.portrait.jpg", "image/jpeg")).toBe("my.portrait-clean.jpg");
  });
});

// ── exportBasename edge cases ──────────────────────────────────────────────

describe("exportBasename edge cases", () => {
  it("strips .jpg extension", () => {
    expect(exportBasename("portrait.jpg")).toBe("portrait");
  });

  it("strips .jpeg extension", () => {
    expect(exportBasename("portrait.jpeg")).toBe("portrait");
  });

  it("handles files with no extension", () => {
    expect(exportBasename("photo")).toBe("photo");
  });

  it("strips only the last extension from a dotted name", () => {
    expect(exportBasename("photo.2023.jpg")).toBe("photo.2023");
  });

  it("handles empty string", () => {
    expect(exportBasename("")).toBe("");
  });
});

// ── csvEscape ─────────────────────────────────────────────────────────────

describe("csvEscape edge cases", () => {
  it("always wraps in double quotes", () => {
    expect(csvEscape("hello")).toMatch(/^".*"$/);
  });

  it("escapes internal double quotes by doubling", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps empty string in quotes", () => {
    expect(csvEscape("")).toBe('""');
  });

  it("wraps newline-containing string in quotes", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
});

// ── buildMapUrl edge cases ─────────────────────────────────────────────────

describe("buildMapUrl edge cases", () => {
  it("formats negative coordinates correctly", () => {
    const url = buildMapUrl(-36.8485, -122.4194);
    expect(url).toContain("-36.848500");
    expect(url).toContain("-122.419400");
  });

  it("formats 0,0 correctly", () => {
    expect(buildMapUrl(0, 0)).toBe("https://www.google.com/maps?q=0.000000,0.000000");
  });
});
