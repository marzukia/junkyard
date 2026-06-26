// ── Types ──────────────────────────────────────────────────────────────────────

export type EpochUnit = "s" | "ms";

// ── Custom format tokens ──────────────────────────────────────────────────────

export interface BatchRow {
  raw: string;
  epochMs: number | null;
  unit: EpochUnit | null;
  iso8601: string | null;
  error: string | null;
}

export interface DiffResult {
  totalMs: number;
  sign: "future" | "past" | "same";
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
}

export interface ParsedEpoch {
  epochMs: number;
  unit: EpochUnit;
}

export interface ConversionResult {
  epochS: number;
  epochMs: number;
  iso8601: string;
  rfc2822: string;
  rfc3339: string;
  utcString: string;
  localString: string;
  tzString: string;
  relative: string;
  dayOfWeek: string;
  weekOfYear: number;
  dayOfYear: number;
  leapYear: boolean;
  unixHex: string;
}

export interface DateToEpochResult {
  epochS: number;
  epochMs: number;
  iso8601: string;
}

// ── Epoch detection ────────────────────────────────────────────────────────────

/**
 * Detect whether a numeric string is seconds or milliseconds.
 * Values >= 1e12 are treated as milliseconds (after Jan 9 2001 in ms).
 * Values <  1e12 are treated as seconds   (up to ~year 33658).
 *
 * Heuristic limitation: genuine ms timestamps before 2001 (< 1e12) will be
 * misidentified as seconds and multiplied by 1000. Callers with a known unit
 * should bypass this and set epochMs directly.
 */
export function detectUnit(raw: string): EpochUnit {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return "s";
  return Math.abs(n) >= 1e12 ? "ms" : "s";
}

/**
 * Parse a raw string as an epoch value and return { epochMs, unit }.
 * Returns null if the input is not a finite number.
 */
export function parseEpochString(raw: string): ParsedEpoch | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  const unit = detectUnit(trimmed);
  const epochMs = unit === "ms" ? n : n * 1000;
  return { epochMs, unit };
}

// ── Week / day-of-year helpers ─────────────────────────────────────────────────

/** ISO 8601 week number (Mon = day 1). */
export function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in the current week decides the year
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0, Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 3);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/** Day of year (1-based). */
export function dayOfYear(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/** True if the UTC year of d is a leap year. */
export function isLeapYear(d: Date): boolean {
  const y = d.getUTCFullYear();
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// ── RFC 2822 formatter ─────────────────────────────────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build an RFC 2822 date string from a UTC epoch (ms). */
export function toRfc2822(epochMs: number): string {
  const d = new Date(epochMs);
  const day = DAYS_SHORT[d.getUTCDay()];
  const date = pad2(d.getUTCDate());
  const month = MONTHS_SHORT[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `${day}, ${date} ${month} ${year} ${hh}:${mm}:${ss} +0000`;
}

// ── Relative time ──────────────────────────────────────────────────────────────

/** Human-readable relative string, e.g. "3 hours ago", "in 2 days". */
export function relativeTime(epochMs: number, nowMs: number): string {
  const diffMs = epochMs - nowMs;
  const absDiff = Math.abs(diffMs);
  const past = diffMs < 0;

  const units: [string, number][] = [
    ["year", 365.25 * 24 * 60 * 60 * 1000],
    ["month", 30.44 * 24 * 60 * 60 * 1000],
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
    ["second", 1000],
  ];

  if (absDiff < 500) return "just now";

  for (const [label, ms] of units) {
    const val = Math.floor(absDiff / ms);
    if (val >= 1) {
      const plural = val === 1 ? label : `${label}s`;
      return past ? `${val} ${plural} ago` : `in ${val} ${plural}`;
    }
  }

  return "just now";
}

// ── Full conversion ────────────────────────────────────────────────────────────

/**
 * Convert an epoch (ms) to all display formats.
 * tz: a valid IANA timezone string (e.g. "America/New_York") or "" for UTC.
 */
export function convertEpoch(epochMs: number, tz: string, nowMs: number): ConversionResult {
  if (
    !Number.isFinite(epochMs) ||
    isNaN(new Date(epochMs).getTime()) ||
    Math.abs(epochMs) > 8.64e15
  ) {
    throw new Error(`Cannot parse timestamp: out-of-range epoch ${epochMs}`);
  }
  const d = new Date(epochMs);
  const epochS = epochMs / 1000;

  const iso8601 = d.toISOString(); // always UTC, ends in Z
  const rfc3339 = iso8601; // RFC 3339 is a profile of ISO 8601

  const utcString = d.toUTCString();
  const rfc2822 = toRfc2822(epochMs);

  // tz-aware local string
  const effectiveTz = tz || "UTC";
  let localString: string;
  let tzString: string;
  try {
    localString = d.toLocaleString("en-US", {
      timeZone: effectiveTz,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    tzString = effectiveTz;
  } catch {
    localString = d.toLocaleString("en-US");
    tzString = "UTC";
  }

  return {
    epochS,
    epochMs,
    iso8601,
    rfc2822,
    rfc3339,
    utcString,
    localString,
    tzString,
    relative: relativeTime(epochMs, nowMs),
    dayOfWeek: DAYS_SHORT[d.getUTCDay()],
    weekOfYear: isoWeekNumber(d),
    dayOfYear: dayOfYear(d),
    leapYear: isLeapYear(d),
    unixHex: `0x${Math.floor(epochS).toString(16).toUpperCase()}`,
  };
}

// ── Date string to epoch ───────────────────────────────────────────────────────

/**
 * Parse a human-readable date string and return epoch in s and ms.
 * Returns null if the string cannot be parsed to a valid date.
 */
export function dateStringToEpoch(raw: string): DateToEpochResult | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  const epochMs = d.getTime();
  const epochS = epochMs / 1000;
  return {
    epochS,
    epochMs,
    iso8601: d.toISOString(),
  };
}

// ── IANA timezone list (common subset) ────────────────────────────────────────

export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Honolulu",
] as const;

export type CommonTimezone = (typeof COMMON_TIMEZONES)[number];

// ── Custom format string ───────────────────────────────────────────────────────

/**
 * Format a Date using simple token substitution.
 * Supported tokens: YYYY MM DD HH mm ss SSS ddd DDD Z
 * Returns a string with all tokens replaced.
 */
export function applyCustomFormat(d: Date, fmt: string, tz: string): string {
  const effectiveTz = tz || "UTC";

  const getComponents = (): Record<string, string> => {
    try {
      const opts: Intl.DateTimeFormatOptions = {
        timeZone: effectiveTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        fractionalSecondDigits: 3,
      };
      const parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(d);
      const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";

      const yearStr = get("year");
      const monthStr = get("month");
      const dayStr = get("day");
      let hourStr = get("hour");
      // Intl hour12:false can return "24" instead of "00"
      if (hourStr === "24") hourStr = "00";
      const minuteStr = get("minute");
      const secondStr = get("second");
      const fracStr = get("fractionalSecond").padStart(3, "0");

      // Day of week abbreviated
      const dowStr = new Intl.DateTimeFormat("en-US", {
        timeZone: effectiveTz,
        weekday: "short",
      }).format(d);

      // Day of week full
      const dowFullStr = new Intl.DateTimeFormat("en-US", {
        timeZone: effectiveTz,
        weekday: "long",
      }).format(d);

      // Month abbreviated
      const monAbbrStr = new Intl.DateTimeFormat("en-US", {
        timeZone: effectiveTz,
        month: "short",
      }).format(d);

      // Month full
      const monFullStr = new Intl.DateTimeFormat("en-US", {
        timeZone: effectiveTz,
        month: "long",
      }).format(d);

      // Timezone offset string like +05:30
      const tzOffset = (() => {
        try {
          const utcDate = new Date(d.getTime());
          // Get the offset by comparing local parts vs UTC
          const localParts = new Intl.DateTimeFormat("en-US", {
            timeZone: effectiveTz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(utcDate);
          const lGet = (t: Intl.DateTimeFormatPartTypes) =>
            localParts.find((p) => p.type === t)?.value ?? "0";
          const localYear = Number(lGet("year"));
          const localMonth = Number(lGet("month")) - 1;
          const localDay = Number(lGet("day"));
          let localHour = Number(lGet("hour"));
          if (localHour === 24) localHour = 0;
          const localMin = Number(lGet("minute"));
          const localMs = Date.UTC(localYear, localMonth, localDay, localHour, localMin);
          const offsetMin = Math.round((localMs - utcDate.getTime()) / 60000);
          const sign = offsetMin >= 0 ? "+" : "-";
          const absMin = Math.abs(offsetMin);
          const oh = String(Math.floor(absMin / 60)).padStart(2, "0");
          const om = String(absMin % 60).padStart(2, "0");
          return `${sign}${oh}:${om}`;
        } catch {
          return "+00:00";
        }
      })();

      return {
        YYYY: yearStr,
        YY: yearStr.slice(-2),
        MM: monthStr,
        DD: dayStr,
        HH: hourStr,
        mm: minuteStr,
        ss: secondStr,
        SSS: fracStr,
        ddd: dowStr,
        dddd: dowFullStr,
        MMM: monAbbrStr,
        MMMM: monFullStr,
        Z: tzOffset,
        X: String(Math.floor(d.getTime() / 1000)),
        x: String(d.getTime()),
      };
    } catch {
      return {};
    }
  };

  const components = getComponents();
  // Replace longest tokens first to avoid partial matches
  const tokenOrder = [
    "YYYY",
    "MMMM",
    "MMM",
    "MM",
    "dddd",
    "ddd",
    "DD",
    "HH",
    "mm",
    "ss",
    "SSS",
    "YY",
    "X",
    "x",
    "Z",
  ];

  let result = fmt;
  for (const token of tokenOrder) {
    if (token in components) {
      result = result.split(token).join(components[token]);
    }
  }
  return result;
}

// Examples to show in the custom format UI
export const FORMAT_EXAMPLES: Array<{ label: string; fmt: string }> = [
  { label: "ISO-like", fmt: "YYYY-MM-DD HH:mm:ss" },
  { label: "US date", fmt: "MM/DD/YYYY HH:mm" },
  { label: "EU date", fmt: "DD/MM/YYYY HH:mm" },
  { label: "Human", fmt: "ddd, DD MMM YYYY HH:mm:ss Z" },
  { label: "File-safe", fmt: "YYYY-MM-DD_HH-mm-ss" },
  { label: "Unix sec", fmt: "X" },
  { label: "Unix ms", fmt: "x" },
];

// ── Batch conversion ───────────────────────────────────────────────────────────

/**
 * Parse a block of text containing multiple timestamps (one per line).
 * Each line is trimmed and blank lines are skipped.
 * Returns an array of BatchRow results.
 */
export function batchConvert(raw: string): BatchRow[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parsed = parseEpochString(line);
      if (!parsed) {
        return {
          raw: line,
          epochMs: null,
          unit: null,
          iso8601: null,
          error: "Not a valid epoch number",
        };
      }
      try {
        return {
          raw: line,
          epochMs: parsed.epochMs,
          unit: parsed.unit,
          iso8601: new Date(parsed.epochMs).toISOString(),
          error: null,
        };
      } catch {
        return {
          raw: line,
          epochMs: null,
          unit: null,
          iso8601: null,
          error: "Timestamp out of range",
        };
      }
    });
}

// ── Date diff / duration calculator ───────────────────────────────────────────

/**
 * Compute the absolute difference between two epoch values (in ms).
 * Decomposes into years/months/days/hours/minutes/seconds.
 * Uses calendar arithmetic for years and months.
 */
export function computeDiff(aMs: number, bMs: number): DiffResult {
  const totalMs = Math.abs(bMs - aMs);
  const sign: DiffResult["sign"] = bMs > aMs ? "future" : bMs < aMs ? "past" : "same";

  // Calendar decomposition (approximate months as 30 days is wrong; use Date arithmetic)
  const startMs = Math.min(aMs, bMs);
  const endMs = Math.max(aMs, bMs);

  const start = new Date(startMs);
  const end = new Date(endMs);

  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();
  let hours = end.getUTCHours() - start.getUTCHours();
  let minutes = end.getUTCMinutes() - start.getUTCMinutes();
  let seconds = end.getUTCSeconds() - start.getUTCSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    // Move back a month and add that month's days
    months -= 1;
    const prevMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
    days += prevMonth.getUTCDate();
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const totalDays = Math.floor(totalMs / (24 * 60 * 60 * 1000));
  const totalHours = Math.floor(totalMs / (60 * 60 * 1000));
  const totalMinutes = Math.floor(totalMs / (60 * 1000));
  const totalSeconds = Math.floor(totalMs / 1000);

  return {
    totalMs,
    sign,
    years,
    months,
    days,
    hours,
    minutes,
    seconds,
    totalDays,
    totalHours,
    totalMinutes,
    totalSeconds,
  };
}

/**
 * Parse a diff input: accepts epoch numbers OR date strings.
 * Returns epochMs or null on failure.
 */
export function parseDiffInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Try as epoch number first
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && /^-?\d+$/.test(trimmed)) {
    const parsed = parseEpochString(trimmed);
    return parsed ? parsed.epochMs : null;
  }
  // Try as date string
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d.getTime();
  return null;
}
