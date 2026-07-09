/**
 * Canonical cron field-grammar — shared between packages/core and apps/cron.
 *
 * WHAT IS HERE (pure, no Date):
 *   CRON_MACROS, FIELD_SPECS, FIELD_ORDER, expandMacro, normaliseNames,
 *   validateSinglePart, expandField
 *
 * WHAT IS NOT HERE (legitimately per-side):
 *   validateFields — both sides call validateSinglePart from a loop, but wrap
 *     the error prefix differently: core uses the raw field name ("minute: …"),
 *     apps/cron uses the human label ("Minute: …"). Keeping per-side avoids
 *     a UI-facing string change.
 *   nextRuns — core uses UTC date getters; apps/cron uses LOCAL date getters.
 *   describeCron / describeDows / etc — apps/cron builds a richer multi-helper
 *     version; core inlines simpler equivalents. Sharing would couple the two
 *     callers' return-shape wrappers. Left per-side.
 *   ParseResult / the {ok,error} wrapper shape — per-caller concern.
 *   App-only extras: presets, timezone helpers, macroLabel, fieldLabel,
 *     splitExpression, isQuartzSixField, expressionToFields, fieldsToExpression,
 *     formatRunTime.
 *
 * SYNC NOTE:
 *   packages/core/src/cron.ts keeps its own copy of these grammar functions
 *   (tagged with "// SYNC: cronGrammar" inline comments) so core remains a
 *   standalone package with zero kit dependency. When this file changes,
 *   reconcile core manually and re-run `node scripts/vendor-cron-grammar.mjs`
 *   to push the vendored copy to apps/cron/src/lib/cronGrammar.ts.
 *   The CI step "Check vendored cronGrammar.ts copies are up to date" guards drift.
 */

// ─── @-macro table ────────────────────────────────────────────────────────────

/**
 * Map of cron @-macros to their 5-field equivalents.
 * @reboot is intentionally excluded -- it has no meaningful next-run preview.
 */
export const CRON_MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CronFields {
  minute: string;
  hour: string;
  dom: string; // day of month
  month: string;
  dow: string; // day of week
}

export interface FieldSpec {
  min: number;
  max: number;
  names?: readonly string[]; // Jan..Dec, Sun..Sat
}

// ─── Field metadata ───────────────────────────────────────────────────────────

export const FIELD_SPECS: Record<keyof CronFields, FieldSpec> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dom: { min: 1, max: 31 },
  month: {
    min: 1,
    max: 12,
    names: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  dow: { min: 0, max: 6, names: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
};

export const FIELD_ORDER: (keyof CronFields)[] = ["minute", "hour", "dom", "month", "dow"];

// ─── Macro expansion ──────────────────────────────────────────────────────────

/**
 * If the expression is a known @-macro, return its 5-field equivalent.
 * Otherwise return the trimmed expression unchanged.
 *
 * NOTE: apps/cron wraps its own expandMacro around CRON_MACROS to also return
 * a wasMacro flag for its richer parse path; that wrapper imports CRON_MACROS
 * from this file. This plain-string form is used by packages/core internally.
 */
export function expandMacro(expr: string): string {
  const key = expr.trim().toLowerCase();
  return CRON_MACROS[key] ?? expr.trim();
}

// ─── Name normalisation ───────────────────────────────────────────────────────

/** Replace symbolic month/dow names (case-insensitive) with their numeric equivalents. */
export function normaliseNames(value: string, spec: FieldSpec): string {
  if (!spec.names) return value;
  let v = value;
  for (let i = 0; i < spec.names.length; i++) {
    v = v.replace(new RegExp(spec.names[i], "gi"), String(spec.min + i));
  }
  return v;
}

// ─── Single-part validation ───────────────────────────────────────────────────

/**
 * Validate one comma-free part of a field value. Returns null on success or
 * an error message on failure.
 *
 * Supported forms:
 *   *          wildcard
 *   * /n       step wildcard (n >= 1, n <= range width)
 *   lo-hi      range
 *   lo-hi/n    range with step
 *   N/n        Vixie-cron start/step (e.g. 0/15 → 0,15,30,45)
 *   N          plain integer
 */
export function validateSinglePart(raw: string, spec: FieldSpec): string | null {
  const part = normaliseNames(raw, spec);
  // * wildcard
  if (part === "*") return null;
  // */n step wildcard
  const stepWild = part.match(/^\*\/(\d+)$/);
  if (stepWild) {
    const step = Number(stepWild[1]);
    if (step < 1) return "Step must be >= 1";
    if (step > spec.max - spec.min) return `Step ${step} exceeds range`;
    return null;
  }
  // Comma-separated list (recursive)
  if (part.includes(",")) {
    for (const item of part.split(",")) {
      const e = validateSinglePart(item, spec);
      if (e) return e;
    }
    return null;
  }
  // Range: n-m or n-m/step
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
  // N/step: start value + step (Vixie-cron form, e.g. 0/15 = 0,15,30,45)
  const nStepMatch = part.match(/^(\d+)\/(\d+)$/);
  if (nStepMatch) {
    const start = Number(nStepMatch[1]);
    const step = Number(nStepMatch[2]);
    if (start < spec.min || start > spec.max)
      return `${start} out of range ${spec.min}-${spec.max}`;
    if (step < 1) return "Step must be >= 1";
    return null;
  }
  // Plain integer
  if (/^\d+$/.test(part)) {
    const n = Number(part);
    if (n < spec.min || n > spec.max) return `${n} out of range ${spec.min}-${spec.max}`;
    return null;
  }
  return `Invalid value: ${raw}`;
}

// ─── Field expansion ──────────────────────────────────────────────────────────

/**
 * Expand a raw field string to the sorted set of integer values it matches.
 * Assumes the value has already been validated (or trust internal callers).
 *
 * The step-wildcard and range/step forms use Math.max(1, step) as a safety
 * floor even though validateSinglePart should have rejected step < 1 already
 * — defence in depth so expansion never infinite-loops.
 */
export function expandField(raw: string, spec: FieldSpec): number[] {
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
    const nStepMatch = segment.match(/^(\d+)\/(\d+)$/);
    if (nStepMatch) {
      const start = Number(nStepMatch[1]);
      const step = Math.max(1, Number(nStepMatch[2]));
      for (let i = start; i <= spec.max; i += step) result.add(i);
      continue;
    }
    if (/^\d+$/.test(segment)) result.add(Number(segment));
  }
  return [...result].sort((a, b) => a - b);
}
