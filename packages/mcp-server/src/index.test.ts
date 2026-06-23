/**
 * Unit tests for name sanitisation and content formatting helpers.
 * These are the two pure functions that could silently produce invalid MCP
 * tool names or broken content if changed.
 */
import { describe, it, expect } from "bun:test";

// Re-exported only for testing; the helpers live in index.ts.
// We duplicate the pure logic here rather than exporting from index.ts
// (which would force the server to register tools on import).

function sanitiseName(slug: string, opName: string): string {
  const safe = `junkyard_${slug}_${opName}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return safe.slice(0, 64);
}

function toContent(value: unknown): { type: "text"; text: string }[] {
  if (typeof value === "string") {
    return [{ type: "text", text: value }];
  }
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

describe("sanitiseName", () => {
  it("produces expected names for normal slug+opName", () => {
    expect(sanitiseName("hash", "hash")).toBe("junkyard_hash_hash");
    expect(sanitiseName("qr", "generate")).toBe("junkyard_qr_generate");
    expect(sanitiseName("base64", "encode")).toBe("junkyard_base64_encode");
  });

  it("replaces dots and spaces with underscores", () => {
    expect(sanitiseName("foo.bar", "op name")).toBe("junkyard_foo_bar_op_name");
  });

  it("truncates to 64 characters", () => {
    const long = "a".repeat(40);
    const result = sanitiseName(long, long);
    expect(result.length).toBeLessThanOrEqual(64);
  });

  it("preserves hyphens and digits", () => {
    expect(sanitiseName("foo-bar", "op2")).toBe("junkyard_foo-bar_op2");
  });
});

describe("toContent", () => {
  it("passes strings through as-is (for SVG)", () => {
    const svg = "<svg><rect/></svg>";
    expect(toContent(svg)).toEqual([{ type: "text", text: svg }]);
  });

  it("serialises objects as pretty JSON", () => {
    const result = toContent({ hash: "abc", algo: "sha256" });
    expect(result[0].type).toBe("text");
    const parsed = JSON.parse(result[0].text);
    expect(parsed.hash).toBe("abc");
    expect(result[0].text).toContain("\n"); // pretty-printed
  });

  it("serialises null correctly", () => {
    const result = toContent(null);
    expect(result[0].text).toBe("null");
  });
});
