import { describe, expect, it } from "vitest";
import {
  CRON_MACROS,
  TZ_OPTIONS,
  describeCron,
  expandMacro,
  expressionToFields,
  fieldsToExpression,
  formatRunTime,
  getLocalIanaTz,
  isQuartzSixField,
  nextRuns,
  resolveTzLabel,
  validateField,
  validateFields,
} from "./cron";

// ─── expressionToFields ───────────────────────────────────────────────────────

describe("expressionToFields", () => {
  it("parses a 5-part expression correctly", () => {
    const r = expressionToFields("*/5 9-17 * * 1-5");
    expect(r.ok).toBe(true);
    expect(r.fields.minute).toBe("*/5");
    expect(r.fields.hour).toBe("9-17");
    expect(r.fields.dow).toBe("1-5");
  });

  it("rejects fewer than 5 fields", () => {
    const r = expressionToFields("* * * *");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/5 fields/);
  });

  it("rejects more than 5 fields", () => {
    const r = expressionToFields("0 0 * * * *");
    expect(r.ok).toBe(false);
  });
});

describe("fieldsToExpression", () => {
  it("round-trips a parsed expression", () => {
    const expr = "0 12 * * 1";
    const { fields } = expressionToFields(expr);
    expect(fieldsToExpression(fields)).toBe(expr);
  });
});

// ─── validateField ────────────────────────────────────────────────────────────

describe("validateField, minute", () => {
  it("accepts * wildcard", () => expect(validateField("minute", "*")).toBeNull());
  it("accepts plain 0", () => expect(validateField("minute", "0")).toBeNull());
  it("accepts 59", () => expect(validateField("minute", "59")).toBeNull());
  it("rejects 60", () => expect(validateField("minute", "60")).not.toBeNull());
  it("accepts */15", () => expect(validateField("minute", "*/15")).toBeNull());
  it("accepts 0,15,30,45", () => expect(validateField("minute", "0,15,30,45")).toBeNull());
  it("accepts 0-30", () => expect(validateField("minute", "0-30")).toBeNull());
  it("accepts 0-30/5", () => expect(validateField("minute", "0-30/5")).toBeNull());
  it("rejects range start > end", () => expect(validateField("minute", "30-10")).not.toBeNull());
});

describe("validateField, month with names", () => {
  it("accepts Jan", () => expect(validateField("month", "Jan")).toBeNull());
  it("accepts Jan-Jun", () => expect(validateField("month", "Jan-Jun")).toBeNull());
  it("accepts 1-12", () => expect(validateField("month", "1-12")).toBeNull());
  it("rejects 13", () => expect(validateField("month", "13")).not.toBeNull());
  it("rejects 0 for month", () => expect(validateField("month", "0")).not.toBeNull());
});

describe("validateField, dow with names", () => {
  it("accepts Sun", () => expect(validateField("dow", "Sun")).toBeNull());
  it("accepts Mon-Fri", () => expect(validateField("dow", "Mon-Fri")).toBeNull());
  it("accepts 1-5", () => expect(validateField("dow", "1-5")).toBeNull());
  it("rejects 7", () => expect(validateField("dow", "7")).not.toBeNull());
});

describe("validateFields", () => {
  it("passes canonical presets", () => {
    const exprs = ["* * * * *", "0 0 * * *", "0 9 * * 1-5", "*/5 * * * *", "0 12 1 * *"];
    for (const e of exprs) {
      const { fields } = expressionToFields(e);
      expect(validateFields(fields)).toBeNull();
    }
  });
});

// ─── describeCron ─────────────────────────────────────────────────────────────

describe("describeCron", () => {
  it("describes * * * * *", () => {
    const { fields } = expressionToFields("* * * * *");
    expect(describeCron(fields)).toMatch(/every minute/i);
  });

  it("describes 0 0 * * *", () => {
    const { fields } = expressionToFields("0 0 * * *");
    expect(describeCron(fields)).toBe("At 00:00");
  });

  it("describes 0 9 * * 1-5", () => {
    const { fields } = expressionToFields("0 9 * * 1-5");
    expect(describeCron(fields)).toMatch(/09:00/);
    expect(describeCron(fields)).toMatch(/Monday.*Friday|Mon.*Fri/i);
  });

  it("describes */5 * * * *", () => {
    const { fields } = expressionToFields("*/5 * * * *");
    expect(describeCron(fields)).toMatch(/minute/i);
    expect(describeCron(fields)).toMatch(/5/);
  });

  it("describes 0 8,20 * * *", () => {
    const { fields } = expressionToFields("0 8,20 * * *");
    expect(describeCron(fields)).toMatch(/08|20/);
  });

  it("describes 0 0 1 * *", () => {
    const { fields } = expressionToFields("0 0 1 * *");
    expect(describeCron(fields)).toMatch(/1st/);
  });
});

// ─── nextRuns ──────────────────────────────────────────────────────────────────

describe("nextRuns", () => {
  // Fixed anchor: 2024-01-15 10:07:00 UTC (Monday)
  const anchor = new Date("2024-01-15T10:07:00Z");

  it("returns 5 results for * * * * *", () => {
    const runs = nextRuns({ minute: "*", hour: "*", dom: "*", month: "*", dow: "*" }, 5, anchor);
    expect(runs).toHaveLength(5);
  });

  it("advances one minute at a time for * * * * *", () => {
    const runs = nextRuns({ minute: "*", hour: "*", dom: "*", month: "*", dow: "*" }, 3, anchor);
    expect(runs[0].getMinutes()).toBe(8);
    expect(runs[1].getMinutes()).toBe(9);
    expect(runs[2].getMinutes()).toBe(10);
  });

  it("hourly 0 * * * * fires next at :00 on the next hour boundary", () => {
    const runs = nextRuns({ minute: "0", hour: "*", dom: "*", month: "*", dow: "*" }, 1, anchor);
    expect(runs[0].getMinutes()).toBe(0);
    // The run must be strictly after the anchor and within 60 minutes of it
    expect(runs[0].getTime()).toBeGreaterThan(anchor.getTime());
    expect(runs[0].getTime() - anchor.getTime()).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("daily midnight 0 0 * * * fires next day", () => {
    const runs = nextRuns({ minute: "0", hour: "0", dom: "*", month: "*", dow: "*" }, 1, anchor);
    expect(runs[0].getDate()).toBe(16);
    expect(runs[0].getHours()).toBe(0);
    expect(runs[0].getMinutes()).toBe(0);
  });

  it("returns empty array for invalid fields", () => {
    const runs = nextRuns({ minute: "99", hour: "*", dom: "*", month: "*", dow: "*" }, 5, anchor);
    expect(runs).toHaveLength(0);
  });

  it("respects day-of-week constraint (Mon-Fri)", () => {
    // anchor is 2024-01-15 Monday; the 20th is Saturday
    const runs = nextRuns({ minute: "0", hour: "9", dom: "*", month: "*", dow: "1-5" }, 5, anchor);
    for (const r of runs) {
      const day = r.getDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it("respects month constraint", () => {
    const runs = nextRuns({ minute: "0", hour: "0", dom: "1", month: "3", dow: "*" }, 3, anchor);
    for (const r of runs) {
      expect(r.getMonth()).toBe(2); // March = index 2
    }
  });
});

// ─── formatRunTime ─────────────────────────────────────────────────────────────

describe("formatRunTime", () => {
  const d = new Date("2024-06-15T14:30:00Z"); // Saturday, 14:30 UTC

  it("returns a non-empty string for local time (no timezone arg)", () => {
    const s = formatRunTime(d);
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });

  it("returns the same result for timezone='local' as no arg", () => {
    expect(formatRunTime(d, "local")).toBe(formatRunTime(d));
  });

  it("formats in UTC when timezone='UTC'", () => {
    const s = formatRunTime(d, "UTC");
    // UTC 14:30 should appear in the string
    expect(s).toMatch(/14:30/);
  });

  it("formats in a different timezone (Auckland is UTC+12 in June)", () => {
    const utc = formatRunTime(d, "UTC");
    const akl = formatRunTime(d, "Pacific/Auckland");
    // UTC+12: 14:30 UTC -> 02:30 next day in Auckland
    expect(akl).not.toBe(utc);
    expect(akl).toMatch(/02:30/);
  });
});

// ─── @-macro support ──────────────────────────────────────────────────────────

describe("expandMacro", () => {
  it("expands @daily to 0 0 * * *", () => {
    expect(expandMacro("@daily")).toEqual({ expanded: "0 0 * * *", wasMacro: true });
  });

  it("expands @hourly to 0 * * * *", () => {
    expect(expandMacro("@hourly")).toEqual({ expanded: "0 * * * *", wasMacro: true });
  });

  it("expands @weekly to 0 0 * * 0", () => {
    expect(expandMacro("@weekly")).toEqual({ expanded: "0 0 * * 0", wasMacro: true });
  });

  it("expands @monthly to 0 0 1 * *", () => {
    expect(expandMacro("@monthly")).toEqual({ expanded: "0 0 1 * *", wasMacro: true });
  });

  it("expands @yearly and @annually to the same expression", () => {
    expect(expandMacro("@yearly").expanded).toBe(expandMacro("@annually").expanded);
  });

  it("expands @midnight the same as @daily", () => {
    expect(expandMacro("@midnight").expanded).toBe(expandMacro("@daily").expanded);
  });

  it("is case-insensitive", () => {
    expect(expandMacro("@DAILY")).toEqual({ expanded: "0 0 * * *", wasMacro: true });
  });

  it("does not expand a standard expression", () => {
    expect(expandMacro("0 0 * * *")).toEqual({ expanded: "0 0 * * *", wasMacro: false });
  });

  it("does not expand unknown @-identifiers", () => {
    expect(expandMacro("@unknown")).toEqual({ expanded: "@unknown", wasMacro: false });
  });
});

describe("expressionToFields with @-macros", () => {
  it("parses @daily successfully", () => {
    const r = expressionToFields("@daily");
    expect(r.ok).toBe(true);
    expect(r.fields.minute).toBe("0");
    expect(r.fields.hour).toBe("0");
  });

  it("parses @hourly successfully", () => {
    const r = expressionToFields("@hourly");
    expect(r.ok).toBe(true);
    expect(r.fields.minute).toBe("0");
    expect(r.fields.hour).toBe("*");
  });

  it("parses @weekly successfully", () => {
    const r = expressionToFields("@weekly");
    expect(r.ok).toBe(true);
    expect(r.fields.dow).toBe("0");
  });

  it("produces a valid field set for all known macros", () => {
    for (const macro of Object.keys(CRON_MACROS)) {
      const r = expressionToFields(macro);
      expect(r.ok).toBe(true);
      expect(validateFields(r.fields)).toBeNull();
    }
  });

  it("returns a helpful error for @reboot", () => {
    const r = expressionToFields("@reboot");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/boot/i);
  });

  it("returns a helpful error listing known macros for unknown @-identifiers", () => {
    const r = expressionToFields("@every5min");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/@daily/);
  });
});

// ─── 6-field Quartz detection ─────────────────────────────────────────────────

describe("isQuartzSixField", () => {
  it("detects 6-field expression starting with a digit seconds field", () => {
    expect(isQuartzSixField("0 0 12 * * ?")).toBe(true);
  });

  it("detects 6-field expression starting with * seconds field", () => {
    expect(isQuartzSixField("* 0 12 * * ?")).toBe(true);
  });

  it("does not flag a standard 5-field expression", () => {
    expect(isQuartzSixField("0 12 * * *")).toBe(false);
  });

  it("does not flag a 4-field expression", () => {
    expect(isQuartzSixField("0 12 * *")).toBe(false);
  });
});

describe("expressionToFields with 6-field Quartz input", () => {
  it("returns a helpful error mentioning 'Quartz' for 6-field input", () => {
    const r = expressionToFields("0 0 12 * * ?");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Quartz|6-field|6 field/i);
  });

  it("error message explains how to convert to 5-field form", () => {
    const r = expressionToFields("0 0 12 * * ?");
    expect(r.error).toMatch(/drop|remove|first field/i);
  });
});

describe("expressionToFields improved field-count error message", () => {
  it("includes the actual field count in the error message for 4-field input", () => {
    const r = expressionToFields("* * * *");
    expect(r.ok).toBe(false);
    // Should NOT say "must have exactly 5" without any context
    // and should acknowledge the actual count
    expect(r.error).toMatch(/4|four/i);
  });
});

// ─── resolveTzLabel ───────────────────────────────────────────────────────────

describe("resolveTzLabel", () => {
  it("returns the IANA tz in parens for 'local'", () => {
    const label = resolveTzLabel("local", TZ_OPTIONS);
    expect(label).toMatch(/^Local \(.+\)$/);
  });

  it("returns the option label for a named timezone", () => {
    expect(resolveTzLabel("UTC", TZ_OPTIONS)).toBe("UTC");
    expect(resolveTzLabel("Pacific/Auckland", TZ_OPTIONS)).toBe("Auckland");
  });

  it("falls back to the raw value for an unknown timezone", () => {
    expect(resolveTzLabel("Etc/Unknown", TZ_OPTIONS)).toBe("Etc/Unknown");
  });
});

describe("getLocalIanaTz", () => {
  it("returns a non-empty string", () => {
    expect(typeof getLocalIanaTz()).toBe("string");
    expect(getLocalIanaTz().length).toBeGreaterThan(0);
  });
});

// ─── TZ_OPTIONS ────────────────────────────────────────────────────────────────

describe("TZ_OPTIONS", () => {
  it("includes local and UTC options", () => {
    const values = TZ_OPTIONS.map((o) => o.value);
    expect(values).toContain("local");
    expect(values).toContain("UTC");
  });

  it("has unique values", () => {
    const values = TZ_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("first option is local time", () => {
    expect(TZ_OPTIONS[0].value).toBe("local");
  });
});
