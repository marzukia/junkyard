/**
 * Augmentation tests for csv.ts — pathways not covered by csv.test.ts:
 *   - detectDelimiter with single-line input
 *   - detectDelimiter with blank/whitespace-only input
 *   - splitCsvRows with only one column (no delimiter)
 *   - splitCsvRows CR-only line endings
 *   - parseCsv hasHeader=true with only header (no data rows)
 *   - parseCsv column label generation beyond Z (AA, AB...)
 *   - jsonToCsv with array of primitives (should error)
 *   - jsonToCsv with null values
 *   - csvToSql with custom table name
 *   - csvToMarkdown with empty data rows
 *   - csvToXml header name with special chars becomes valid tag
 *   - coerceValue with scientific notation
 *   - csvEscape with carriage return
 */
import { describe, expect, it } from "vitest";
import {
  coerceValue,
  csvEscape,
  csvToMarkdown,
  csvToSql,
  csvToXml,
  csvToYaml,
  detectDelimiter,
  jsonToCsv,
  parseCsv,
  splitCsvRows,
} from "./csv";

// ── detectDelimiter edge cases ────────────────────────────────────────────

describe("detectDelimiter edge cases", () => {
  it("returns comma by default for whitespace-only input", () => {
    // No delimiters found; defaults to comma
    expect(detectDelimiter("   ")).toBe(",");
  });

  it("detects comma from a single-line CSV", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
  });

  it("detects tab from a single-line TSV", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });

  it("detects semicolon from a 3-line CSV", () => {
    expect(detectDelimiter("a;b;c\n1;2;3\n4;5;6")).toBe(";");
  });

  it("detects pipe from consistent pipe-delimited data", () => {
    expect(detectDelimiter("name|age|city\nAlice|30|NYC\nBob|25|LA")).toBe("|");
  });

  it("prefers the delimiter with the most consistent count across lines", () => {
    // Commas appear in every line; pipe appears in only one
    const input = "a,b,c\n1,2,3\na|b|c";
    const d = detectDelimiter(input);
    expect(d).toBe(",");
  });
});

// ── splitCsvRows edge cases ────────────────────────────────────────────────

describe("splitCsvRows edge cases", () => {
  it("handles a single-column CSV (no delimiter in line)", () => {
    const rows = splitCsvRows("alpha\nbeta\ngamma", ",");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["alpha"]);
    expect(rows[2]).toEqual(["gamma"]);
  });

  it("handles CR-only line endings", () => {
    const rows = splitCsvRows("a,b\rc,d", ",");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["a", "b"]);
    expect(rows[1]).toEqual(["c", "d"]);
  });

  it("handles empty quoted field", () => {
    const rows = splitCsvRows('"",b,c', ",");
    expect(rows[0][0]).toBe("");
    expect(rows[0][1]).toBe("b");
  });

  it("handles all-empty row being filtered out", () => {
    // A row with only the empty string should be skipped
    const rows = splitCsvRows("a,b\n\nc,d", ",");
    // The empty row in the middle is filtered; we expect 2 rows
    expect(rows).toHaveLength(2);
  });

  it("handles a quoted field spanning multiple lines", () => {
    const rows = splitCsvRows('"line1\nline2",end', ",");
    expect(rows[0][0]).toBe("line1\nline2");
    expect(rows[0][1]).toBe("end");
  });

  it("handles pipe as delimiter correctly", () => {
    const rows = splitCsvRows("a|b|c\n1|2|3", "|");
    expect(rows[0]).toEqual(["a", "b", "c"]);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });
});

// ── parseCsv edge cases ───────────────────────────────────────────────────

describe("parseCsv edge cases", () => {
  it("returns error for header-only CSV with no data rows", () => {
    // Header row exists but no data; rowCount should be 0 (valid, not an error)
    const result = parseCsv("name,age", { delimiter: ",", hasHeader: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rowCount).toBe(0);
      expect(result.value.headers).toEqual(["name", "age"]);
    }
  });

  it("generates AA, AB... column labels beyond Z", () => {
    // 27 columns: A-Z then AA
    const cols = Array.from({ length: 27 }, (_, i) => "x").join(",");
    const result = parseCsv(cols, { delimiter: ",", hasHeader: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.headers[26]).toBe("AA");
    }
  });

  it("uses tab delimiter correctly with hasHeader=false", () => {
    const result = parseCsv("1\t2\t3", { delimiter: "\t", hasHeader: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.headers).toEqual(["A", "B", "C"]);
    }
  });

  it("handles input with only whitespace lines as error", () => {
    const result = parseCsv("   \n\t\n", { delimiter: ",", hasHeader: true });
    expect(result.ok).toBe(false);
  });

  it("counts nonEmptyLineCount correctly without header", () => {
    const result = parseCsv("1,2\n3,4\n5,6", { delimiter: ",", hasHeader: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nonEmptyLineCount).toBe(3);
    }
  });
});

// ── jsonToCsv edge cases ──────────────────────────────────────────────────

describe("jsonToCsv edge cases", () => {
  it("returns error when JSON array contains primitives", () => {
    const result = jsonToCsv(JSON.stringify([1, 2, 3]), ",");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/primitive/i);
    }
  });

  it("handles null values in object array", () => {
    const result = jsonToCsv(JSON.stringify([{ a: null, b: "x" }]), ",");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lines = result.value.split("\n");
      // null value -> empty cell
      expect(lines[1]).toBe(",x");
    }
  });

  it("collects all keys across heterogeneous rows", () => {
    const data = [{ a: 1 }, { b: 2 }];
    const result = jsonToCsv(JSON.stringify(data), ",");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.split("\n")[0]).toBe("a,b");
    }
  });

  it("uses tab delimiter in output", () => {
    const data = [{ name: "Alice", age: 30 }];
    const result = jsonToCsv(JSON.stringify(data), "\t");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.split("\n")[0]).toBe("name\tage");
    }
  });

  it("handles fields containing the delimiter via quoting", () => {
    const data = [{ val: "hello\tworld" }];
    const result = jsonToCsv(JSON.stringify(data), "\t");
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The tab inside the value should be quoted
      expect(result.value).toContain('"hello\tworld"');
    }
  });
});

// ── csvToSql edge cases ───────────────────────────────────────────────────

describe("csvToSql edge cases", () => {
  it("uses custom table name", () => {
    const parsed = parseCsv("id,name\n1,Alice", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToSql(parsed.value, "users");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('"users"');
  });

  it("quotes strings that contain single quotes", () => {
    const parsed = parseCsv("name\nO'Brien", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToSql(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // O'Brien -> 'O''Brien'
    expect(result.value).toContain("O''Brien");
  });

  it("produces no output for empty data (header only)", () => {
    const parsed = parseCsv("a,b", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToSql(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("");
  });
});

// ── csvToMarkdown edge cases ──────────────────────────────────────────────

describe("csvToMarkdown edge cases", () => {
  it("handles header-only CSV (no rows)", () => {
    const parsed = parseCsv("col1,col2", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToMarkdown(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.value.split("\n");
    expect(lines[0]).toBe("| col1 | col2 |");
    expect(lines[1]).toBe("| --- | --- |");
    expect(lines).toHaveLength(2);
  });

  it("escapes backslash-pipe sequences in header", () => {
    const parsed = parseCsv("a|b,c", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToMarkdown(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("a\\|b");
  });
});

// ── csvToXml edge cases ───────────────────────────────────────────────────

describe("csvToXml edge cases", () => {
  it("sanitises header names with spaces to valid XML tags", () => {
    const parsed = parseCsv("first name,age\nAlice,30", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToXml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Space becomes underscore in tag
    expect(result.value).toContain("<first_name>");
  });

  it("prepends underscore when header starts with digit", () => {
    const parsed = parseCsv("1col,val\nfoo,bar", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToXml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("<_1col>");
  });

  it("escapes > in values", () => {
    const parsed = parseCsv("val\na>b", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToXml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("a&gt;b");
  });

  it("escapes &quot; for double-quote in values", () => {
    const parsed = parseCsv('val\n"say ""hi"""', { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToXml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("&quot;");
  });
});

// ── csvToYaml edge cases ──────────────────────────────────────────────────

describe("csvToYaml edge cases", () => {
  it("quotes YAML special values: true, false, null", () => {
    const parsed = parseCsv("status\ntrue", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToYaml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // "true" must be quoted in YAML to preserve string type
    expect(result.value).toContain('"true"');
  });

  it("produces empty quotes for empty field values", () => {
    const parsed = parseCsv("a,b\n1,", { delimiter: ",", hasHeader: true });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = csvToYaml(parsed.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('""');
  });
});

// ── coerceValue edge cases ────────────────────────────────────────────────

describe("coerceValue edge cases", () => {
  it("coerces scientific notation number", () => {
    expect(coerceValue("1e3")).toBe(1000);
  });

  it("coerces negative float", () => {
    expect(coerceValue("-3.14")).toBe(-3.14);
  });

  it("preserves FALSE (uppercase) as boolean", () => {
    expect(coerceValue("FALSE")).toBe(false);
  });

  it("keeps hex-like strings as strings (not numbers)", () => {
    // "0xff" doesn't match the safe-number regex; should stay string
    expect(typeof coerceValue("0xff")).toBe("string");
  });

  it("keeps non-numeric alphanumeric as string", () => {
    expect(coerceValue("abc123")).toBe("abc123");
  });
});

// ── csvEscape edge cases ──────────────────────────────────────────────────

describe("csvEscape edge cases", () => {
  it("does not double-quote already plain strings", () => {
    expect(csvEscape("hello", ",")).toBe("hello");
  });

  it("quotes field containing carriage return", () => {
    const result = csvEscape("line1\rline2", ",");
    expect(result).toContain('"');
  });

  it("quotes field containing semicolon when semicolon is delimiter", () => {
    expect(csvEscape("a;b", ";")).toBe('"a;b"');
  });

  it("does not quote field containing semicolon when comma is delimiter", () => {
    expect(csvEscape("a;b", ",")).toBe("a;b");
  });
});
