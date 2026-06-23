import { create } from "zustand";
import type { CronFields } from "../lib/cron";
import {
  describeCron,
  expandMacro,
  expressionToFields,
  fieldsToExpression,
  nextRuns,
  validateField,
} from "../lib/cron";

interface CronState {
  expression: string;
  fields: CronFields;
  description: string;
  runs: Date[];
  fieldErrors: Partial<Record<keyof CronFields, string>>;
  globalError: string | null;

  setExpression: (expr: string) => void;
  setField: (field: keyof CronFields, value: string) => void;
}

const DEFAULT_EXPR = "0 9 * * 1-5";
const STORAGE_KEY = "cron-expression";

function loadExpression(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_EXPR;
  } catch {
    return DEFAULT_EXPR;
  }
}

function saveExpression(expr: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, expr);
  } catch {
    // ignore storage errors
  }
}

function buildState(expr: string) {
  const parsed = expressionToFields(expr);
  const fields = parsed.fields;
  const fieldErrors: Partial<Record<keyof CronFields, string>> = {};
  if (!parsed.ok && parsed.error) {
    // Try to surface per-field errors
    for (const f of Object.keys(fields) as (keyof CronFields)[]) {
      const e = validateField(f, fields[f]);
      if (e) fieldErrors[f] = e;
    }
  }
  let description: string;
  if (parsed.ok) {
    const base = describeCron(fields);
    // If the user typed a @-macro, prefix the description with the macro name
    const { wasMacro, expanded } = expandMacro(expr);
    description = wasMacro ? `${expr.trim().toLowerCase()} -- ${base} (${expanded})` : base;
  } else {
    description = parsed.error ?? "Invalid expression";
  }
  const runs = parsed.ok ? nextRuns(fields) : [];
  return {
    expression: expr,
    fields,
    description,
    runs,
    fieldErrors,
    globalError: parsed.ok ? null : (parsed.error ?? null),
  };
}

export const useCronStore = create<CronState>((set) => ({
  ...buildState(loadExpression()),

  setExpression(expr: string) {
    saveExpression(expr);
    set(buildState(expr));
  },

  setField(field: keyof CronFields, value: string) {
    set((state) => {
      const newFields = { ...state.fields, [field]: value };
      const expr = fieldsToExpression(newFields);
      return buildState(expr);
    });
  },
}));
