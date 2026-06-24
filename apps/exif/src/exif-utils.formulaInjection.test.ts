/**
 * Formula-injection guard for exif CSV export (gauntlet w6, security parity).
 *
 * EXIF metadata is attacker-controlled (a photo from a third party can carry
 * arbitrary field values). Without a prefix guard, a field like `=HYPERLINK(...)`
 * exported to CSV executes in spreadsheet apps on open.
 *
 * These tests assert that csvEscape prefixes formula-trigger chars (`=`, `+`, `-`,
 * `@`, tab, CR) with a single-quote so the cell is treated as text, while normal
 * values pass through unchanged.
 */
import { describe, expect, it } from "vitest";
import { csvEscape, exifToCsv } from "./exif-utils";

describe("csvEscape: OWASP formula injection guard", () => {
  it("prefixes = with a single-quote", () => {
    expect(csvEscape("=cmd")).toBe("\"'=cmd\"");
  });

  it("prefixes + with a single-quote", () => {
    expect(csvEscape("+1")).toBe("\"'+1\"");
  });

  it("prefixes - with a single-quote", () => {
    expect(csvEscape("-1")).toBe("\"'-1\"");
  });

  it("prefixes @ with a single-quote", () => {
    expect(csvEscape("@x")).toBe("\"'@x\"");
  });

  it("prefixes tab-leading value with a single-quote", () => {
    expect(csvEscape("\tcell")).toBe("\"'\tcell\"");
  });

  it("prefixes CR-leading value with a single-quote", () => {
    expect(csvEscape("\rcell")).toBe("\"'\rcell\"");
  });

  it("does NOT prefix a normal string", () => {
    expect(csvEscape("normal")).toBe("\"normal\"");
  });

  it("does NOT prefix a string that contains = but does not start with =", () => {
    expect(csvEscape("Canon EOS=5D")).toBe("\"Canon EOS=5D\"");
  });

  it("does NOT prefix an empty string", () => {
    expect(csvEscape("")).toBe('""');
  });

  it("still escapes internal double quotes after prefixing", () => {
    // value: =say "hi"  → prefixed: ='=say "hi"  → quoted+escaped: "'=say ""hi"""
    expect(csvEscape('=say "hi"')).toBe("\"'=say \"\"hi\"\"\"");
  });
});

describe("exifToCsv: formula-injection field in record is prefixed", () => {
  it("prefixes a value starting with = in the CSV output", () => {
    const csv = exifToCsv({ Software: "=HYPERLINK(\"http://evil.com\",\"click\")" });
    // The value cell must begin with ' to neutralise the formula
    expect(csv).toContain("'=HYPERLINK");
  });

  it("prefixes a value starting with + in the CSV output", () => {
    const csv = exifToCsv({ Software: "+1" });
    expect(csv).toContain("'+1");
  });
});
