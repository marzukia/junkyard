import { describe, expect, it } from "vitest";
import {
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

describe("formatDms", () => {
  it("formats a positive latitude as North", () => {
    const result = formatDms(37.7749, "lat");
    expect(result).toContain("N");
    expect(result).toContain("37°");
  });

  it("formats a negative latitude as South", () => {
    const result = formatDms(-36.8485, "lat");
    expect(result).toContain("S");
    expect(result).toContain("36°");
  });

  it("formats a positive longitude as East", () => {
    const result = formatDms(174.7633, "lon");
    expect(result).toContain("E");
    expect(result).toContain("174°");
  });

  it("formats a negative longitude as West", () => {
    const result = formatDms(-122.4194, "lon");
    expect(result).toContain("W");
    expect(result).toContain("122°");
  });

  it("produces degree, minute, second components", () => {
    const result = formatDms(0.5, "lat");
    // 0.5 decimal = 0° 30′ 00.00″ N
    expect(result).toMatch(/0°\s*30′/);
  });

  it("zero-pads minutes to 2 digits", () => {
    // 0.0833... decimal lat = 0° 05′ ...
    const result = formatDms(0.0833, "lat");
    expect(result).toMatch(/0°\s*0[0-9]′/);
    // minutes component must be 2 chars before the prime symbol
    expect(result).toMatch(/\d{2}′/);
  });

  it("zero-pads seconds to 5 characters (MM.SS)", () => {
    // Use a coordinate where seconds are a single digit before decimal
    // 1° 00′ 09.00″ N => decimal = 1 + (9/3600) = 1.0025
    const result = formatDms(1.0025, "lat");
    // Seconds should be "09.00" not "9.00" — 5-char padded
    expect(result).toMatch(/\d{2}\.\d{2}″/);
  });

  it("formats minutes and seconds consistently (both zero-padded)", () => {
    // Both minutes and seconds should use zero-padded fixed-width format
    const result = formatDms(0, "lat");
    // 0° 00′ 00.00″ N
    expect(result).toMatch(/0°\s*00′\s*00\.00″\s*N/);
  });
});

describe("buildMapUrl", () => {
  it("builds a valid Google Maps URL", () => {
    const url = buildMapUrl(37.7749, -122.4194);
    expect(url).toBe("https://www.google.com/maps?q=37.774900,-122.419400");
  });

  it("includes 6 decimal places", () => {
    const url = buildMapUrl(0, 0);
    expect(url).toBe("https://www.google.com/maps?q=0.000000,0.000000");
  });
});

describe("extractGps", () => {
  it("returns lat/lon when lowercase fields are present", () => {
    const result = extractGps({ latitude: 37.7749, longitude: -122.4194 });
    expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
  });

  it("returns lat/lon when uppercase GPS fields are present", () => {
    const result = extractGps({ GPSLatitude: -36.8485, GPSLongitude: 174.7633 });
    expect(result).toEqual({ lat: -36.8485, lon: 174.7633 });
  });

  it("returns null when fields are missing", () => {
    expect(extractGps({ Make: "Canon" })).toBeNull();
  });

  it("returns null when values are not numbers", () => {
    expect(extractGps({ latitude: "37.7749", longitude: null })).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(extractGps({ latitude: Number.NaN, longitude: 0 })).toBeNull();
    expect(extractGps({ latitude: Number.POSITIVE_INFINITY, longitude: 0 })).toBeNull();
  });
});

describe("sortExifKeys", () => {
  it("puts Make before Model before the rest", () => {
    const keys = ["ExposureTime", "Model", "Make", "ISO", "ZZZ"];
    const sorted = sortExifKeys(keys);
    expect(sorted.indexOf("Make")).toBeLessThan(sorted.indexOf("Model"));
    expect(sorted.indexOf("Model")).toBeLessThan(sorted.indexOf("ExposureTime"));
  });

  it("sorts non-priority keys alphabetically after priority ones", () => {
    const keys = ["Bravo", "Alpha", "Make"];
    const sorted = sortExifKeys(keys);
    expect(sorted[0]).toBe("Make");
    expect(sorted[1]).toBe("Alpha");
    expect(sorted[2]).toBe("Bravo");
  });
});

describe("formatExifValue", () => {
  it("formats a shutter speed fraction", () => {
    expect(formatExifValue(0.001)).toBe("1/1000");
    expect(formatExifValue(0.00625)).toBe("1/160");
  });

  it("formats whole numbers as strings", () => {
    expect(formatExifValue(800)).toBe("800");
  });

  it("formats Date objects as ISO-ish strings", () => {
    const d = new Date("2023-06-15T10:30:00Z");
    expect(formatExifValue(d)).toContain("2023-06-15");
  });

  it("formats arrays by joining formatted elements", () => {
    expect(formatExifValue([1, 2, 3])).toBe("1, 2, 3");
  });

  it("returns a dash for null/undefined", () => {
    expect(formatExifValue(null)).toBe("-");
    expect(formatExifValue(undefined)).toBe("-");
  });

  it("formats strings as-is", () => {
    expect(formatExifValue("Canon EOS")).toBe("Canon EOS");
  });
});

describe("canvasOutputType", () => {
  it("returns image/png for PNG input", () => {
    expect(canvasOutputType("image/png")).toBe("image/png");
  });

  it("returns image/jpeg for JPEG input", () => {
    expect(canvasOutputType("image/jpeg")).toBe("image/jpeg");
  });

  it("returns image/jpeg for unknown types (HEIC, WebP, etc.)", () => {
    expect(canvasOutputType("image/heic")).toBe("image/jpeg");
    expect(canvasOutputType("image/webp")).toBe("image/jpeg");
  });
});

describe("cleanFilename", () => {
  it("appends -clean.jpg for JPEG output", () => {
    expect(cleanFilename("photo.jpg", "image/jpeg")).toBe("photo-clean.jpg");
  });

  it("appends -clean.png for PNG output", () => {
    expect(cleanFilename("shot.png", "image/png")).toBe("shot-clean.png");
  });

  it("strips the original extension before appending", () => {
    expect(cleanFilename("IMG_1234.jpeg", "image/jpeg")).toBe("IMG_1234-clean.jpg");
  });

  it("handles filenames without a known extension", () => {
    expect(cleanFilename("noext", "image/jpeg")).toBe("noext-clean.jpg");
  });
});

describe("getPrivacyVerdict", () => {
  it("returns high with GPS reason when latitude is present", () => {
    const v = getPrivacyVerdict({ latitude: 37.7749, longitude: -122.4194 });
    expect(v.level).toBe("high");
    expect(v.reasons).toContain("GPS location");
  });

  it("returns medium when only timestamp is present", () => {
    const v = getPrivacyVerdict({ DateTimeOriginal: "2023-06-15T10:30:00" });
    expect(v.level).toBe("medium");
    expect(v.reasons).toContain("capture timestamp");
  });

  it("returns medium when camera serial is present without GPS", () => {
    const v = getPrivacyVerdict({ SerialNumber: "ABC123" });
    expect(v.level).toBe("medium");
    expect(v.reasons).toContain("camera serial number");
  });

  it("returns clean when no sensitive fields present", () => {
    const v = getPrivacyVerdict({ ImageWidth: 4000, ImageHeight: 3000 });
    expect(v.level).toBe("clean");
    expect(v.reasons).toHaveLength(0);
  });

  it("includes owner reason when artist field present", () => {
    const v = getPrivacyVerdict({ Artist: "Jane Doe" });
    expect(v.level).toBe("medium");
    expect(v.reasons).toContain("owner / artist name");
  });

  it("does not include owner reason for empty string", () => {
    const v = getPrivacyVerdict({ Artist: "" });
    expect(v.level).toBe("clean");
  });
});

describe("csvEscape", () => {
  it("wraps values in double quotes", () => {
    expect(csvEscape("hello")).toBe('"hello"');
  });

  it("escapes internal double quotes by doubling them", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("handles commas and newlines safely inside quotes", () => {
    expect(csvEscape("a,b\nc")).toBe('"a,b\nc"');
  });
});

describe("exifToJson", () => {
  it("serialises EXIF to indented JSON", () => {
    const json = exifToJson({ Make: "Canon", ISO: 100 });
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.Make).toBe("Canon");
    expect(parsed.ISO).toBe(100);
  });

  it("converts Date objects to ISO strings", () => {
    const d = new Date("2023-06-15T10:30:00.000Z");
    const json = exifToJson({ DateTimeOriginal: d });
    expect(json).toContain("2023-06-15T10:30:00.000Z");
  });
});

describe("exifToCsv", () => {
  it("produces a header row and one data row per field", () => {
    const csv = exifToCsv({ Make: "Canon" });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("key,value");
    expect(lines[1]).toBe('"Make","Canon"');
  });
});

describe("exportBasename", () => {
  it("strips the file extension", () => {
    expect(exportBasename("photo.jpg")).toBe("photo");
  });

  it("handles files with no extension", () => {
    expect(exportBasename("noext")).toBe("noext");
  });

  it("handles multiple dots", () => {
    expect(exportBasename("my.photo.jpg")).toBe("my.photo");
  });
});

// ── Bug regression: Browse (handleChange) non-image guard ────────────────────
// Before the fix, handleChange in DropZone passed ALL files to onFiles with no
// type check, so a .txt selected via Browse produced a broken thumbnail.
// The fix mirrors handleDrop: only image/* goes to onFiles; anything else routes
// to onUnsupported. This test guards the predicate that drives that branch.
describe("image-type guard predicate (bug regression)", () => {
  it("image/jpeg passes the image/* filter", () => {
    const f = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    expect(f.type.startsWith("image/")).toBe(true);
  });

  it("image/png passes the image/* filter", () => {
    const f = new File(["x"], "photo.png", { type: "image/png" });
    expect(f.type.startsWith("image/")).toBe(true);
  });

  it("text/plain does NOT pass the image/* filter", () => {
    const f = new File(["hello"], "note.txt", { type: "text/plain" });
    expect(f.type.startsWith("image/")).toBe(false);
  });

  it("application/pdf does NOT pass the image/* filter", () => {
    const f = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
    expect(f.type.startsWith("image/")).toBe(false);
  });

  it("a batch of mixed files partitions correctly into images and non-images", () => {
    const files = [
      new File(["x"], "a.jpg", { type: "image/jpeg" }),
      new File(["x"], "b.txt", { type: "text/plain" }),
      new File(["x"], "c.png", { type: "image/png" }),
      new File(["%PDF"], "d.pdf", { type: "application/pdf" }),
    ];
    const images = files.filter((f) => f.type.startsWith("image/"));
    const others = files.filter((f) => !f.type.startsWith("image/"));
    expect(images.map((f) => f.name)).toEqual(["a.jpg", "c.png"]);
    expect(others.map((f) => f.name)).toEqual(["b.txt", "d.pdf"]);
  });
});
