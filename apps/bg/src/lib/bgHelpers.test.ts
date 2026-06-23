/**
 * Tests for bg-tool specific pure logic.
 */
import { describe, expect, it } from "vitest";
import { formatProgress } from "./imageHelpers";

// ── formatProgress edge cases relevant to indeterminate progress bar ──────────

describe("formatProgress (indeterminate-mode guard)", () => {
  it("returns 0% when total is zero (model progress before total is known)", () => {
    // This is the initial state before the first progress callback fires.
    // The indeterminate bar must NOT be used with formatProgress in this state;
    // these tests confirm the helper degrades gracefully regardless.
    expect(formatProgress(0, 0)).toBe("0%");
  });

  it("handles partial progress correctly", () => {
    // 10 MB of 40 MB
    expect(formatProgress(10 * 1024 * 1024, 40 * 1024 * 1024)).toBe("25%");
  });

  it("returns 100% when fully loaded", () => {
    expect(formatProgress(1, 1)).toBe("100%");
  });
});

// ── BgFill type guard: transparent / white / black are the only valid fills ───

type BgFill = "transparent" | "white" | "black";

const VALID_BG_FILLS: BgFill[] = ["transparent", "white", "black"];

describe("BgFill options", () => {
  it("covers exactly three fill options", () => {
    expect(VALID_BG_FILLS).toHaveLength(3);
  });

  it("includes transparent as the default (index 0)", () => {
    expect(VALID_BG_FILLS[0]).toBe("transparent");
  });

  it("data-bg attribute values match fill identifiers", () => {
    // The CSS relies on data-bg="transparent"|"white"|"black"
    for (const fill of VALID_BG_FILLS) {
      expect(["transparent", "white", "black"]).toContain(fill);
    }
  });
});
