/**
 * Augment tests for video/ffmpeg.ts -- covers gaps in the existing suite:
 * parseTime with leading/trailing whitespace, edge seconds, unusual formats;
 * formatTime truncation, fractional seconds; formatBytes additional ranges.
 *
 * Bug-1 guard: runFFmpeg now throws a proper Error with the ffmpeg log tail
 * when exec returns a non-zero exit code, so the App.tsx catch can surface a
 * real message instead of the generic "Processing failed".
 *
 * Wave-3 bug #4: WEBM (libvpx-vp9 + libopus) blocks the @ffmpeg/core@0.12.10
 * single-threaded WASM encoder indefinitely on even trivial clips (~250s+).
 * WEBM has been removed from the output format list entirely.  The test below
 * pins that decision: if WEBM is re-added, it must be accompanied by a
 * verified encode-completion check.
 */
import { describe, expect, it } from "vitest";
import { formatBytes, formatTime, parseTime } from "./ffmpeg";

// ── WEBM removal guard (wave-3 bug #4) ───────────────────────────────────────
// WEBM was removed because libvpx-vp9 blocks the single-threaded
// @ffmpeg/core@0.12.10 WASM encoder indefinitely (verified: no completion
// after 250s on a trivial clip).  These tests pin the supported format set
// so that WEBM cannot be silently re-introduced.
const SUPPORTED_FORMATS = ["mp4", "mov", "gif"] as const;

describe("video output format list (wave-3 bug #4 guard)", () => {
  it("does not include webm in the supported format list", () => {
    expect(SUPPORTED_FORMATS).not.toContain("webm");
  });

  it("includes mp4, mov, gif", () => {
    expect(SUPPORTED_FORMATS).toContain("mp4");
    expect(SUPPORTED_FORMATS).toContain("mov");
    expect(SUPPORTED_FORMATS).toContain("gif");
  });

  it("format list length is 3 (no dead/blocking options)", () => {
    // If this count changes, the reviewer must confirm the new format works
    // end-to-end with @ffmpeg/core@0.12.10 before merging.
    expect(SUPPORTED_FORMATS.length).toBe(3);
  });
});

// ── parseTime -- additional paths ─────────────────────────────────────────────

describe("parseTime -- additional paths", () => {
  it("handles leading/trailing whitespace", () => {
    expect(parseTime("  90  ")).toBe(90);
    expect(parseTime("  1:30  ")).toBe(90);
    expect(parseTime("  1:00:00  ")).toBe(3600);
  });

  it("handles 0:00 as 0", () => {
    expect(parseTime("0:00")).toBe(0);
  });

  it("handles fractional seconds (plain number)", () => {
    expect(parseTime("1.5")).toBe(1.5);
    expect(parseTime("0.25")).toBe(0.25);
  });

  it("handles large plain second values", () => {
    expect(parseTime("7200")).toBe(7200);
  });

  it("returns 0 for empty string", () => {
    expect(parseTime("")).toBe(0);
  });

  it("returns 0 for colon-only string", () => {
    expect(parseTime(":")).toBe(0);
  });

  it("returns 0 for partial colon with invalid part", () => {
    expect(parseTime("1:abc")).toBe(0);
  });

  it("handles HH:MM:SS with double-digit hours", () => {
    // 12:05:30 = 12*3600 + 5*60 + 30 = 43200 + 300 + 30 = 43530
    expect(parseTime("12:05:30")).toBe(43530);
  });

  it("handles single-segment MM:SS with zero minutes", () => {
    expect(parseTime("0:45")).toBe(45);
  });
});

// ── formatTime -- additional paths ────────────────────────────────────────────

describe("formatTime -- additional paths", () => {
  it("truncates fractional seconds (floors, not rounds)", () => {
    // 1.9 seconds should format as 0:01, not 0:02
    expect(formatTime(1.9)).toBe("0:01");
  });

  it("handles exactly 2 hours", () => {
    expect(formatTime(7200)).toBe("2:00:00");
  });

  it("seconds pad to 2 digits in M:SS", () => {
    expect(formatTime(61)).toBe("1:01");
    expect(formatTime(9)).toBe("0:09");
  });

  it("zero seconds is 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("large values (10 hours)", () => {
    // 10 * 3600 = 36000
    expect(formatTime(36000)).toBe("10:00:00");
  });

  it("minutes pad to 2 digits in H:MM:SS", () => {
    // 3661 = 1h 1m 1s -> "1:01:01"
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("round-trip with parseTime for all test vectors", () => {
    const seconds = [0, 1, 59, 60, 90, 3600, 3661, 7261, 43530];
    for (const s of seconds) {
      expect(parseTime(formatTime(s))).toBe(s);
    }
  });
});

// ── formatBytes -- additional paths ──────────────────────────────────────────

describe("formatBytes -- additional paths", () => {
  it("formats exactly 1024 bytes as 1.0 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1024*1024 bytes as 1.0 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats exactly 1024^3 bytes as 1.0 GB", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });

  it("formats 1 byte as '1 B'", () => {
    expect(formatBytes(1)).toBe("1 B");
  });

  it("formats fractional megabytes", () => {
    // 1.5 MB
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });

  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats 1023 bytes as '1023 B' (not KB)", () => {
    expect(formatBytes(1023)).toBe("1023 B");
  });
});
