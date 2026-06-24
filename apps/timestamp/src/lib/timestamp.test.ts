import { describe, expect, it } from "vitest";
import {
  applyCustomFormat,
  batchConvert,
  computeDiff,
  convertEpoch,
  dateStringToEpoch,
  dayOfYear,
  detectUnit,
  isLeapYear,
  isoWeekNumber,
  parseDiffInput,
  parseEpochString,
  relativeTime,
  toRfc2822,
} from "./timestamp";

// ── detectUnit ─────────────────────────────────────────────────────────────────

describe("detectUnit", () => {
  it("detects seconds for values below 1e12", () => {
    expect(detectUnit("1700000000")).toBe("s");
  });

  it("detects milliseconds for values >= 1e12", () => {
    expect(detectUnit("1700000000000")).toBe("ms");
  });

  it("handles negative seconds", () => {
    expect(detectUnit("-1000")).toBe("s");
  });

  it("handles negative milliseconds", () => {
    expect(detectUnit("-1700000000000")).toBe("ms");
  });

  it("returns s for non-numeric string", () => {
    expect(detectUnit("abc")).toBe("s");
  });
});

// ── parseEpochString ───────────────────────────────────────────────────────────

describe("parseEpochString", () => {
  it("parses a seconds epoch", () => {
    const result = parseEpochString("1700000000");
    expect(result).not.toBeNull();
    expect(result?.unit).toBe("s");
    expect(result?.epochMs).toBe(1700000000000);
  });

  it("parses a milliseconds epoch", () => {
    const result = parseEpochString("1700000000000");
    expect(result).not.toBeNull();
    expect(result?.unit).toBe("ms");
    expect(result?.epochMs).toBe(1700000000000);
  });

  it("returns null for empty string", () => {
    expect(parseEpochString("")).toBeNull();
  });

  it("returns null for non-numeric", () => {
    expect(parseEpochString("hello")).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(parseEpochString("Infinity")).toBeNull();
  });

  it("handles whitespace", () => {
    const result = parseEpochString("  1700000000  ");
    expect(result?.epochMs).toBe(1700000000000);
  });
});

// ── isoWeekNumber ──────────────────────────────────────────────────────────────

describe("isoWeekNumber", () => {
  it("returns week 1 for 2024-01-01 (Mon)", () => {
    // 2024-01-01 is a Monday, so it's in week 1
    const d = new Date(Date.UTC(2024, 0, 1));
    expect(isoWeekNumber(d)).toBe(1);
  });

  it("returns week 52 for 2023-12-31", () => {
    // 2023-12-31 is a Sunday in week 52
    const d = new Date(Date.UTC(2023, 11, 31));
    expect(isoWeekNumber(d)).toBe(52);
  });

  it("returns a value between 1 and 53", () => {
    const d = new Date(Date.UTC(2024, 5, 15));
    const w = isoWeekNumber(d);
    expect(w).toBeGreaterThanOrEqual(1);
    expect(w).toBeLessThanOrEqual(53);
  });
});

// ── dayOfYear ──────────────────────────────────────────────────────────────────

describe("dayOfYear", () => {
  it("Jan 1 is day 1", () => {
    const d = new Date(Date.UTC(2024, 0, 1));
    expect(dayOfYear(d)).toBe(1);
  });

  it("Jan 31 is day 31", () => {
    const d = new Date(Date.UTC(2024, 0, 31));
    expect(dayOfYear(d)).toBe(31);
  });

  it("Dec 31 in non-leap year is day 365", () => {
    const d = new Date(Date.UTC(2023, 11, 31));
    expect(dayOfYear(d)).toBe(365);
  });

  it("Dec 31 in leap year is day 366", () => {
    const d = new Date(Date.UTC(2024, 11, 31));
    expect(dayOfYear(d)).toBe(366);
  });
});

// ── isLeapYear ─────────────────────────────────────────────────────────────────

describe("isLeapYear", () => {
  it("2000 is a leap year", () => {
    expect(isLeapYear(new Date(Date.UTC(2000, 0, 1)))).toBe(true);
  });

  it("1900 is NOT a leap year", () => {
    expect(isLeapYear(new Date(Date.UTC(1900, 0, 1)))).toBe(false);
  });

  it("2024 is a leap year", () => {
    expect(isLeapYear(new Date(Date.UTC(2024, 0, 1)))).toBe(true);
  });

  it("2023 is NOT a leap year", () => {
    expect(isLeapYear(new Date(Date.UTC(2023, 0, 1)))).toBe(false);
  });
});

// ── toRfc2822 ──────────────────────────────────────────────────────────────────

describe("toRfc2822", () => {
  it("formats epoch 0 as Thu, 01 Jan 1970", () => {
    const result = toRfc2822(0);
    expect(result).toContain("Thu");
    expect(result).toContain("Jan");
    expect(result).toContain("1970");
    expect(result).toContain("+0000");
  });

  it("includes seconds", () => {
    const result = toRfc2822(0);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

// ── relativeTime ───────────────────────────────────────────────────────────────

describe("relativeTime", () => {
  const now = 1700000000000;

  it("returns 'just now' for <500ms difference", () => {
    expect(relativeTime(now + 100, now)).toBe("just now");
    expect(relativeTime(now - 100, now)).toBe("just now");
  });

  it("returns seconds ago", () => {
    expect(relativeTime(now - 30_000, now)).toBe("30 seconds ago");
  });

  it("returns minutes ago", () => {
    expect(relativeTime(now - 5 * 60 * 1000, now)).toBe("5 minutes ago");
  });

  it("returns hours ago", () => {
    expect(relativeTime(now - 3 * 60 * 60 * 1000, now)).toBe("3 hours ago");
  });

  it("returns in N hours for future", () => {
    expect(relativeTime(now + 2 * 60 * 60 * 1000, now)).toBe("in 2 hours");
  });

  it("uses singular for 1 unit", () => {
    expect(relativeTime(now - 60 * 1000, now)).toBe("1 minute ago");
  });

  it("handles days", () => {
    expect(relativeTime(now - 3 * 24 * 60 * 60 * 1000, now)).toBe("3 days ago");
  });
});

// ── convertEpoch ───────────────────────────────────────────────────────────────

describe("convertEpoch", () => {
  const epoch0 = 0; // 1970-01-01T00:00:00.000Z
  const now = 1700000000000;

  it("epoch 0 gives correct ISO string", () => {
    const result = convertEpoch(epoch0, "UTC", now);
    expect(result.iso8601).toBe("1970-01-01T00:00:00.000Z");
  });

  it("epochS is epochMs / 1000", () => {
    const ms = 1700000000000;
    const result = convertEpoch(ms, "UTC", now);
    expect(result.epochS).toBe(1700000000);
    expect(result.epochMs).toBe(ms);
  });

  it("rfc3339 equals iso8601", () => {
    const result = convertEpoch(epoch0, "UTC", now);
    expect(result.rfc3339).toBe(result.iso8601);
  });

  it("rfc2822 contains weekday and timezone offset", () => {
    const result = convertEpoch(epoch0, "UTC", now);
    expect(result.rfc2822).toContain("+0000");
    expect(result.rfc2822).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
  });

  it("hex is uppercase hex string starting with 0x", () => {
    const result = convertEpoch(1000, "UTC", now);
    expect(result.unixHex).toBe("0x1");
  });

  it("epoch 0 is Thursday", () => {
    const result = convertEpoch(epoch0, "UTC", now);
    expect(result.dayOfWeek).toBe("Thu");
  });

  it("1970 is not a leap year", () => {
    const result = convertEpoch(epoch0, "UTC", now);
    expect(result.leapYear).toBe(false);
  });

  it("2000-01-01 is a leap year", () => {
    const ms = Date.UTC(2000, 0, 1);
    const result = convertEpoch(ms, "UTC", now);
    expect(result.leapYear).toBe(true);
  });

  it("dayOfYear for Jan 1 is 1", () => {
    const result = convertEpoch(epoch0, "UTC", now);
    expect(result.dayOfYear).toBe(1);
  });

  it("handles invalid tz gracefully", () => {
    const result = convertEpoch(epoch0, "Not/A/Timezone", now);
    expect(result.tzString).toBe("UTC");
  });
});

// ── applyCustomFormat ─────────────────────────────────────────────────────────

describe("applyCustomFormat", () => {
  // epoch 0 = 1970-01-01T00:00:00.000Z
  const d = new Date(0);

  it("replaces YYYY with 4-digit year", () => {
    expect(applyCustomFormat(d, "YYYY", "UTC")).toBe("1970");
  });

  it("replaces MM with zero-padded month", () => {
    expect(applyCustomFormat(d, "MM", "UTC")).toBe("01");
  });

  it("replaces DD with zero-padded day", () => {
    expect(applyCustomFormat(d, "DD", "UTC")).toBe("01");
  });

  it("replaces HH mm ss correctly", () => {
    const result = applyCustomFormat(d, "HH:mm:ss", "UTC");
    expect(result).toBe("00:00:00");
  });

  it("formats YYYY-MM-DD HH:mm:ss", () => {
    expect(applyCustomFormat(d, "YYYY-MM-DD HH:mm:ss", "UTC")).toBe("1970-01-01 00:00:00");
  });

  it("X token gives unix seconds", () => {
    const d2 = new Date(1700000000000);
    expect(applyCustomFormat(d2, "X", "UTC")).toBe("1700000000");
  });

  it("x token gives unix ms", () => {
    const d2 = new Date(1700000000000);
    expect(applyCustomFormat(d2, "x", "UTC")).toBe("1700000000000");
  });

  it("unknown tokens are left as-is", () => {
    expect(applyCustomFormat(d, "YYYY-QQ", "UTC")).toBe("1970-QQ");
  });
});

// ── batchConvert ───────────────────────────────────────────────────────────────

describe("batchConvert", () => {
  it("parses a list of second epochs", () => {
    const result = batchConvert("1700000000\n1710000000");
    expect(result).toHaveLength(2);
    expect(result[0].error).toBeNull();
    expect(result[0].unit).toBe("s");
    expect(result[0].iso8601).not.toBeNull();
  });

  it("parses a ms epoch", () => {
    const result = batchConvert("1700000000000");
    expect(result[0].unit).toBe("ms");
    expect(result[0].epochMs).toBe(1700000000000);
  });

  it("skips blank lines", () => {
    const result = batchConvert("\n1700000000\n\n1710000000\n");
    expect(result).toHaveLength(2);
  });

  it("records error for invalid lines", () => {
    const result = batchConvert("not-a-number");
    expect(result[0].error).not.toBeNull();
    expect(result[0].epochMs).toBeNull();
  });

  it("returns empty array for blank input", () => {
    expect(batchConvert("")).toHaveLength(0);
    expect(batchConvert("   \n  ")).toHaveLength(0);
  });

  it("mixed valid and invalid lines", () => {
    const result = batchConvert("1700000000\nbad\n1710000000");
    expect(result).toHaveLength(3);
    expect(result[0].error).toBeNull();
    expect(result[1].error).not.toBeNull();
    expect(result[2].error).toBeNull();
  });
});

// ── computeDiff ────────────────────────────────────────────────────────────────

describe("computeDiff", () => {
  it("same instant gives totalMs=0 and sign=same", () => {
    const diff = computeDiff(1000, 1000);
    expect(diff.totalMs).toBe(0);
    expect(diff.sign).toBe("same");
  });

  it("sign is future when b > a", () => {
    const diff = computeDiff(0, 1000);
    expect(diff.sign).toBe("future");
  });

  it("sign is past when b < a", () => {
    const diff = computeDiff(1000, 0);
    expect(diff.sign).toBe("past");
  });

  it("exactly 1 day apart", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = computeDiff(0, oneDay);
    expect(diff.totalDays).toBe(1);
    expect(diff.days).toBe(1);
    expect(diff.hours).toBe(0);
    expect(diff.minutes).toBe(0);
  });

  it("exactly 1 year (non-leap)", () => {
    const a = Date.UTC(2023, 0, 1);
    const b = Date.UTC(2024, 0, 1);
    const diff = computeDiff(a, b);
    expect(diff.years).toBe(1);
    expect(diff.months).toBe(0);
    expect(diff.days).toBe(0);
  });

  it("totalHours and totalMinutes are integer multiples", () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const diff = computeDiff(0, twoHours);
    expect(diff.totalHours).toBe(2);
    expect(diff.totalMinutes).toBe(120);
    expect(diff.totalSeconds).toBe(7200);
  });
});

// ── parseDiffInput ─────────────────────────────────────────────────────────────

describe("parseDiffInput", () => {
  it("parses a seconds epoch string", () => {
    expect(parseDiffInput("1700000000")).toBe(1700000000 * 1000);
  });

  it("parses a ms epoch string", () => {
    expect(parseDiffInput("1700000000000")).toBe(1700000000000);
  });

  it("parses ISO date string", () => {
    const result = parseDiffInput("1970-01-01T00:00:00.000Z");
    expect(result).toBe(0);
  });

  it("returns null for empty string", () => {
    expect(parseDiffInput("")).toBeNull();
    expect(parseDiffInput("   ")).toBeNull();
  });

  it("returns null for unparseable string", () => {
    expect(parseDiffInput("not-a-thing")).toBeNull();
  });
});

// ── dateStringToEpoch ─────────────────────────────────────────────────────────

describe("dateStringToEpoch", () => {
  it("parses ISO string", () => {
    const result = dateStringToEpoch("1970-01-01T00:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result?.epochMs).toBe(0);
    expect(result?.epochS).toBe(0);
  });

  it("returns null for empty string", () => {
    expect(dateStringToEpoch("")).toBeNull();
  });

  it("returns null for invalid string", () => {
    expect(dateStringToEpoch("not a date")).toBeNull();
  });

  it("returns iso8601 string", () => {
    const result = dateStringToEpoch("2024-01-15T12:30:00Z");
    expect(result?.iso8601).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── out-of-range epoch guards (TDD for findings #2 and #3) ────────────────────

const JS_MAX_EPOCH_MS = 8.64e15;

describe("convertEpoch — out-of-range guard", () => {
  const now = 1700000000000;

  it("throws for a 16-digit epoch (9999999999999999 ms) that exceeds JS Date range", () => {
    // Before the fix this throws RangeError from toISOString(); after the fix it
    // should throw with a readable message (not a silent swallow).
    // We assert the throw so the store can wrap it into parseError.
    expect(() => convertEpoch(9999999999999999, "UTC", now)).toThrow();
  });

  it("throws for epochMs exactly at JS_MAX_EPOCH_MS + 1", () => {
    expect(() => convertEpoch(JS_MAX_EPOCH_MS + 1, "UTC", now)).toThrow();
  });

  it("does NOT throw for epochMs exactly at JS_MAX_EPOCH_MS", () => {
    expect(() => convertEpoch(JS_MAX_EPOCH_MS, "UTC", now)).not.toThrow();
  });

  it("does NOT throw for a normal epoch (1700000000000)", () => {
    expect(() => convertEpoch(1700000000000, "UTC", now)).not.toThrow();
  });
});

describe("batchConvert — out-of-range rows go to error column, not throw", () => {
  it("16-digit epoch produces error row, not a thrown exception", () => {
    // 9999999999999999 is parsed as a valid integer by parseEpochString (it's finite)
    // but new Date(epochMs).toISOString() throws RangeError before fix.
    let result: ReturnType<typeof batchConvert> | undefined;
    expect(() => {
      result = batchConvert("9999999999999999");
    }).not.toThrow();
    expect(result).toBeDefined();
    expect(result![0].error).not.toBeNull();
    expect(result![0].iso8601).toBeNull();
  });

  it("valid rows are unaffected when mixed with an out-of-range row", () => {
    let result: ReturnType<typeof batchConvert> | undefined;
    expect(() => {
      result = batchConvert("1700000000\n9999999999999999\n1710000000");
    }).not.toThrow();
    expect(result).toBeDefined();
    expect(result![0].error).toBeNull();
    expect(result![1].error).not.toBeNull();
    expect(result![2].error).toBeNull();
  });
});
