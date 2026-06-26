/**
 * Pure cron expression parser, descriptor and next-run calculator.
 * Supports standard 5-field unix cron (minute hour dom month dow),
 * @-macros (@daily, @hourly, etc.), and 6-field Quartz-style detection.
 * No external dependencies, runs entirely in the browser.
 *
 * The field-grammar (CRON_MACROS, FIELD_SPECS, FIELD_ORDER, normaliseNames,
 * validateSinglePart, expandField) is canonical in kit/lib/cronGrammar.ts and
 * vendored here via `node scripts/vendor-cron-grammar.mjs`. Do not edit the
 * grammar inline — edit the canonical and re-vendor.
 */

// ─── Re-export grammar primitives ─────────────────────────────────────────────

export {
  CRON_MACROS,
  FIELD_SPECS,
  FIELD_ORDER,
  normaliseNames,
  validateSinglePart,
  expandField,
} from "@junkyardsh/ui";
export type { CronFields, FieldSpec } from "@junkyardsh/ui";

import {
  CRON_MACROS,
  FIELD_ORDER,
  FIELD_SPECS,
  expandField,
  validateSinglePart,
} from "@junkyardsh/ui";
import type { CronFields, FieldSpec } from "@junkyardsh/ui";

// ─── @-macro expansion ────────────────────────────────────────────────────────

/**
 * If the expression is a known @-macro, return its 5-field equivalent.
 * Otherwise return the expression unchanged.
 */
export function expandMacro(expr: string): { expanded: string; wasMacro: boolean } {
  const key = expr.trim().toLowerCase();
  const expanded = CRON_MACROS[key];
  if (expanded) return { expanded, wasMacro: true };
  return { expanded: expr.trim(), wasMacro: false };
}

/**
 * Returns a human label for a @-macro (e.g. "@daily" -> "@daily (0 0 * * *)").
 * Returns null if the expression is not a macro.
 */
export function macroLabel(expr: string): string | null {
  const key = expr.trim().toLowerCase();
  const expanded = CRON_MACROS[key];
  if (!expanded) return null;
  return `${key} (${expanded})`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParseResult {
  ok: boolean;
  fields: CronFields;
  error?: string;
}

// ─── Field metadata helpers ────────────────────────────────────────────────────

const FIELD_LABELS: Record<keyof CronFields, string> = {
  minute: "Minute",
  hour: "Hour",
  dom: "Day of month",
  month: "Month",
  dow: "Day of week",
};

export function fieldLabel(f: keyof CronFields): string {
  return FIELD_LABELS[f];
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export interface Preset {
  label: string;
  expression: string;
  description: string;
}

export const PRESETS: Preset[] = [
  { label: "Every minute", expression: "* * * * *", description: "At every minute" },
  { label: "Hourly", expression: "0 * * * *", description: "At minute 0 (every hour)" },
  { label: "Daily midnight", expression: "0 0 * * *", description: "At 00:00 every day" },
  { label: "Daily noon", expression: "0 12 * * *", description: "At 12:00 every day" },
  { label: "Weekly (Mon)", expression: "0 9 * * 1", description: "At 09:00 on every Monday" },
  {
    label: "Monthly 1st",
    expression: "0 0 1 * *",
    description: "At 00:00 on the 1st of every month",
  },
  {
    label: "Weekdays 9am",
    expression: "0 9 * * 1-5",
    description: "At 09:00 on Monday through Friday",
  },
  { label: "Every 5 min", expression: "*/5 * * * *", description: "At every 5th minute" },
  { label: "Every 15 min", expression: "*/15 * * * *", description: "At every 15th minute" },
  { label: "Every 30 min", expression: "*/30 * * * *", description: "At every 30th minute" },
  { label: "Twice daily", expression: "0 8,20 * * *", description: "At 08:00 and 20:00 every day" },
  {
    label: "Every hour (biz)",
    expression: "0 9-17 * * 1-5",
    description: "At minute 0, from 09:00 to 17:00, on Mon through Fri",
  },
  { label: "@hourly", expression: "@hourly", description: "Macro: at minute 0 of every hour" },
  { label: "@daily", expression: "@daily", description: "Macro: at 00:00 every day" },
  { label: "@weekly", expression: "@weekly", description: "Macro: at 00:00 on Sunday" },
  { label: "@monthly", expression: "@monthly", description: "Macro: at 00:00 on the 1st" },
];

// ─── Parse ─────────────────────────────────────────────────────────────────────

/** Split a raw expression string into 5 fields. Returns null on malformed input. */
export function splitExpression(expr: string): string[] | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return parts;
}

/**
 * Detect if a raw expression looks like a 6-field Quartz expression (seconds prefix).
 * Heuristic: 6 whitespace-separated tokens, and the first is a plausible seconds value.
 */
export function isQuartzSixField(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 6) return false;
  // First field would be seconds (0-59 range or * or */n)
  const sec = parts[0];
  return sec === "*" || /^\d+$/.test(sec) || /^\*\/\d+$/.test(sec) || /^\d+-\d+$/.test(sec);
}

export function expressionToFields(expr: string): ParseResult {
  const trimmed = expr.trim();

  // Handle @-macros first
  const { expanded, wasMacro } = expandMacro(trimmed);
  if (wasMacro) {
    // Parse the expanded 5-field form
    const parts = splitExpression(expanded);
    if (!parts) {
      return {
        ok: false,
        fields: { minute: "*", hour: "*", dom: "*", month: "*", dow: "*" },
        error: "Internal error expanding macro",
      };
    }
    const [minute, hour, dom, month, dow] = parts;
    const fields: CronFields = { minute, hour, dom, month, dow };
    return { ok: true, fields };
  }

  const parts = splitExpression(trimmed);
  if (!parts) {
    // Distinguish 6-field Quartz from other malformed input
    if (isQuartzSixField(trimmed)) {
      return {
        ok: false,
        fields: { minute: "*", hour: "*", dom: "*", month: "*", dow: "*" },
        error:
          "This looks like a 6-field Quartz expression (seconds prefix). Drop the first field to convert to standard 5-field cron.",
      };
    }
    // Check for @reboot
    if (trimmed.toLowerCase() === "@reboot") {
      return {
        ok: false,
        fields: { minute: "*", hour: "*", dom: "*", month: "*", dow: "*" },
        error:
          "@reboot runs once at system boot -- there are no scheduled future times to preview.",
      };
    }
    // Offer macro hint if it starts with @
    if (trimmed.startsWith("@")) {
      const knownMacros = Object.keys(CRON_MACROS).join(", ");
      return {
        ok: false,
        fields: { minute: "*", hour: "*", dom: "*", month: "*", dow: "*" },
        error: `Unknown macro "${trimmed}". Supported: ${knownMacros}, @reboot.`,
      };
    }
    return {
      ok: false,
      fields: { minute: "*", hour: "*", dom: "*", month: "*", dow: "*" },
      error: `Expression must have exactly 5 fields (minute hour dom month dow). Got ${trimmed.split(/\s+/).filter(Boolean).length}.`,
    };
  }
  const [minute, hour, dom, month, dow] = parts;
  const fields: CronFields = { minute, hour, dom, month, dow };
  const err = validateFields(fields);
  if (err) return { ok: false, fields, error: err };
  return { ok: true, fields };
}

export function fieldsToExpression(f: CronFields): string {
  return `${f.minute} ${f.hour} ${f.dom} ${f.month} ${f.dow}`;
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export function validateField(field: keyof CronFields, value: string): string | null {
  const spec = FIELD_SPECS[field];
  return validateSinglePart(value, spec);
}

export function validateFields(fields: CronFields): string | null {
  for (const f of FIELD_ORDER) {
    const err = validateField(f, fields[f]);
    if (err) return `${fieldLabel(f)}: ${err}`;
  }
  return null;
}

// ─── Expand a field to a sorted set of matching values ────────────────────────

function describeRaw(raw: string, spec: FieldSpec): string {
  const values = expandField(raw, spec);
  return values.join(", ");
}

// ─── Next N run times ─────────────────────────────────────────────────────────

/**
 * Read wall-clock parts (month 1-12, date 1-31, day 0-6, hour 0-23, minute
 * 0-59) of a Date in the given IANA timezone.  When `tz` is falsy or "local"
 * the browser's local zone is used (same as the old getHours()/getDay() path).
 */
function wallParts(
  d: Date,
  tz?: string
): { month: number; date: number; day: number; hour: number; minute: number } {
  if (!tz || tz === "local") {
    return {
      month: d.getMonth() + 1,
      date: d.getDate(),
      day: d.getDay(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  }
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    month: Number(parts.month),
    date: Number(parts.day),
    day: DOW_SHORT.indexOf(parts.weekday),
    // hour12:false can return "24" for midnight in some environments
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/**
 * Compute the next `count` scheduled times after `after` (default: now).
 * Returns an array of Date objects (UTC instants).
 * Aborts after 4 years of searching to prevent infinite loops (unreachable schedule).
 *
 * When `timezone` is provided (IANA name or "local"), the cron fields are
 * evaluated against wall-clock time in that zone, so `0 0 * * *` means
 * midnight in the chosen zone — not the browser's local zone.
 *
 * "local" and omitted both fall back to the browser's local getters.
 */
export function nextRuns(fields: CronFields, count = 5, after?: Date, timezone?: string): Date[] {
  const err = validateFields(fields);
  if (err) return [];

  const minutes = expandField(fields.minute, FIELD_SPECS.minute);
  const hours = expandField(fields.hour, FIELD_SPECS.hour);
  const doms = expandField(fields.dom, FIELD_SPECS.dom);
  const months = expandField(fields.month, FIELD_SPECS.month);
  const dows = expandField(fields.dow, FIELD_SPECS.dow);

  const domIsWild = fields.dom === "*";
  const dowIsWild = fields.dow === "*";

  // Advance 1 minute past the anchor so "after" is exclusive; keep in UTC ms.
  const startMs = ((after ?? new Date()).getTime() / 60_000 + 1) * 60_000;

  const results: Date[] = [];
  const limitMs = startMs + 4 * 365.25 * 24 * 60 * 60 * 1_000;

  let ms = startMs;

  while (results.length < count && ms < limitMs) {
    const d = new Date(ms);
    const p = wallParts(d, timezone);

    // Advance month
    if (!months.includes(p.month)) {
      // Jump to 00:00 on the 1st of next month in the target zone.
      // We over-approximate by advancing 28 days; the month check will
      // skip ahead again if needed (safe because months repeat at most yearly).
      ms += 24 * 60 * 60 * 1_000; // advance one day at a time until month matches
      continue;
    }

    // Advance day
    const dayMatch = domIsWild
      ? dows.includes(p.day)
      : dowIsWild
        ? doms.includes(p.date)
        : doms.includes(p.date) || dows.includes(p.day);

    if (!dayMatch) {
      ms += 60 * 1_000; // advance one minute; the hour/minute checks below will fast-path
      // Fast-path: skip to start of next calendar day in the target zone by
      // advancing to the next hour-00 minute-00 in that zone.
      ms = _skipToNextDay(ms, timezone);
      continue;
    }

    // Advance hour
    if (!hours.includes(p.hour)) {
      const nextHour = hours.find((h) => h > p.hour);
      if (nextHour === undefined) {
        ms = _skipToNextDay(ms, timezone);
      } else {
        ms = _skipToHour(ms, nextHour, timezone);
      }
      continue;
    }

    // Advance minute
    if (!minutes.includes(p.minute)) {
      const nextMin = minutes.find((m) => m > p.minute);
      if (nextMin === undefined) {
        const nextHour = hours.find((h) => h > p.hour);
        if (nextHour === undefined) {
          ms = _skipToNextDay(ms, timezone);
        } else {
          ms = _skipToHour(ms, nextHour, timezone);
        }
      } else {
        ms += (nextMin - p.minute) * 60_000;
      }
      continue;
    }

    // Matches — record this UTC instant
    results.push(new Date(ms));
    ms += 60_000;
  }

  return results;
}

/**
 * Advance `ms` to the first UTC ms whose wall-clock minute is 0 for
 * the next hour boundary (or more) in the target timezone.
 * We iterate by minute until we find h:00 with h > current hour, or day rolls.
 * This handles DST gaps cleanly because we never fabricate offsets.
 */
function _skipToHour(ms: number, targetHour: number, tz?: string): number {
  // Advance minute-by-minute until wall hour == targetHour and wall minute == 0
  // Cap at 25 hours to avoid infinite loops during DST transitions.
  const cap = ms + 25 * 60 * 60_000;
  let cur = ms + 60_000; // at least 1 minute forward
  while (cur < cap) {
    const p = wallParts(new Date(cur), tz);
    if (p.hour === targetHour && p.minute === 0) return cur;
    if (p.hour > targetHour) return cur; // overshot (e.g. DST gap), caller retries
    cur += 60_000;
  }
  return cur;
}

/**
 * Advance `ms` to 00:00 of the next calendar day in the target timezone.
 */
function _skipToNextDay(ms: number, tz?: string): number {
  const cap = ms + 25 * 60 * 60_000;
  let cur = ms + 60_000;
  let prevDay = wallParts(new Date(ms), tz).date;
  while (cur < cap) {
    const p = wallParts(new Date(cur), tz);
    if (p.date !== prevDay && p.hour === 0 && p.minute === 0) return cur;
    if (p.date !== prevDay) {
      // Day changed but not at midnight yet — advance to midnight
      prevDay = p.date;
    }
    cur += 60_000;
  }
  return cur;
}

// ─── Human-readable description ───────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function describeCron(fields: CronFields): string {
  const err = validateFields(fields);
  if (err) return `Invalid expression: ${err}`;

  const mins = expandField(fields.minute, FIELD_SPECS.minute);
  const hrs = expandField(fields.hour, FIELD_SPECS.hour);
  const doms = expandField(fields.dom, FIELD_SPECS.dom);
  const months = expandField(fields.month, FIELD_SPECS.month);
  const dows = expandField(fields.dow, FIELD_SPECS.dow);

  const allMins = mins.length === 60;
  const allHrs = hrs.length === 24;
  const allDoms = doms.length === 31;
  const allMonths = months.length === 12;
  const allDows = dows.length === 7;
  const domWild = fields.dom === "*";
  const dowWild = fields.dow === "*";

  // Build time phrase
  let timePart: string;
  if (allMins && allHrs) {
    timePart = "every minute";
  } else if (allMins) {
    timePart = `every minute of ${describeHours(hrs)}`;
  } else if (allHrs) {
    timePart = `at minute ${mins.join(", ")}`;
  } else {
    timePart = describeClock(mins, hrs);
  }

  // Build day/month phrase
  let whenPart = "";
  if (!allDoms || !allDows) {
    if (domWild && !dowWild) {
      whenPart = ` on ${describeDows(dows)}`;
    } else if (dowWild && !domWild) {
      whenPart = ` on the ${doms.map(ordinal).join(", ")}`;
    } else if (!domWild && !dowWild) {
      whenPart = ` on the ${doms.map(ordinal).join(", ")} or on ${describeDows(dows)}`;
    }
  }

  let monthPart = "";
  if (!allMonths) {
    monthPart = ` in ${months.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
  }

  return capitalise(`${timePart}${whenPart}${monthPart}`);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function describeHours(hrs: number[]): string {
  if (hrs.length === 24) return "every hour";
  if (hrs.length === 1) return `hour ${hrs[0]}`;
  return `hours ${hrs.join(", ")}`;
}

function describeDows(dows: number[]): string {
  if (dows.length === 7) return "every day of the week";
  if (dows.length === 5 && [1, 2, 3, 4, 5].every((d) => dows.includes(d))) {
    return "Monday through Friday";
  }
  if (dows.length === 2 && dows.includes(0) && dows.includes(6)) {
    return "Saturday and Sunday";
  }
  if (dows.length === 1) return DOW_NAMES[dows[0]];
  const names = dows.map((d) => DOW_NAMES[d]);
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function describeClock(mins: number[], hrs: number[]): string {
  if (mins.length === 1 && hrs.length === 1) {
    const hh = String(hrs[0]).padStart(2, "0");
    const mm = String(mins[0]).padStart(2, "0");
    return `at ${hh}:${mm}`;
  }
  if (mins.length === 1) {
    return `at minute ${mins[0]} past ${describeHours(hrs)}`;
  }
  return `at minutes ${mins.join(", ")} past ${describeHours(hrs)}`;
}

// ─── Resolve the actual IANA timezone for display ─────────────────────────────

/**
 * Return the IANA timezone identifier for the browser's local timezone.
 * Falls back to "local" if the API is unavailable.
 */
export function getLocalIanaTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "local";
  }
}

/**
 * Given a timezone value from TZ_OPTIONS (including "local"), return the
 * display label including the resolved IANA id so the user knows exactly
 * which timezone they are looking at.
 */
export function resolveTzLabel(value: string, options: TzOption[]): string {
  if (value === "local") {
    const iana = getLocalIanaTz();
    return `Local (${iana})`;
  }
  const opt = options.find((o) => o.value === value);
  return opt ? opt.label : value;
}

// ─── Timezone list ────────────────────────────────────────────────────────────

export interface TzOption {
  value: string; // IANA tz identifier
  label: string;
}

export const TZ_OPTIONS: TzOption[] = [
  { value: "local", label: "Local time" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Denver", label: "US Mountain" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "America/Sao_Paulo", label: "Sao Paulo" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris / Berlin" },
  { value: "Europe/Helsinki", label: "Helsinki / Kyiv" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India" },
  { value: "Asia/Bangkok", label: "Bangkok" },
  { value: "Asia/Shanghai", label: "China" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

// ─── Format a Date for display ────────────────────────────────────────────────

export function formatRunTime(d: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  if (timezone && timezone !== "local") {
    opts.timeZone = timezone;
  }
  return d.toLocaleString("en-US", opts);
}

// re-export for convenience
export { describeRaw };
