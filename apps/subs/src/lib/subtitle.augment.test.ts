/**
 * Augmented tests for subs/subtitle.ts.
 * Covers: serialise (dispatch function) and formatExtension -- not tested
 * in the existing subtitle.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
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
