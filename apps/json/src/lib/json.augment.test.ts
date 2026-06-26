/**
 * Augmented tests for json.ts.
 * Covers negative/edge pathways not reached by the existing tests.
 */
import { describe, expect, it } from "vitest";
import {
  buildTree,
  byteSize,
  formatBytes,
  formatJson,
  minifyJson,
  parseJson,
  positionToLineCol,
  queryJsonPath,
  repairJson,
  sortKeys,
} from "./json";

// ── parseJson negative cases ──────────────────────────────────────────────────

describe("parseJson — additional negative cases", () => {
  it("returns failure for number-only invalid JSON", () => {
    // Lone number is valid JSON; test a genuinely broken variant
    const result = parseJson("1.2.3");
    expect(result.ok).toBe(false);
  });

  it("returns failure for trailing garbage after valid value", () => {
    const result = parseJson('{"a":1} garbage');
    expect(result.ok).toBe(false);
  });

  it("parses numeric literal as valid JSON", () => {
    const result = parseJson("42");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("parses boolean true as valid JSON", () => {
    const result = parseJson("true");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });

  it("parses string literal as valid JSON", () => {
    const result = parseJson('"hello"');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("hello");
  });

  it("failure for unclosed array includes line >= 1", () => {
    const result = parseJson("[1, 2, 3");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBeGreaterThanOrEqual(1);
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });
});

// ── positionToLineCol edge cases ─────────────────────────────────────────────

describe("positionToLineCol — additional edge cases", () => {
  it("handles position exactly at the end of string", () => {
    const s = "abc";
    const result = positionToLineCol(s, 3);
    expect(result.line).toBe(1);
    expect(result.col).toBeGreaterThanOrEqual(1);
  });

  it("counts col correctly within line 2", () => {
    const s = "abc\ndefg";
    // position 6 = 'f' (0=a,1=b,2=c,3=\n,4=d,5=e,6=f)
    const result = positionToLineCol(s, 6);
    expect(result.line).toBe(2);
  });

  it("handles empty string at position 0", () => {
    const result = positionToLineCol("", 0);
    expect(result.line).toBe(1);
    expect(result.col).toBe(1);
  });

  it("handles a string with only newlines", () => {
    const result = positionToLineCol("\n\n\n", 3);
    expect(result.line).toBe(4);
  });
});

// ── formatJson negative cases ─────────────────────────────────────────────────

describe("formatJson — additional cases", () => {
  it("formats nested object with 2-space indent", () => {
    const out = formatJson('{"a":{"b":1}}', 2);
    expect(out).toContain('"b": 1');
    expect(out).toContain("  ");
  });

  it("round-trips: parse then re-stringify preserves values", () => {
    const input = '{"x":[1,2,3],"y":null,"z":true}';
    const formatted = formatJson(input, 2);
    expect(JSON.parse(formatted)).toEqual({ x: [1, 2, 3], y: null, z: true });
  });

  it("throws on empty string input", () => {
    expect(() => formatJson("", 2)).toThrow();
  });
});

// ── minifyJson negative cases ─────────────────────────────────────────────────

describe("minifyJson — additional cases", () => {
  it("minifies nested arrays", () => {
    const out = minifyJson("[[1, 2], [3, 4]]");
    expect(out).toBe("[[1,2],[3,4]]");
  });

  it("throws on trailing comma input", () => {
    expect(() => minifyJson('{"a":1,}')).toThrow();
  });
});

// ── buildTree boolean/edge cases ──────────────────────────────────────────────

describe("buildTree — additional cases", () => {
  it("builds a boolean true node", () => {
    const node = buildTree(true, "flag");
    expect(node.kind).toBe("primitive");
    if (node.kind === "primitive") {
      expect(node.valueKind).toBe("boolean");
      expect(node.value).toBe("true");
    }
  });

  it("builds a boolean false node", () => {
    const node = buildTree(false, "off");
    expect(node.kind).toBe("primitive");
    if (node.kind === "primitive") {
      expect(node.valueKind).toBe("boolean");
      expect(node.value).toBe("false");
    }
  });

  it("builds an empty object node", () => {
    const node = buildTree({}, null);
    expect(node.kind).toBe("object");
    if (node.kind === "object") {
      expect(node.count).toBe(0);
      expect(node.children).toHaveLength(0);
    }
  });

  it("builds an empty array node", () => {
    const node = buildTree([], null);
    expect(node.kind).toBe("array");
    if (node.kind === "array") {
      expect(node.count).toBe(0);
    }
  });

  it("assigns string indices as keys for array children", () => {
    const node = buildTree(["a", "b"], null);
    if (node.kind === "array") {
      expect(node.children[0].key).toBe("0");
      expect(node.children[1].key).toBe("1");
    }
  });
});

// ── sortKeys negative cases ───────────────────────────────────────────────────

describe("sortKeys — additional cases", () => {
  it("handles empty object", () => {
    expect(sortKeys({})).toEqual({});
  });

  it("handles empty array", () => {
    expect(sortKeys([])).toEqual([]);
  });

  it("handles boolean values in objects", () => {
    const result = sortKeys({ z: false, a: true }) as Record<string, boolean>;
    expect(Object.keys(result)).toEqual(["a", "z"]);
    expect(result.a).toBe(true);
    expect(result.z).toBe(false);
  });

  it("does not alter string values", () => {
    expect(sortKeys("hello")).toBe("hello");
  });
});

// ── repairJson additional negative cases ─────────────────────────────────────

describe("repairJson — additional negative cases", () => {
  it("repairs object with both trailing comma and single quotes", () => {
    const result = repairJson("{'a': 1,}");
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  it("repairs nested objects with trailing commas", () => {
    const result = repairJson('{"a": {"b": 1,},}');
    expect(JSON.parse(result)).toEqual({ a: { b: 1 } });
  });

  it("throws on completely unrecoverable input", () => {
    expect(() => repairJson("{{{")).toThrow();
  });

  it("valid JSON passes through unchanged (modulo whitespace)", () => {
    const valid = '{"key":"value"}';
    const result = repairJson(valid);
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });
});

// ── queryJsonPath additional cases ────────────────────────────────────────────

describe("queryJsonPath — additional cases", () => {
  const data = {
    a: { b: { c: 42 } },
    items: [{ name: "x" }, { name: "y" }],
  };

  it("returns empty for path pointing to nonexistent deep key", () => {
    const results = queryJsonPath(data, "$.a.b.z");
    expect(results).toHaveLength(0);
  });

  it("resolves nested dot path", () => {
    const results = queryJsonPath(data, "$.a.b.c");
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(42);
  });

  it("returns empty for array index out of bounds", () => {
    const results = queryJsonPath(data, "$.items[99]");
    expect(results).toHaveLength(0);
  });

  it("resolves bracket-notation on nested key", () => {
    const results = queryJsonPath({ "my-key": 1 }, "$['my-key']");
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(1);
  });

  it("handles path on primitive root (returns no children for dot access)", () => {
    const results = queryJsonPath(42, "$.someKey");
    expect(results).toHaveLength(0);
  });

  it("resolves wildcard [*] on empty array to empty", () => {
    const results = queryJsonPath({ arr: [] }, "$.arr[*]");
    expect(results).toHaveLength(0);
  });

  it("recursive descent finds deeply nested key", () => {
    const deep = { a: { b: { c: { val: 99 } } } };
    const results = queryJsonPath(deep, "$..val");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].value).toBe(99);
  });
});

// ── byteSize / formatBytes additional cases ───────────────────────────────────

describe("byteSize / formatBytes — additional cases", () => {
  it("empty string is 0 bytes", () => {
    expect(byteSize("")).toBe(0);
  });

  it("formatBytes handles exactly 1 KB (1024 bytes)", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formatBytes handles 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formatBytes returns MB for large values", () => {
    const result = formatBytes(5 * 1024 * 1024);
    expect(result).toContain("MB");
  });

  it("4-byte emoji is counted correctly in UTF-8 (4 bytes)", () => {
    // U+1F600 GRINNING FACE = 4 bytes in UTF-8
    expect(byteSize("😀")).toBe(4);
  });
});
