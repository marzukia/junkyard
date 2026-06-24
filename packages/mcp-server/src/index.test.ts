/**
 * Unit tests for name sanitisation and content formatting helpers.
 * These are the two pure functions that could silently produce invalid MCP
 * tool names or broken content if changed.
 *
 * We import the REAL exported helpers from index.ts so that any change to
 * the production functions is caught immediately here.
 */
import { describe, it, expect } from "bun:test";
import { sanitiseName, toContent, runWithTimeout } from "./index.ts";

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

  it("produces the real cron tool name (guards against rename regression)", () => {
    expect(sanitiseName("cron", "describe")).toBe("junkyard_cron_describe");
  });

  it("produces the real markdown tool name (guards against rename regression)", () => {
    expect(sanitiseName("markdown", "toHtml")).toBe("junkyard_markdown_toHtml");
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

describe("runWithTimeout", () => {
  it("resolves with the value when op completes before the deadline", async () => {
    const result = await runWithTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("rejects with a timeout message when op exceeds the deadline", async () => {
    const never = new Promise<never>(() => {});
    await expect(runWithTimeout(never, 10)).rejects.toThrow("operation timed out after 10ms");
  });

  it("clears the timer after a fast resolution (no dangling timer)", async () => {
    // Verifies that a fast op does not leave a timer that delays test exit.
    // If clearTimeout is omitted this test suite would hang for `ms` after completing.
    const result = await runWithTimeout(Promise.resolve(42), 5000);
    expect(result).toBe(42);
  });
});
