/**
 * Pure utility functions for EXIF processing.
 * No DOM, no canvas, no browser APIs — fully unit-testable.
 */

export interface GpsCoords {
  lat: number;
  lon: number;
}

// ── Sensitive field detection ────────────────────────────────────────────────

/**
 * Fields that can reveal the subject's identity, location, or device.
 * Shown in a dedicated "Sensitive" group and factored into the privacy verdict.
 */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  // Location
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSAltitude",
  "GPSImgDirection",
  "GPSSpeed",
  "GPSDestLatitude",
  "GPSDestLongitude",
  // Timestamps
  "DateTimeOriginal",
  "DateTime",
  "DateTimeDigitized",
  "CreateDate",
  "ModifyDate",
  "GPSDateStamp",
  "GPSTimeStamp",
  // Device / owner identity
  "SerialNumber",
  "CameraSerialNumber",
  "LensSerialNumber",
  "OwnerName",
  "CameraOwnerName",
  "Artist",
  "Copyright",
  // Software / editing trace
  "Software",
  "HistoryAction",
  "HistorySoftwareAgent",
]);

export type PrivacyLevel = "high" | "medium" | "clean";

export interface PrivacyVerdict {
  level: PrivacyLevel;
  /** Human-readable reasons, e.g. ["GPS location", "capture timestamp", "camera serial"] */
  reasons: string[];
}

/**
 * Classify the privacy risk of an EXIF record.
 * Returns the level and the specific reasons so the UI can surface them.
 */
export function getPrivacyVerdict(exif: Record<string, unknown>): PrivacyVerdict {
  const reasons: string[] = [];

  const hasGps =
    (typeof exif.latitude === "number" && Number.isFinite(exif.latitude)) ||
    (typeof exif.GPSLatitude === "number" && Number.isFinite(exif.GPSLatitude));

  if (hasGps) reasons.push("GPS location");

  const hasTimestamp = ["DateTimeOriginal", "DateTime", "CreateDate", "DateTimeDigitized"].some(
    (k) => k in exif && exif[k] != null
  );
  if (hasTimestamp) reasons.push("capture timestamp");

  const hasSerial = ["SerialNumber", "CameraSerialNumber", "LensSerialNumber"].some(
    (k) => k in exif && exif[k] != null
  );
  if (hasSerial) reasons.push("camera serial number");

  const hasOwner = ["OwnerName", "CameraOwnerName", "Artist", "Copyright"].some(
    (k) => k in exif && exif[k] != null && String(exif[k]).trim() !== ""
  );
  if (hasOwner) reasons.push("owner / artist name");

  const level: PrivacyLevel = hasGps ? "high" : reasons.length > 0 ? "medium" : "clean";

  return { level, reasons };
}

/**
 * Format a decimal GPS coordinate to a human-readable DMS string.
 * e.g. formatDms(37.7749, "lat") → "37° 46′ 29.64″ N"
 */
export function formatDms(decimal: number, axis: "lat" | "lon"): string {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(2);

  let dir: string;
  if (axis === "lat") {
    dir = decimal >= 0 ? "N" : "S";
  } else {
    dir = decimal >= 0 ? "E" : "W";
  }

  return `${deg}° ${min}′ ${sec}″ ${dir}`;
}

/**
 * Build a Google Maps URL from decimal GPS coordinates.
 */
export function buildMapUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

/**
 * Extract GPS coords from a raw exifr output object.
 * Returns null if either field is absent or not a finite number.
 */
export function extractGps(exif: Record<string, unknown>): GpsCoords | null {
  const lat = exif.latitude ?? exif.GPSLatitude;
  const lon = exif.longitude ?? exif.GPSLongitude;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** Keys to display first (ordered, if present), before the rest alphabetically. */
const PRIORITY_KEYS = [
  "Make",
  "Model",
  "LensModel",
  "DateTimeOriginal",
  "ExposureTime",
  "FNumber",
  "ISO",
  "FocalLength",
  "Flash",
  "WhiteBalance",
  "ImageWidth",
  "ImageHeight",
  "Orientation",
  "Software",
  "Copyright",
];

/**
 * Sort EXIF key names: priority keys first (in order), then remaining alphabetically.
 */
export function sortExifKeys(keys: string[]): string[] {
  const prioritySet = new Set(PRIORITY_KEYS);
  const prioritized = PRIORITY_KEYS.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !prioritySet.has(k)).sort((a, b) => a.localeCompare(b));
  return [...prioritized, ...rest];
}

/**
 * Format a raw EXIF value to a readable string.
 * Handles numbers, arrays, Dates, and objects gracefully.
 */
export function formatExifValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (value instanceof Date) return value.toISOString().replace("T", " ").replace("Z", "");
  if (typeof value === "number") {
    // Shutter speed fractions like 0.001 → "1/1000"
    if (value > 0 && value < 1) {
      const denom = Math.round(1 / value);
      return `1/${denom}`;
    }
    return String(value);
  }
  if (Array.isArray(value)) return value.map((v) => formatExifValue(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Determine if a MIME type is supported for canvas re-encode (EXIF strip).
 * canvas.toBlob only reliably produces image/jpeg and image/png.
 */
export function canvasOutputType(mimeType: string): "image/jpeg" | "image/png" {
  return mimeType === "image/png" ? "image/png" : "image/jpeg";
}

/**
 * Produce a suggested filename for the stripped download.
 * Strips known extensions and appends "-clean.<ext>".
 */
export function cleanFilename(original: string, mimeType: string): string {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const base = original.replace(/\.(jpe?g|png|tiff?|heic|webp)$/i, "");
  return `${base}-clean.${ext}`;
}

// ── Export helpers ────────────────────────────────────────────────────────────

/**
 * Serialise EXIF data to a JSON string.
 * Dates become ISO strings; everything else uses default JSON serialisation.
 */
export function exifToJson(exif: Record<string, unknown>): string {
  return JSON.stringify(
    exif,
    (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value as unknown;
    },
    2
  );
}

/**
 * Escape a single CSV cell value: wraps in quotes and escapes internal quotes.
 */
export function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Convert an EXIF record to a two-column CSV string (key, value).
 */
export function exifToCsv(exif: Record<string, unknown>): string {
  const header = "key,value";
  const rows = Object.entries(exif).map(([k, v]) => {
    return `${csvEscape(k)},${csvEscape(formatExifValue(v))}`;
  });
  return [header, ...rows].join("\n");
}

/**
 * Return the base filename (no extension) for export files.
 */
export function exportBasename(originalFilename: string): string {
  return originalFilename.replace(/\.[^.]+$/, "");
}
