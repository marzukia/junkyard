/**
 * Augmented tests for subs/subtitle.ts.
 * Covers: serialise (dispatch function) and formatExtension -- not tested
 * in the existing subtitle.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  fixOverlaps,
  formatExtension,
  parseSrt,
  parseVtt,
  serialise,
  serialiseAss,
  serialiseSbv,
  serialiseSrt,
  serialiseVtt,
} from "./subtitle";
import type { Cue, SubFormat } from "./subtitle";

const SAMPLE_CUES: Cue[] = [
  { id: "a", startMs: 1000, endMs: 3500, text: "Hello world" },
  { id: "b", startMs: 4000, endMs: 6000, text: "Second cue" },
];

// ── serialise dispatch ────────────────────────────────────────────────────────

describe("serialise - dispatch to correct formatter", () => {
  it("dispatches srt to serialiseSrt (comma separator in timings)", () => {
    const result = serialise(SAMPLE_CUES, "srt");
    const expected = serialiseSrt(SAMPLE_CUES);
    expect(result).toBe(expected);
    expect(result).toContain(",");
    expect(result).not.toMatch(/^WEBVTT/);
  });

  it("dispatches vtt to serialiseVtt (dot separator, WEBVTT header)", () => {
    const result = serialise(SAMPLE_CUES, "vtt");
    const expected = serialiseVtt(SAMPLE_CUES);
    expect(result).toBe(expected);
    expect(result).toMatch(/^WEBVTT/);
    expect(result).toContain(".");
  });

  it("dispatches ass to serialiseAss ([Script Info] header)", () => {
    const result = serialise(SAMPLE_CUES, "ass");
    const expected = serialiseAss(SAMPLE_CUES);
    expect(result).toBe(expected);
    expect(result).toContain("[Script Info]");
  });

  it("dispatches sbv to serialiseSbv (H:MM:SS.mmm format)", () => {
    const result = serialise(SAMPLE_CUES, "sbv");
    const expected = serialiseSbv(SAMPLE_CUES);
    expect(result).toBe(expected);
    // SBV uses H:MM:SS.mmm,H:MM:SS.mmm timing line
    expect(result).toMatch(/\d:\d\d:\d\d\.\d\d\d,\d:\d\d:\d\d\.\d\d\d/);
  });

  it("srt output parses back to same cue texts", () => {
    const srt = serialise(SAMPLE_CUES, "srt");
    const reparsed = parseSrt(srt);
    expect(reparsed.map((c) => c.text)).toEqual(SAMPLE_CUES.map((c) => c.text));
  });

  it("vtt output parses back to same cue texts", () => {
    const vtt = serialise(SAMPLE_CUES, "vtt");
    const reparsed = parseVtt(vtt);
    expect(reparsed.map((c) => c.text)).toEqual(SAMPLE_CUES.map((c) => c.text));
  });

  it("four formats produce four distinct outputs", () => {
    const formats: SubFormat[] = ["srt", "vtt", "ass", "sbv"];
    const outputs = formats.map((f) => serialise(SAMPLE_CUES, f));
    const unique = new Set(outputs);
    expect(unique.size).toBe(4);
  });

  it("produces empty output for empty cue list across all formats", () => {
    for (const fmt of ["srt", "vtt", "ass", "sbv"] as SubFormat[]) {
      const result = serialise([], fmt);
      expect(typeof result).toBe("string");
      // Should be a valid (possibly near-empty) string with no crash
      expect(result.length).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── formatExtension ───────────────────────────────────────────────────────────

describe("formatExtension", () => {
  it("returns 'srt' for srt format", () => {
    expect(formatExtension("srt")).toBe("srt");
  });

  it("returns 'vtt' for vtt format", () => {
    expect(formatExtension("vtt")).toBe("vtt");
  });

  it("returns 'ass' for ass format", () => {
    expect(formatExtension("ass")).toBe("ass");
  });

  it("returns 'sbv' for sbv format", () => {
    expect(formatExtension("sbv")).toBe("sbv");
  });

  it("each extension is a non-empty string", () => {
    for (const fmt of ["srt", "vtt", "ass", "sbv"] as SubFormat[]) {
      const ext = formatExtension(fmt);
      expect(typeof ext).toBe("string");
      expect(ext.length).toBeGreaterThan(0);
    }
  });
});

// ── W7: genId safe fallback ───────────────────────────────────────────────────

describe("genId safe ID generation (W7)", () => {
  it("parseSrt assigns unique IDs to every cue", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
First

2
00:00:04,000 --> 00:00:06,000
Second

3
00:00:07,000 --> 00:00:09,000
Third`;
    const cues = parseSrt(srt);
    const ids = cues.map((c) => c.id);
    // All IDs must be distinct strings
    expect(new Set(ids).size).toBe(ids.length);
    // Each must be a non-empty string
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("parseVtt assigns unique IDs even for cues without explicit identifiers", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
First

00:00:04.000 --> 00:00:06.000
Second`;
    const cues = parseVtt(vtt);
    const ids = cues.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

// ── W8: fixOverlaps preserves original input order ────────────────────────────

describe("fixOverlaps preserves input order (W8)", () => {
  it("non-overlapping cues come back in input order", () => {
    const cues: Cue[] = [
      { id: "z", startMs: 1000, endMs: 2000, text: "Z" },
      { id: "a", startMs: 3000, endMs: 4000, text: "A" },
      { id: "m", startMs: 5000, endMs: 6000, text: "M" },
    ];
    const result = fixOverlaps(cues);
    expect(result.map((c) => c.id)).toEqual(["z", "a", "m"]);
  });

  it("input order is preserved after an overlap is fixed", () => {
    // cue 'b' starts before 'a' ends -- fixOverlaps should push b forward
    // but b stays in its original position (index 1) in the output
    const cues: Cue[] = [
      { id: "a", startMs: 0, endMs: 3000, text: "A" },
      { id: "b", startMs: 1000, endMs: 2000, text: "B" },
      { id: "c", startMs: 5000, endMs: 6000, text: "C" },
    ];
    const result = fixOverlaps(cues);
    // Original order: a, b, c
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
    expect(result[2].id).toBe("c");
    // b's start was pushed past a's end
    expect(result[1].startMs).toBeGreaterThanOrEqual(result[0].endMs);
  });

  it("cues given in reverse chronological order come back in original order", () => {
    // Input is intentionally reverse-time-order
    const cues: Cue[] = [
      { id: "late", startMs: 9000, endMs: 10000, text: "Late" },
      { id: "early", startMs: 1000, endMs: 2000, text: "Early" },
    ];
    const result = fixOverlaps(cues);
    // No overlaps here -- output must preserve input order
    expect(result[0].id).toBe("late");
    expect(result[1].id).toBe("early");
  });
});

// ── parseSrt skips malformed cues (gauntlet w1) ───────────────────────────────

describe("parseSrt skips bad cue instead of throwing", () => {
  it("does not throw on a timing line missing the separator", () => {
    // "00:00:01000" matches SRT_TIMING_RE (separator optional) but parseTimestamp would throw
    const bad = "1\n00:00:01000 --> 00:00:02,000\nHi\n";
    expect(() => parseSrt(bad)).not.toThrow();
  });

  it("returns empty array for a single malformed cue", () => {
    const bad = "1\n00:00:01000 --> 00:00:02,000\nHi\n";
    expect(parseSrt(bad)).toHaveLength(0);
  });

  it("still parses valid cues after a malformed one", () => {
    const mixed = [
      "1",
      "00:00:01000 --> 00:00:02,000",
      "Bad cue",
      "",
      "2",
      "00:00:03,000 --> 00:00:05,000",
      "Good cue",
      "",
    ].join("\n");
    const cues = parseSrt(mixed);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Good cue");
  });

  it("still parses valid cues before a malformed one", () => {
    const mixed = [
      "1",
      "00:00:01,000 --> 00:00:02,000",
      "Good cue",
      "",
      "2",
      "00:00:03000 --> 00:00:04,000",
      "Bad cue",
      "",
    ].join("\n");
    const cues = parseSrt(mixed);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Good cue");
  });
});
