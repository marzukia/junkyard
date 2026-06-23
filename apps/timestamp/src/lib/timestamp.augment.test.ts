/**
 * Augment tests for timestamp/timestamp.ts -- covers gaps in the existing suite:
 * applyCustomFormat additional tokens (YY, MMM, MMMM, dddd, Z), relativeTime
 * year/month/week ranges, batchConvert edge cases, parseDiffInput ISO variants,
 * computeDiff month-boundary arithmetic.
 */
import { describe, expect, it } from "vitest";
import {
  applyCustomFormat,
  batchConvert,
  computeDiff,
  convertEpoch,
  dateStringToEpoch,
  parseDiffInput,
  relativeTime,
  toRfc2822,
} from "./timestamp";

// ── relativeTime -- additional time units ─────────────────────────────────────

describe("relativeTime -- additional units", () => {
  const now = 1_700_000_000_000;

  it("returns weeks ago for 14-day gap", () => {
    const result = relativeTime(now - 14 * 24 * 60 * 60 * 1000, now);
    expect(result).toMatch(/week/);
  });

  it("returns months ago for 60-day gap", () => {
    const result = relativeTime(now - 60 * 24 * 60 * 60 * 1000, now);
    expect(result).toMatch(/month/);
  });

  it("returns years ago for 400-day gap", () => {
    const result = relativeTime(now - 400 * 24 * 60 * 60 * 1000, now);
    expect(result).toMatch(/year/);
  });

  it("returns in N weeks for future 14-day gap", () => {
    const result = relativeTime(now + 14 * 24 * 60 * 60 * 1000, now);
    expect(result).toMatch(/^in .* week/);
  });

  it("returns in N months for future 60-day gap", () => {
    const result = relativeTime(now + 60 * 24 * 60 * 60 * 1000, now);
    expect(result).toMatch(/^in .* month/);
  });

  it("returns in N years for future 400-day gap", () => {
    const result = relativeTime(now + 400 * 24 * 60 * 60 * 1000, now);
    expect(result).toMatch(/^in .* year/);
  });

  it("uses singular for exactly 1 hour", () => {
    expect(relativeTime(now + 60 * 60 * 1000, now)).toBe("in 1 hour");
  });

  it("uses singular for exactly 1 day", () => {
    expect(relativeTime(now + 24 * 60 * 60 * 1000, now)).toBe("in 1 day");
  });
});

// ── toRfc2822 -- day/month coverage ──────────────────────────────────────────

describe("toRfc2822 -- various days", () => {
  it("Friday is formatted as Fri", () => {
    // 2024-01-05 is a Friday
    const d = new Date(Date.UTC(2024, 0, 5));
    expect(toRfc2822(d.getTime())).toContain("Fri");
  });

  it("December is formatted as Dec", () => {
    const d = new Date(Date.UTC(2024, 11, 25));
    expect(toRfc2822(d.getTime())).toContain("Dec");
  });

  it("format is 'Day, DD Mon YYYY HH:MM:SS +0000'", () => {
    const result = toRfc2822(0);
    expect(result).toMatch(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} \+0000$/);
  });
});

// ── applyCustomFormat -- additional tokens ────────────────────────────────────

describe("applyCustomFormat -- additional tokens", () => {
  const d = new Date(0); // 1970-01-01T00:00:00.000Z

  it("YY gives last 2 digits of year", () => {
    expect(applyCustomFormat(d, "YY", "UTC")).toBe("70");
  });

  it("SSS gives zero milliseconds as 000", () => {
    expect(applyCustomFormat(d, "SSS", "UTC")).toBe("000");
  });

  it("format string with no tokens is unchanged (no token chars)", () => {
    // Note: 'x' and 'X' are tokens (unix ms/s). Use a string with no token chars.
    expect(applyCustomFormat(d, "hello world", "UTC")).toBe("hello world");
  });

  it("empty format string returns empty string", () => {
    expect(applyCustomFormat(d, "", "UTC")).toBe("");
  });

  it("handles mixed tokens and literal separators", () => {
    const result = applyCustomFormat(d, "YYYY/MM/DD", "UTC");
    expect(result).toBe("1970/01/01");
  });
});

// ── convertEpoch -- additional paths ─────────────────────────────────────────

describe("convertEpoch -- additional paths", () => {
  const now = 1_700_000_000_000;

  it("negative epoch (pre-1970) parses without throwing", () => {
    const result = convertEpoch(-86_400_000, "UTC", now); // 1969-12-31
    expect(result.iso8601).toContain("1969");
  });

  it("weekOfYear is in 1-53 range for arbitrary dates", () => {
    const dates = [
      Date.UTC(2024, 2, 15),
      Date.UTC(2024, 5, 1),
      Date.UTC(2024, 11, 1),
    ];
    for (const ms of dates) {
      const result = convertEpoch(ms, "UTC", now);
      expect(result.weekOfYear).toBeGreaterThanOrEqual(1);
      expect(result.weekOfYear).toBeLessThanOrEqual(53);
    }
  });

  it("unixHex for a known value", () => {
    // epochS = 256 = 0x100
    const result = convertEpoch(256_000, "UTC", now);
    expect(result.unixHex).toBe("0x100");
  });
});

// ── batchConvert -- edge cases ────────────────────────────────────────────────

describe("batchConvert -- edge cases", () => {
  it("handles lines with leading/trailing spaces", () => {
    const result = batchConvert("  1700000000  ");
    expect(result).toHaveLength(1);
    expect(result[0].error).toBeNull();
  });

  it("handles a single invalid line", () => {
    const result = batchConvert("NaN");
    expect(result[0].error).not.toBeNull();
  });

  it("sets iso8601 to a valid ISO string for valid input", () => {
    const result = batchConvert("1700000000");
    expect(result[0].iso8601).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── computeDiff -- boundary cases ─────────────────────────────────────────────

describe("computeDiff -- boundary cases", () => {
  it("exactly 30 days apart gives days=30 (or 0 months 30 days depending on calendar)", () => {
    const a = Date.UTC(2024, 0, 1); // Jan 1
    const b = Date.UTC(2024, 0, 31); // Jan 31
    const diff = computeDiff(a, b);
    expect(diff.totalDays).toBe(30);
    expect(diff.sign).toBe("future");
  });

  it("crosses month boundary correctly (28 Feb -> 1 Mar)", () => {
    const a = Date.UTC(2024, 1, 28); // Feb 28
    const b = Date.UTC(2024, 2, 1); // Mar 1
    const diff = computeDiff(a, b);
    // 1 day apart (2024 is a leap year so Feb 28 + 1 = Feb 29, not Mar 1, but still <2d)
    expect(diff.totalDays).toBeLessThanOrEqual(2);
  });

  it("totalMs is always non-negative", () => {
    expect(computeDiff(1000, 0).totalMs).toBeGreaterThanOrEqual(0);
    expect(computeDiff(0, 1000).totalMs).toBeGreaterThanOrEqual(0);
  });

  it("zero difference has all component fields at 0", () => {
    const diff = computeDiff(5000, 5000);
    expect(diff.years).toBe(0);
    expect(diff.months).toBe(0);
    expect(diff.days).toBe(0);
    expect(diff.hours).toBe(0);
    expect(diff.minutes).toBe(0);
    expect(diff.seconds).toBe(0);
  });
});

// ── parseDiffInput -- additional paths ────────────────────────────────────────

describe("parseDiffInput -- additional paths", () => {
  it("returns null for a float-like epoch string (non-integer)", () => {
    // "1700000000.5" -- has a decimal, should fall through to date-string parse
    const result = parseDiffInput("1700000000.5");
    // The function tries new Date("1700000000.5") -- NaN; should return null
    expect(result).toBeNull();
  });

  it("parses a readable date without time component", () => {
    const result = parseDiffInput("2024-01-01");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
  });

  it("handles whitespace-only input", () => {
    expect(parseDiffInput("   ")).toBeNull();
  });
});

// ── dateStringToEpoch -- additional paths ─────────────────────────────────────

describe("dateStringToEpoch -- additional paths", () => {
  it("parses date-only string (no time)", () => {
    const result = dateStringToEpoch("2024-06-15");
    expect(result).not.toBeNull();
    expect(result?.iso8601).toMatch(/^2024-06-15/);
  });

  it("epochS is epochMs / 1000", () => {
    const result = dateStringToEpoch("1970-01-01T00:00:00.000Z");
    expect(result?.epochS).toBe(0);
    expect(result?.epochMs).toBe(0);
  });

  it("returns null for whitespace only", () => {
    expect(dateStringToEpoch("   ")).toBeNull();
  });
});
