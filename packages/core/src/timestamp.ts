import { z } from "zod";
import type { ToolDef } from "./types.js";

export interface ConversionResult {
  epochS: number;
  epochMs: number;
  iso8601: string;
  rfc2822: string;
  utcString: string;
  relative: string;
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function toRfc2822(epochMs: number): string {
  const d = new Date(epochMs);
  return `${DAYS_SHORT[d.getUTCDay()]}, ${pad2(d.getUTCDate())} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} +0000`;
}

function relativeTime(epochMs: number, nowMs: number): string {
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

export function convertTimestamp(input: string | number, nowMs?: number): ConversionResult {
  let epochMs: number;
  if (typeof input === "number") {
    epochMs = Math.abs(input) >= 1e12 ? input : input * 1000;
  } else {
    const trimmed = input.trim();
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && /^-?\d+$/.test(trimmed)) {
      epochMs = Math.abs(asNum) >= 1e12 ? asNum : asNum * 1000;
    } else {
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) throw new Error(`Cannot parse timestamp: ${input}`);
      epochMs = d.getTime();
    }
  }
  const d = new Date(epochMs);
  return {
    epochS: epochMs / 1000,
    epochMs,
    iso8601: d.toISOString(),
    rfc2822: toRfc2822(epochMs),
    utcString: d.toUTCString(),
    relative: relativeTime(epochMs, nowMs ?? Date.now()),
  };
}

export function nowTimestamp(): ConversionResult {
  return convertTimestamp(Date.now());
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const timestampTool: ToolDef = {
  slug: "timestamp",
  name: "Timestamp",
  ops: [
    {
      name: "convert",
      description: "Convert a Unix epoch (seconds or ms) or date string to multiple formats",
      inputSchema: z.object({
        input: z.union([z.string(), z.number()]),
      }),
      run({ input }) {
        return convertTimestamp(input);
      },
    },
    {
      name: "now",
      description: "Return the current time in multiple timestamp formats",
      inputSchema: z.object({}),
      run() {
        return nowTimestamp();
      },
    },
  ],
};
