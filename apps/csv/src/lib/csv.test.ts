import { describe, expect, it } from "vitest";
import {
  coerceValue,
  csvEscape,
  csvToJson,
  csvToMarkdown,
  csvToSql,
  csvToXml,
  csvToYaml,
  detectDelimiter,
  jsonToCsv,
  parseCsv,
  splitCsvRows,
} from "./csv";

// ── detectDelimiter ────────────────────────────────────────────────────────────

describe("detectDelimiter", () => {
  it("detects comma as default", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });

  it("detects tab delimiter", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("detects semicolon delimiter", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
  });

  it("detects pipe delimiter", () => {
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });
});

// ── splitCsvRows ──────────────────────────────────────────────────────────────

describe("splitCsvRows", () => {
  it("splits simple rows", () => {
    const rows = splitCsvRows("a,b,c\n1,2,3", ",");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded delimiter", () => {
    const rows = splitCsvRows('"hello, world",b,c\n1,2,3', ",");
    expect(rows[0][0]).toBe("hello, world");
    expect(rows[0][1]).toBe("b");
  });

  it("handles double-quote escape inside quotes", () => {
    const rows = splitCsvRows('"say ""hi""",b', ",");
    expect(rows[0][0]).toBe('say "hi"');
  });

  it("handles embedded newlines inside quotes", () => {
    const rows = splitCsvRows('"line1\nline2",b', ",");
    expect(rows[0][0]).toBe("line1\nline2");
  });

  it("handles tab delimiter", () => {
    const rows = splitCsvRows("a\tb\tc", "\t");
    expect(rows[0]).toEqual(["a", "b", "c"]);
  });

  it("handles CRLF line endings", () => {
    const rows = splitCsvRows("a,b\r\n1,2", ",");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["1", "2"]);
  });
});

// ── parseCsv ──────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses with header", () => {
    const result = parseCsv("name,age\nAlice,30\nBob,25", {
      delimiter: ",",
      hasHeader: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.headers).toEqual(["name", "age"]);
      expect(result.value.rows).toHaveLength(2);
      expect(result.value.rowCount).toBe(2);
      expect(result.value.colCount).toBe(2);
    }
  });

  it("generates column labels when no header", () => {
    const result = parseCsv("Alice,30\nBob,25", { delimiter: ",", hasHeader: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.headers).toEqual(["A", "B"]);
    }
  });

  it("returns error for empty input", () => {
    const result = parseCsv("   \n", { delimiter: ",", hasHeader: true });
    expect(result.ok).toBe(false);
  });

  it("reports nonEmptyLineCount including the header line", () => {
    const result = parseCsv("name,age\nAlice,30\nBob,25", {
      delimiter: ",",
      hasHeader: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 3 non-empty lines (1 header + 2 data)
      expect(result.value.nonEmptyLineCount).toBe(3);
    }
  });

  it("reports no ragged warnings for uniform CSV", () => {
    const result = parseCsv("a,b,c\n1,2,3\n4,5,6", { delimiter: ",", hasHeader: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.raggedWarnings).toHaveLength(0);
    }
  });

  it("reports ragged warnings for rows with wrong field count", () => {
    // Row 1 has 4 fields (a,b,c,d) vs header width of 3
    const result = parseCsv("a,b,c\n1,2,3,4\n4,5", { delimiter: ",", hasHeader: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.raggedWarnings).toHaveLength(2);
      expect(result.value.raggedWarnings[0]).toEqual({ rowIndex: 1, expected: 3, actual: 4 });
      expect(result.value.raggedWarnings[1]).toEqual({ rowIndex: 2, expected: 3, actual: 2 });
    }
  });
});

// ── csvToMarkdown ─────────────────────────────────────────────────────────────

describe("csvToMarkdown", () => {
  it("produces a GFM table with header separator", () => {
    const parsed = parseCsv("name,age\nAlice,30", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToMarkdown(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.value.split("\n");
    expect(lines[0]).toBe("| name | age |");
    expect(lines[1]).toBe("| --- | --- |");
    expect(lines[2]).toBe("| Alice | 30 |");
  });

  it("escapes pipe characters in values", () => {
    const parsed = parseCsv("val\na|b", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToMarkdown(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("a\\|b");
  });
});

// ── csvToSql ──────────────────────────────────────────────────────────────────

describe("csvToSql", () => {
  it("produces INSERT statements with quoted identifiers", () => {
    const parsed = parseCsv("name,age\nAlice,30", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToSql(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("INSERT INTO");
    expect(result.value).toContain("'Alice'");
    expect(result.value).toContain("30");
  });

  it("emits NULL for empty fields", () => {
    const parsed = parseCsv("a,b\n1,", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToSql(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("NULL");
  });
});

// ── csvToXml ──────────────────────────────────────────────────────────────────

describe("csvToXml", () => {
  it("wraps rows in <row> elements", () => {
    const parsed = parseCsv("name,age\nAlice,30", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToXml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("<row>");
    expect(result.value).toContain("<name>Alice</name>");
    expect(result.value).toContain("<age>30</age>");
  });

  it("escapes & and < in values", () => {
    const parsed = parseCsv("val\na&<b", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToXml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("a&amp;&lt;b");
  });
});

// ── csvToYaml ─────────────────────────────────────────────────────────────────

describe("csvToYaml", () => {
  it("produces YAML array entries", () => {
    const parsed = parseCsv("name,age\nAlice,30", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToYaml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("- name: Alice");
    expect(result.value).toContain("age: 30");
  });

  // Regression: header containing `:` must be quoted so the YAML key is valid
  it("quotes header key containing a colon", () => {
    const parsed = parseCsv("first:last,age\nAliceDoe,30", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToYaml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The key "first:last" must be double-quoted in YAML
    expect(result.value).toContain('"first:last"');
  });

  it("quotes header key starting with a hash", () => {
    const parsed = parseCsv("#id,value\n1,foo", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToYaml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('"#id"');
  });
});

// ── coerceValue ────────────────────────────────────────────────────────────────

describe("coerceValue", () => {
  it("coerces integers", () => {
    expect(coerceValue("42")).toBe(42);
  });

  it("coerces floats", () => {
    expect(coerceValue("3.14")).toBe(3.14);
  });

  it("coerces booleans", () => {
    expect(coerceValue("true")).toBe(true);
    expect(coerceValue("false")).toBe(false);
    expect(coerceValue("True")).toBe(true);
  });

  it("coerces empty string to null", () => {
    expect(coerceValue("")).toBeNull();
  });

  it("keeps regular strings as strings", () => {
    expect(coerceValue("hello")).toBe("hello");
  });

  it("keeps leading-zero strings as strings", () => {
    // zip codes like "01234" should NOT become 1234
    expect(coerceValue("01234")).toBe("01234");
  });

  it("keeps overflow-to-Infinity numbers as strings", () => {
    // JSON.stringify silently converts Infinity to null; keep as string instead.
    // 1e309 overflows IEEE-754 double to Infinity; 1e308 is still finite.
    expect(coerceValue("1e309")).toBe("1e309");
    expect(coerceValue("-1e309")).toBe("-1e309");
    // 1e308 is finite and should still be coerced to a number
    expect(typeof coerceValue("1e308")).toBe("number");
  });
});

// ── csvToJson ──────────────────────────────────────────────────────────────────

describe("csvToJson", () => {
  it("converts CSV to JSON array of objects", () => {
    const parsed = parseCsv("name,age,active\nAlice,30,true", {
      delimiter: ",",
      hasHeader: true,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = csvToJson(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const arr = JSON.parse(result.value) as unknown[];
    expect(arr).toHaveLength(1);
    const obj = arr[0] as Record<string, unknown>;
    expect(obj.name).toBe("Alice");
    expect(obj.age).toBe(30);
    expect(obj.active).toBe(true);
  });

  it("maps missing columns to null", () => {
    const parsed = parseCsv("a,b,c\n1,2", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = csvToJson(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const arr = JSON.parse(result.value) as Record<string, unknown>[];
    expect(arr[0].c).toBeNull();
  });
});

// ── jsonToCsv ──────────────────────────────────────────────────────────────────

describe("jsonToCsv", () => {
  it("converts array of objects to CSV", () => {
    const json = JSON.stringify([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const result = jsonToCsv(json, ",");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lines = result.value.split("\n");
    expect(lines[0]).toBe("name,age");
    expect(lines[1]).toBe("Alice,30");
    expect(lines[2]).toBe("Bob,25");
  });

  it("converts array of arrays to CSV", () => {
    const json = JSON.stringify([
      ["a", "b", "c"],
      [1, 2, 3],
    ]);
    const result = jsonToCsv(json, ",");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lines = result.value.split("\n");
    expect(lines[0]).toBe("a,b,c");
    expect(lines[1]).toBe("1,2,3");
  });

  it("escapes fields containing the delimiter", () => {
    const json = JSON.stringify([{ val: "hello, world" }]);
    const result = jsonToCsv(json, ",");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toContain('"hello, world"');
  });

  it("returns error for non-array JSON", () => {
    const result = jsonToCsv('{"a": 1}', ",");
    expect(result.ok).toBe(false);
  });

  it("returns error for invalid JSON", () => {
    const result = jsonToCsv("not json", ",");
    expect(result.ok).toBe(false);
  });

  it("returns empty string for empty array", () => {
    const result = jsonToCsv("[]", ",");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("");
  });
});

// ── csvEscape ─────────────────────────────────────────────────────────────────

describe("csvEscape", () => {
  it("leaves plain strings unquoted", () => {
    expect(csvEscape("hello", ",")).toBe("hello");
  });

  it("quotes strings containing the delimiter", () => {
    expect(csvEscape("a,b", ",")).toBe('"a,b"');
  });

  it("quotes strings containing double-quotes and escapes them", () => {
    expect(csvEscape('say "hi"', ",")).toBe('"say ""hi"""');
  });

  it("quotes strings containing newlines", () => {
    expect(csvEscape("line1\nline2", ",")).toBe('"line1\nline2"');
  });
});
