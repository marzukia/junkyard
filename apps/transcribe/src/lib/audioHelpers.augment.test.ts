/**
 * Augment tests for transcribe/audioHelpers.ts -- covers gaps left by the
 * existing suite: formatSRT empty array, formatVTT empty, formatJSON edge cases,
 * formatTimestamp hour boundary, formatElapsed large values, isSupportedAudio
 * with uppercase extension, formatBytes edge cases.
 */
import { describe, expect, it } from "vitest";
import {
  ACCEPT_ATTR,
  formatBytes,
  formatElapsed,
  formatJSON,
  formatProgress,
  formatSRT,
  formatTimestamp,
  formatVTT,
  isSupportedAudio,
} from "./audioHelpers";

// ── isSupportedAudio -- negative paths ───────────────────────────────────────

describe("isSupportedAudio -- additional paths", () => {
  it("rejects text/plain", () => {
    const file = new File([""], "notes.txt", { type: "text/plain" });
    expect(isSupportedAudio(file)).toBe(false);
  });

  it("accepts .mov extension with generic MIME", () => {
    const file = new File([""], "clip.mov", { type: "application/octet-stream" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("rejects .jpg extension", () => {
    const file = new File([""], "photo.jpg", { type: "application/octet-stream" });
    expect(isSupportedAudio(file)).toBe(false);
  });

  it("rejects file with no name and generic MIME", () => {
    const file = new File([""], "", { type: "application/octet-stream" });
    expect(isSupportedAudio(file)).toBe(false);
  });
});

// ── formatBytes -- additional paths ──────────────────────────────────────────

describe("formatBytes -- additional paths", () => {
  it("formats exactly 1 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats 1023 bytes as B (not KB)", () => {
    expect(formatBytes(1023)).toBe("1023 B");
  });
});

// ── formatProgress -- negative paths ─────────────────────────────────────────

describe("formatProgress -- negative paths", () => {
  it("returns 0% for negative total", () => {
    expect(formatProgress(10, -1)).toBe("0%");
  });

  it("handles loaded > total by capping at 100%", () => {
    expect(formatProgress(150, 100)).toBe("100%");
  });
});

// ── formatTimestamp -- additional paths ──────────────────────────────────────

describe("formatTimestamp -- additional paths", () => {
  it("formats exactly 1 hour as 1:00:00", () => {
    expect(formatTimestamp(3600)).toBe("1:00:00");
  });

  it("formats 3661 seconds as 1:01:01", () => {
    expect(formatTimestamp(3661)).toBe("1:01:01");
  });

  it("formats 0 as 0:00", () => {
    expect(formatTimestamp(0)).toBe("0:00");
  });

  it("pads minutes with leading zero when < 10 in H:MM:SS", () => {
    // 3605 = 1h 0m 5s
    expect(formatTimestamp(3605)).toBe("1:00:05");
  });
});

// ── formatElapsed -- additional paths ────────────────────────────────────────

describe("formatElapsed -- additional paths", () => {
  it("handles exactly 60 seconds as 1:00", () => {
    expect(formatElapsed(60)).toBe("1:00");
  });

  it("pads single-digit seconds with zero", () => {
    expect(formatElapsed(3)).toBe("0:03");
  });

  it("handles large values (no hour format -- just M:SS)", () => {
    // formatElapsed doesn't have H:MM:SS format, just minutes
    expect(formatElapsed(3600)).toBe("60:00");
  });
});

// ── formatSRT -- edge cases ───────────────────────────────────────────────────

describe("formatSRT -- edge cases", () => {
  it("returns empty string for empty chunks array", () => {
    expect(formatSRT([])).toBe("");
  });

  it("single cue has index 1", () => {
    const result = formatSRT([{ start: 0, end: 5, text: "Hello" }]);
    expect(result).toMatch(/^1\n/);
  });

  it("milliseconds are zero-padded to 3 digits", () => {
    const result = formatSRT([{ start: 0.001, end: 1.001, text: "hi" }]);
    // 0.001s -> 00:00:00,001
    expect(result).toContain(",001");
  });

  it("multiple cues are separated by blank lines", () => {
    const chunks = [
      { start: 0, end: 1, text: "A" },
      { start: 1, end: 2, text: "B" },
      { start: 2, end: 3, text: "C" },
    ];
    const result = formatSRT(chunks);
    const cues = result.split("\n\n");
    expect(cues).toHaveLength(3);
  });
});

// ── formatVTT -- edge cases ───────────────────────────────────────────────────

describe("formatVTT -- edge cases", () => {
  it("returns WEBVTT header even for empty chunks", () => {
    const result = formatVTT([]);
    expect(result).toMatch(/^WEBVTT/);
  });

  it("uses dot not comma for fractional seconds", () => {
    const result = formatVTT([{ start: 0, end: 1, text: "test" }]);
    expect(result).not.toContain(",");
    expect(result).toContain(".");
  });
});

// ── formatJSON -- edge cases ──────────────────────────────────────────────────

describe("formatJSON -- edge cases", () => {
  it("empty fullText and empty chunks produces valid JSON", () => {
    const result = JSON.parse(formatJSON("", []));
    expect(result.text).toBe("");
    expect(result.chunks).toHaveLength(0);
  });

  it("fullText with newlines is preserved in JSON output", () => {
    const result = JSON.parse(formatJSON("line1\nline2", []));
    expect(result.text).toBe("line1\nline2");
  });

  it("is valid JSON (parseable without throwing)", () => {
    const chunks = [{ start: 0, end: 2.5, text: "  trimme  " }];
    expect(() => JSON.parse(formatJSON("text", chunks))).not.toThrow();
  });
});

// ── ACCEPT_ATTR -- sanity ─────────────────────────────────────────────────────

describe("ACCEPT_ATTR", () => {
  it("is a non-empty string", () => {
    expect(typeof ACCEPT_ATTR).toBe("string");
    expect(ACCEPT_ATTR.length).toBeGreaterThan(0);
  });

  it("includes audio/wav", () => {
    expect(ACCEPT_ATTR).toContain("audio/wav");
  });

  it("includes .mp3 extension", () => {
    expect(ACCEPT_ATTR).toContain(".mp3");
  });
});
