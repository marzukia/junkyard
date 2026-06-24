import { z } from "zod";
import type { ToolDef } from "./types.js";

const CRON_MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

interface CronFields {
  minute: string;
  hour: string;
  dom: string;
  month: string;
  dow: string;
}

interface FieldSpec {
  min: number;
  max: number;
  names?: readonly string[];
}

const FIELD_SPECS: Record<keyof CronFields, FieldSpec> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dom: { min: 1, max: 31 },
  month: { min: 1, max: 12, names: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] },
  dow: { min: 0, max: 6, names: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
};

const FIELD_ORDER: (keyof CronFields)[] = ["minute", "hour", "dom", "month", "dow"];

function expandMacro(expr: string): string {
  const key = expr.trim().toLowerCase();
  return CRON_MACROS[key] ?? expr.trim();
}

function normaliseNames(value: string, spec: FieldSpec): string {
  if (!spec.names) return value;
  let v = value;
  for (let i = 0; i < spec.names.length; i++) {
    v = v.replace(new RegExp(spec.names[i], "gi"), String(spec.min + i));
  }
  return v;
}

function validateSinglePart(raw: string, spec: FieldSpec): string | null {
  const part = normaliseNames(raw, spec);
  if (part === "*") return null;
  const stepWild = part.match(/^\*\/(\d+)$/);
  if (stepWild) {
    const step = Number(stepWild[1]);
    if (step < 1) return "Step must be >= 1";
    return null;
  }
  if (part.includes(",")) {
    for (const item of part.split(",")) {
      const e = validateSinglePart(item, spec);
      if (e) return e;
    }
    return null;
  }
  const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
  if (rangeMatch) {
    const lo = Number(rangeMatch[1]);
    const hi = Number(rangeMatch[2]);
    if (lo < spec.min || lo > spec.max) return `${lo} out of range ${spec.min}-${spec.max}`;
    if (hi < spec.min || hi > spec.max) return `${hi} out of range ${spec.min}-${spec.max}`;
    if (lo > hi) return `Range start ${lo} > end ${hi}`;
    if (rangeMatch[3]) {
      const step = Number(rangeMatch[3]);
      if (step < 1) return "Step must be >= 1";
    }
    return null;
  }
  if (/^\d+$/.test(part)) {
    const n = Number(part);
    if (n < spec.min || n > spec.max) return `${n} out of range ${spec.min}-${spec.max}`;
    return null;
  }
  return `Invalid value: ${raw}`;
}

function validateFields(fields: CronFields): string | null {
  for (const f of FIELD_ORDER) {
    const err = validateSinglePart(fields[f], FIELD_SPECS[f]);
    if (err) return `${f}: ${err}`;
  }
  return null;
}

function expandField(raw: string, spec: FieldSpec): number[] {
  const part = normaliseNames(raw, spec);
  if (part === "*") {
    const all: number[] = [];
    for (let i = spec.min; i <= spec.max; i++) all.push(i);
    return all;
  }
  const result = new Set<number>();
  for (const segment of part.split(",")) {
    const stepWild = segment.match(/^\*\/(\d+)$/);
    if (stepWild) {
      const step = Math.max(1, Number(stepWild[1]));
      for (let i = spec.min; i <= spec.max; i += step) result.add(i);
      continue;
    }
    const rangeMatch = segment.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (rangeMatch) {
      const lo = Number(rangeMatch[1]);
      const hi = Number(rangeMatch[2]);
      const step = rangeMatch[3] ? Math.max(1, Number(rangeMatch[3])) : 1;
      for (let i = lo; i <= hi; i += step) result.add(i);
      continue;
    }
    if (/^\d+$/.test(segment)) result.add(Number(segment));
  }
  return [...result].sort((a, b) => a - b);
}

function parseExpression(expr: string): { ok: true; fields: CronFields } | { ok: false; error: string } {
  const expanded = expandMacro(expr);
  const parts = expanded.trim().split(/\s+/);
  if (parts.length !== 5) return { ok: false, error: `Expected 5 fields, got ${parts.length}.` };
  const [minute, hour, dom, month, dow] = parts;
  const fields: CronFields = { minute, hour, dom, month, dow };
  const err = validateFields(fields);
  if (err) return { ok: false, error: err };
  return { ok: true, fields };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function describeHours(hrs: number[]): string {
  if (hrs.length === 24) return "every hour";
  if (hrs.length === 1) return `hour ${hrs[0]}`;
  return `hours ${hrs.join(", ")}`;
}

function describeDows(dows: number[]): string {
  if (dows.length === 7) return "every day of the week";
  if (dows.length === 5 && dows.includes(1) && dows.includes(5) && !dows.includes(0)) return "Monday through Friday";
  if (dows.length === 2 && dows.includes(0) && dows.includes(6)) return "Saturday and Sunday";
  if (dows.length === 1) return DOW_NAMES[dows[0]];
  const names = dows.map((d) => DOW_NAMES[d]);
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function describeCron(fields: CronFields): string {
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

  let timePart: string;
  if (allMins && allHrs) timePart = "every minute";
  else if (allMins) timePart = `every minute of ${describeHours(hrs)}`;
  else if (allHrs) timePart = `at minute ${mins.join(", ")}`;
  else if (mins.length === 1 && hrs.length === 1) {
    const hh = String(hrs[0]).padStart(2, "0");
    const mm = String(mins[0]).padStart(2, "0");
    timePart = `at ${hh}:${mm}`;
  } else {
    timePart = `at minutes ${mins.join(", ")} past ${describeHours(hrs)}`;
  }

  let whenPart = "";
  if (!allDoms || !allDows) {
    if (domWild && !dowWild) whenPart = ` on ${describeDows(dows)}`;
    else if (dowWild && !domWild) whenPart = ` on the ${doms.map(ordinal).join(", ")}`;
    else if (!domWild && !dowWild) whenPart = ` on the ${doms.map(ordinal).join(", ")} or on ${describeDows(dows)}`;
  }

  let monthPart = "";
  if (!allMonths) monthPart = ` in ${months.map((m) => MONTH_NAMES[m - 1]).join(", ")}`;

  const s = `${timePart}${whenPart}${monthPart}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nextRuns(fields: CronFields, count = 5, after?: Date): Date[] {
  const err = validateFields(fields);
  if (err) return [];

  const minutes = expandField(fields.minute, FIELD_SPECS.minute);
  const hours = expandField(fields.hour, FIELD_SPECS.hour);
  const doms = expandField(fields.dom, FIELD_SPECS.dom);
  const months = expandField(fields.month, FIELD_SPECS.month);
  const dows = expandField(fields.dow, FIELD_SPECS.dow);

  const domIsWild = fields.dom === "*";
  const dowIsWild = fields.dow === "*";

  // All field comparisons use UTC getters so that the emitted ISO strings
  // (which are always UTC) correctly match the cron field values regardless
  // of the host's local timezone.
  const start = after ? new Date(after) : new Date();
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  const results: Date[] = [];
  const limit = new Date(start);
  limit.setUTCFullYear(limit.getUTCFullYear() + 4);

  const d = new Date(start);
  d.setUTCSeconds(0, 0);

  while (results.length < count && d < limit) {
    if (!months.includes(d.getUTCMonth() + 1)) {
      d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(d.getUTCMonth() + 1); continue;
    }
    const dayMatch = domIsWild
      ? dows.includes(d.getUTCDay())
      : dowIsWild
        ? doms.includes(d.getUTCDate())
        : doms.includes(d.getUTCDate()) || dows.includes(d.getUTCDay());

    if (!dayMatch) {
      d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); continue;
    }
    if (!hours.includes(d.getUTCHours())) {
      const nextHour = hours.find((h) => h > d.getUTCHours());
      if (nextHour === undefined) { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); }
      else d.setUTCHours(nextHour, 0, 0, 0);
      continue;
    }
    if (!minutes.includes(d.getUTCMinutes())) {
      const nextMin = minutes.find((m) => m > d.getUTCMinutes());
      if (nextMin === undefined) {
        const nextHour = hours.find((h) => h > d.getUTCHours());
        if (nextHour === undefined) { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); }
        else d.setUTCHours(nextHour, 0, 0, 0);
      } else d.setUTCMinutes(nextMin, 0, 0);
      continue;
    }
    results.push(new Date(d));
    d.setUTCMinutes(d.getUTCMinutes() + 1, 0, 0);
  }

  return results;
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const cronTool: ToolDef = {
  slug: "cron",
  name: "Cron Builder",
  ops: [
    {
      name: "describe",
      description: "Describe a cron expression in plain English and return the next scheduled run times",
      inputSchema: z.object({
        expr: z.string(),
        nextCount: z.number().int().min(1).max(20).default(5),
      }),
      run({ expr, nextCount }) {
        const parsed = parseExpression(expr);
        if (!parsed.ok) throw new Error(parsed.error);
        const human = describeCron(parsed.fields);
        const runs = nextRuns(parsed.fields, nextCount).map((d) => d.toISOString());
        return { human, nextRuns: runs };
      },
    },
  ],
};
