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

describe("parseJson", () => {
  it("parses valid JSON object", () => {
    const result = parseJson('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it("parses valid JSON array", () => {
    const result = parseJson("[1,2,3]");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([1, 2, 3]);
  });

  it("parses null literal", () => {
    const result = parseJson("null");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("returns failure for invalid JSON", () => {
    const result = parseJson("{bad}");
    expect(result.ok).toBe(false);
  });

  it("failure contains non-zero line and col", () => {
    const result = parseJson('{"a": 1, "b": }');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBeGreaterThanOrEqual(1);
      expect(result.error.col).toBeGreaterThanOrEqual(1);
    }
  });

  it("failure message is non-empty", () => {
    const result = parseJson("not json at all");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.length).toBeGreaterThan(0);
  });

  it("locates error on second line", () => {
    const raw = '{\n  "a": @}';
    const result = parseJson(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // line must be >= 2 since the bad char is after a newline
      expect(result.error.line).toBeGreaterThanOrEqual(2);
    }
  });

  it("reports line 2 for missing value after colon on second line", () => {
    // {"a": 1,\n  "b": ,\n  "c": 3} — the bare comma where a value is expected is on line 2
    const raw = '{"a": 1,\n  "b": ,\n  "c": 3}';
    const result = parseJson(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBeGreaterThanOrEqual(2);
    }
  });

  it("reports non-(1,1) location for trailing comma in array", () => {
    // [1,2,3,] — error is the ] where a value is expected (last char, col 8 on line 1)
    const result = parseJson("[1,2,3,]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Error is at col 8 (the ] on line 1) — col must be > 1
      expect(result.error.col).toBeGreaterThan(1);
    }
  });
});

describe("positionToLineCol", () => {
  it("returns line 1 col 1 for position 0", () => {
    expect(positionToLineCol("hello", 0)).toEqual({ line: 1, col: 1 });
  });

  it("counts newlines correctly", () => {
    const s = "abc\ndef\nghi";
    // position 4 = 'd' on line 2
    expect(positionToLineCol(s, 4)).toEqual({ line: 2, col: 1 });
  });

  it("clamps position beyond string length", () => {
    const result = positionToLineCol("ab", 100);
    expect(result.line).toBeGreaterThanOrEqual(1);
    expect(result.col).toBeGreaterThanOrEqual(1);
  });
});

describe("formatJson", () => {
  it("formats with 2-space indent", () => {
    const out = formatJson('{"a":1}', 2);
    expect(out).toBe('{\n  "a": 1\n}');
  });

  it("formats with 4-space indent", () => {
    const out = formatJson('{"a":1}', 4);
    expect(out).toBe('{\n    "a": 1\n}');
  });

  it("formats with tab indent", () => {
    const out = formatJson('{"a":1}', "tab");
    expect(out).toBe('{\n\t"a": 1\n}');
  });

  it("throws on invalid JSON", () => {
    expect(() => formatJson("{bad}", 2)).toThrow();
  });
});

describe("minifyJson", () => {
  it("removes all whitespace", () => {
    const pretty = '{\n  "a": 1,\n  "b": "hello"\n}';
    expect(minifyJson(pretty)).toBe('{"a":1,"b":"hello"}');
  });

  it("preserves values", () => {
    const input = '{"x": [1, 2, 3], "y": null}';
    const out = JSON.parse(minifyJson(input)) as unknown;
    expect(out).toEqual({ x: [1, 2, 3], y: null });
  });

  it("throws on invalid JSON", () => {
    expect(() => minifyJson("[1,2,")).toThrow();
  });
});

describe("buildTree", () => {
  it("builds a primitive string node", () => {
    const node = buildTree("hello", "key");
    expect(node.kind).toBe("primitive");
    if (node.kind === "primitive") {
      expect(node.valueKind).toBe("string");
      expect(node.value).toBe('"hello"');
      expect(node.key).toBe("key");
    }
  });

  it("builds a primitive number node", () => {
    const node = buildTree(42, "n");
    expect(node.kind).toBe("primitive");
    if (node.kind === "primitive") {
      expect(node.valueKind).toBe("number");
      expect(node.value).toBe("42");
    }
  });

  it("builds a null node", () => {
    const node = buildTree(null, "n");
    expect(node.kind).toBe("primitive");
    if (node.kind === "primitive") expect(node.valueKind).toBe("null");
  });

  it("builds an array node with correct count", () => {
    const node = buildTree([1, 2, 3], null);
    expect(node.kind).toBe("array");
    if (node.kind === "array") expect(node.count).toBe(3);
  });

  it("builds an object node with children", () => {
    const node = buildTree({ a: 1, b: "x" }, null);
    expect(node.kind).toBe("object");
    if (node.kind === "object") {
      expect(node.count).toBe(2);
      expect(node.children[0].key).toBe("a");
    }
  });

  it("nests recursively", () => {
    const node = buildTree({ arr: [1, { deep: true }] }, null);
    expect(node.kind).toBe("object");
    if (node.kind === "object") {
      const arrNode = node.children[0];
      expect(arrNode.kind).toBe("array");
    }
  });
});

describe("sortKeys", () => {
  it("sorts object keys alphabetically", () => {
    const input = { b: 2, a: 1, c: 3 };
    const result = sortKeys(input) as Record<string, number>;
    expect(Object.keys(result)).toEqual(["a", "b", "c"]);
  });

  it("sorts nested object keys", () => {
    const input = { z: { b: 1, a: 2 }, a: 0 };
    const result = sortKeys(input) as Record<string, unknown>;
    expect(Object.keys(result)).toEqual(["a", "z"]);
    expect(Object.keys(result.z as Record<string, unknown>)).toEqual(["a", "b"]);
  });

  it("preserves array item order", () => {
    const input = [3, 1, 2];
    const result = sortKeys(input);
    expect(result).toEqual([3, 1, 2]);
  });

  it("handles null and primitives", () => {
    expect(sortKeys(null)).toBeNull();
    expect(sortKeys(42)).toBe(42);
    expect(sortKeys("hi")).toBe("hi");
  });

  it("sorts keys inside array objects", () => {
    const input = [{ b: 2, a: 1 }];
    const result = sortKeys(input) as Array<Record<string, number>>;
    expect(Object.keys(result[0])).toEqual(["a", "b"]);
  });
});

describe("repairJson", () => {
  it("removes trailing commas from objects", () => {
    const result = repairJson('{"a": 1, "b": 2,}');
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
  });

  it("removes trailing commas from arrays", () => {
    const result = repairJson("[1, 2, 3,]");
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it("converts single quotes to double quotes", () => {
    const result = repairJson("{'key': 'value'}");
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("quotes unquoted keys", () => {
    const result = repairJson("{key: 1}");
    expect(JSON.parse(result)).toEqual({ key: 1 });
  });

  it("throws on deeply malformed JSON that cannot be repaired", () => {
    expect(() => repairJson("not json at all >>>")).toThrow();
  });

  // Regression: repair passes must not mutate content inside double-quoted strings
  it("preserves comma inside a string value", () => {
    const input = '{"a":"x ,] y"}';
    const result = repairJson(input);
    expect(JSON.parse(result)).toEqual({ a: "x ,] y" });
  });

  it("preserves apostrophes inside string values without throwing", () => {
    const input = '{"a":"it\'s","b":"don\'t"}';
    const result = repairJson(input);
    expect(JSON.parse(result)).toEqual({ a: "it's", b: "don't" });
  });

  it("preserves colon and comma inside a string value (see-foo-bar pattern)", () => {
    const input = '{"note":"see, foo: bar"}';
    const result = repairJson(input);
    expect(JSON.parse(result)).toEqual({ note: "see, foo: bar" });
  });

  it("returns valid JSON unchanged (fast path)", () => {
    const valid = '{"x":1,"y":[1,2]}';
    expect(repairJson(valid)).toBe(valid);
  });
});

describe("queryJsonPath", () => {
  const data = {
    store: {
      book: [
        { title: "SICP", author: "Abelson", price: 45 },
        { title: "CTMCP", author: "Roy", price: 30 },
      ],
      name: "Books Inc",
    },
  };

  it("returns root for $ path", () => {
    const results = queryJsonPath(data, "$");
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(data);
  });

  it("resolves dot-notation path", () => {
    const results = queryJsonPath(data, "$.store.name");
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("Books Inc");
  });

  it("resolves array index", () => {
    const results = queryJsonPath(data, "$.store.book[0].title");
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("SICP");
  });

  it("resolves wildcard [*] on array", () => {
    const results = queryJsonPath(data, "$.store.book[*].title");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.value)).toEqual(["SICP", "CTMCP"]);
  });

  it("resolves .* wildcard on object", () => {
    const results = queryJsonPath(data, "$.store.*");
    // book (array) + name (string)
    expect(results).toHaveLength(2);
  });

  it("returns empty array for no matches", () => {
    const results = queryJsonPath(data, "$.store.missing");
    expect(results).toHaveLength(0);
  });

  // Regression: $..*$ must return descendants only, not include the root itself
  it("$..*$ returns descendants only (not the root)", () => {
    const obj = { x: 1, y: { z: 2 } };
    const results = queryJsonPath(obj, "$..*");
    // Expected values: 1 (x), {z:2} (y value), 2 (z) = 3 results
    expect(results).toHaveLength(3);
    const values = results.map((r) => r.value);
    expect(values).toContain(1);
    expect(values).toContain(2);
    expect(values).toContainEqual({ z: 2 });
    // Root must not be in results
    expect(values).not.toContainEqual({ x: 1, y: { z: 2 } });
  });

  it("returns root for empty expression", () => {
    const results = queryJsonPath(data, "");
    expect(results).toHaveLength(1);
  });

  it("resolves bracket-notation key", () => {
    const results = queryJsonPath(data, "$['store']['name']");
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("Books Inc");
  });
});

describe("byteSize / formatBytes", () => {
  it("calculates ASCII byte size correctly", () => {
    expect(byteSize("hello")).toBe(5);
  });

  it("calculates UTF-8 multi-byte correctly", () => {
    // '€' is 3 bytes in UTF-8
    expect(byteSize("€")).toBe(3);
  });

  it("formats bytes under 1KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });
});
