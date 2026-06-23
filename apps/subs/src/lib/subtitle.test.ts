import { describe, expect, it } from "vitest";
import {
  countMatches,
  detectFormat,
  findReplace,
  fixOverlaps,
  formatTimestampAss,
  formatTimestampSrt,
  formatTimestampVtt,
  linearSync,
  mightContainSubtitles,
  parseAss,
  parseSbv,
  parseSrt,
  parseTimestamp,
  parseVtt,
  serialiseAss,
  serialiseSbv,
  serialiseSrt,
  serialiseVtt,
  shiftCues,
  shiftSelected,
} from "./subtitle";

// ── parseTimestamp ──────────────────────────────────────────────────────────

describe("parseTimestamp", () => {
  it("parses SRT comma separator", () => {
    expect(parseTimestamp("00:00:01,500")).toBe(1500);
  });

  it("parses VTT dot separator", () => {
    expect(parseTimestamp("00:01:30.000")).toBe(90_000);
  });

  it("parses hours correctly", () => {
    expect(parseTimestamp("01:00:00,000")).toBe(3_600_000);
  });

  it("throws on invalid format", () => {
    expect(() => parseTimestamp("bad")).toThrow();
  });
});

// ── formatTimestampSrt ───────────────────────────────────────────────────────

describe("formatTimestampSrt", () => {
  it("formats zero", () => {
    expect(formatTimestampSrt(0)).toBe("00:00:00,000");
  });

  it("formats 1h 2m 3s 456ms", () => {
    expect(formatTimestampSrt(3_600_000 + 2 * 60_000 + 3_000 + 456)).toBe("01:02:03,456");
  });

  it("clamps negative to 0", () => {
    expect(formatTimestampSrt(-500)).toBe("00:00:00,000");
  });
});

// ── formatTimestampVtt ───────────────────────────────────────────────────────

describe("formatTimestampVtt", () => {
  it("uses dot separator", () => {
    expect(formatTimestampVtt(1500)).toBe("00:00:01.500");
  });
});

// ── parseSrt ─────────────────────────────────────────────────────────────────

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,000 --> 00:00:06,000
Second line
with two rows

3
00:00:07,000 --> 00:00:09,000
Third cue
`;

describe("parseSrt", () => {
  it("parses three cues", () => {
    const cues = parseSrt(SAMPLE_SRT);
    expect(cues).toHaveLength(3);
  });

  it("parses start/end ms correctly", () => {
    const [first] = parseSrt(SAMPLE_SRT);
    expect(first.startMs).toBe(1000);
    expect(first.endMs).toBe(3500);
  });

  it("preserves multi-line text", () => {
    const cues = parseSrt(SAMPLE_SRT);
    expect(cues[1].text).toBe("Second line\nwith two rows");
  });

  it("handles CRLF line endings", () => {
    const crlf = SAMPLE_SRT.replace(/\n/g, "\r\n");
    expect(parseSrt(crlf)).toHaveLength(3);
  });

  it("assigns unique ids", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const ids = new Set(cues.map((c) => c.id));
    expect(ids.size).toBe(3);
  });
});

// ── parseVtt ─────────────────────────────────────────────────────────────────

const SAMPLE_VTT = `WEBVTT

00:00:01.000 --> 00:00:03.500
Hello VTT

cue-2
00:00:04.000 --> 00:00:06.000
Second cue

`;

describe("parseVtt", () => {
  it("parses two cues", () => {
    expect(parseVtt(SAMPLE_VTT)).toHaveLength(2);
  });

  it("parses start ms", () => {
    const [first] = parseVtt(SAMPLE_VTT);
    expect(first.startMs).toBe(1000);
  });

  it("ignores WEBVTT header", () => {
    const cues = parseVtt(SAMPLE_VTT);
    expect(cues.every((c) => c.text !== "WEBVTT")).toBe(true);
  });
});

// ── detectFormat ─────────────────────────────────────────────────────────────

describe("detectFormat", () => {
  it("detects srt", () => {
    expect(detectFormat(SAMPLE_SRT)).toBe("srt");
  });

  it("detects vtt", () => {
    expect(detectFormat(SAMPLE_VTT)).toBe("vtt");
  });
});

// ── serialiseSrt ─────────────────────────────────────────────────────────────

describe("serialiseSrt", () => {
  it("round-trips through parseSrt", () => {
    const original = parseSrt(SAMPLE_SRT);
    const serialised = serialiseSrt(original);
    const reparsed = parseSrt(serialised);
    expect(reparsed).toHaveLength(original.length);
    expect(reparsed[0].startMs).toBe(original[0].startMs);
    expect(reparsed[0].text).toBe(original[0].text);
  });

  it("numbers from 1", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const out = serialiseSrt(cues);
    expect(out.startsWith("1\n")).toBe(true);
  });
});

// ── serialiseVtt ─────────────────────────────────────────────────────────────

describe("serialiseVtt", () => {
  it("starts with WEBVTT", () => {
    const cues = parseSrt(SAMPLE_SRT);
    expect(serialiseVtt(cues).startsWith("WEBVTT\n")).toBe(true);
  });

  it("uses dot separator in timings", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const out = serialiseVtt(cues);
    expect(out).toContain("00:00:01.000 --> 00:00:03.500");
  });
});

// ── shiftCues ─────────────────────────────────────────────────────────────────

describe("shiftCues", () => {
  it("shifts all cues by positive delta", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const shifted = shiftCues(cues, 2000);
    expect(shifted[0].startMs).toBe(3000);
    expect(shifted[0].endMs).toBe(5500);
  });

  it("shifts all cues by negative delta", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const shifted = shiftCues(cues, -500);
    expect(shifted[0].startMs).toBe(500);
  });

  it("clamps to 0 — never negative", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const shifted = shiftCues(cues, -999_999);
    expect(shifted.every((c) => c.startMs >= 0 && c.endMs >= 0)).toBe(true);
  });

  it("does not mutate the input array", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const originalStart = cues[0].startMs;
    shiftCues(cues, 5000);
    expect(cues[0].startMs).toBe(originalStart);
  });
});

// ── shiftSelected ─────────────────────────────────────────────────────────────

describe("shiftSelected", () => {
  it("only shifts selected cues", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const sel = new Set([cues[0].id]);
    const shifted = shiftSelected(cues, sel, 1000);
    expect(shifted[0].startMs).toBe(cues[0].startMs + 1000);
    expect(shifted[1].startMs).toBe(cues[1].startMs); // unchanged
  });
});

// ── fixOverlaps ───────────────────────────────────────────────────────────────

describe("fixOverlaps", () => {
  it("fixes an overlapping pair", () => {
    const cues = [
      { id: "a", startMs: 0, endMs: 5000, text: "A" },
      { id: "b", startMs: 3000, endMs: 7000, text: "B" }, // overlaps A
    ];
    const fixed = fixOverlaps(cues);
    expect(fixed[1].startMs).toBeGreaterThanOrEqual(fixed[0].endMs);
  });

  it("preserves duration of pushed cue", () => {
    const cues = [
      { id: "a", startMs: 0, endMs: 5000, text: "A" },
      { id: "b", startMs: 3000, endMs: 7000, text: "B" }, // 4 s duration
    ];
    const fixed = fixOverlaps(cues);
    const dur = fixed[1].endMs - fixed[1].startMs;
    expect(dur).toBe(4000);
  });

  it("does not mutate input", () => {
    const cues = [
      { id: "a", startMs: 0, endMs: 5000, text: "A" },
      { id: "b", startMs: 3000, endMs: 7000, text: "B" },
    ];
    fixOverlaps(cues);
    expect(cues[1].startMs).toBe(3000);
  });

  it("leaves non-overlapping cues unchanged", () => {
    const cues = [
      { id: "a", startMs: 0, endMs: 2000, text: "A" },
      { id: "b", startMs: 3000, endMs: 5000, text: "B" },
    ];
    const fixed = fixOverlaps(cues);
    expect(fixed[0].startMs).toBe(0);
    expect(fixed[1].startMs).toBe(3000);
  });
});

// ── parseAss ──────────────────────────────────────────────────────────────────

const SAMPLE_ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello ASS
Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,Second line with {\\b1}bold{\\b0}
`;

describe("parseAss", () => {
  it("parses two cues", () => {
    expect(parseAss(SAMPLE_ASS)).toHaveLength(2);
  });

  it("parses timestamps correctly (centisecond precision)", () => {
    const [first] = parseAss(SAMPLE_ASS);
    expect(first.startMs).toBe(1000);
    expect(first.endMs).toBe(3000);
  });

  it("strips inline override tags", () => {
    const cues = parseAss(SAMPLE_ASS);
    expect(cues[1].text).not.toContain("{");
    expect(cues[1].text).toContain("bold");
  });
});

describe("formatTimestampAss", () => {
  it("formats zero", () => {
    expect(formatTimestampAss(0)).toBe("0:00:00.00");
  });

  it("formats 1h 30s 750ms as centiseconds", () => {
    // 1h + 30s + 750ms = 3_600_000 + 30_000 + 750 = 3_630_750ms
    // centiseconds: 75cs
    expect(formatTimestampAss(3_630_750)).toBe("1:00:30.75");
  });
});

describe("serialiseAss / round-trip", () => {
  it("round-trips through parseAss", () => {
    const cues = parseAss(SAMPLE_ASS);
    const out = serialiseAss(cues);
    const reparsed = parseAss(out);
    expect(reparsed).toHaveLength(cues.length);
    expect(reparsed[0].startMs).toBe(cues[0].startMs);
  });
});

// ── parseSbv ──────────────────────────────────────────────────────────────────

const SAMPLE_SBV = `0:00:01.000,0:00:03.500
Hello SBV

0:00:04.000,0:00:06.000
Second cue
with two lines
`;

describe("parseSbv", () => {
  it("parses two cues", () => {
    expect(parseSbv(SAMPLE_SBV)).toHaveLength(2);
  });

  it("parses timestamps correctly", () => {
    const [first] = parseSbv(SAMPLE_SBV);
    expect(first.startMs).toBe(1000);
    expect(first.endMs).toBe(3500);
  });

  it("preserves multi-line text", () => {
    const cues = parseSbv(SAMPLE_SBV);
    expect(cues[1].text).toBe("Second cue\nwith two lines");
  });
});

describe("serialiseSbv / round-trip", () => {
  it("round-trips through parseSbv", () => {
    const cues = parseSbv(SAMPLE_SBV);
    const out = serialiseSbv(cues);
    const reparsed = parseSbv(out);
    expect(reparsed).toHaveLength(cues.length);
    expect(reparsed[0].startMs).toBe(cues[0].startMs);
    expect(reparsed[0].text).toBe(cues[0].text);
  });
});

// ── detectFormat (extended) ───────────────────────────────────────────────────

describe("detectFormat (extended)", () => {
  it("detects ass", () => {
    expect(detectFormat(SAMPLE_ASS)).toBe("ass");
  });

  it("detects sbv", () => {
    expect(detectFormat(SAMPLE_SBV)).toBe("sbv");
  });
});

// ── mightContainSubtitles ─────────────────────────────────────────────────────

describe("mightContainSubtitles", () => {
  it("returns true for SRT", () => {
    expect(mightContainSubtitles(SAMPLE_SRT)).toBe(true);
  });

  it("returns true for VTT", () => {
    expect(mightContainSubtitles(SAMPLE_VTT)).toBe(true);
  });

  it("returns false for random text", () => {
    expect(mightContainSubtitles("hello world\nthis is just text\nno timecodes here")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(mightContainSubtitles("")).toBe(false);
  });
});

// ── linearSync ────────────────────────────────────────────────────────────────

describe("linearSync", () => {
  it("applies identity transform (no change)", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const synced = linearSync(cues, 1000, 1000, 7000, 7000);
    expect(synced[0].startMs).toBe(cues[0].startMs);
    expect(synced[0].endMs).toBe(cues[0].endMs);
  });

  it("applies pure offset when scale is 1", () => {
    const cues = [{ id: "a", startMs: 5000, endMs: 8000, text: "A" }];
    // subA=0 should be at actualA=2000 => offset +2000ms, scale=1
    const synced = linearSync(cues, 0, 2000, 10000, 12000);
    expect(synced[0].startMs).toBe(7000);
    expect(synced[0].endMs).toBe(10000);
  });

  it("scales and offsets correctly", () => {
    // sub has cue at 2000ms, should be at 1000ms (sub is 2x fast)
    // subA=0->0, subB=4000->2000 => scale=0.5, offset=0
    const cues = [{ id: "a", startMs: 2000, endMs: 4000, text: "A" }];
    const synced = linearSync(cues, 0, 0, 4000, 2000);
    expect(synced[0].startMs).toBe(1000);
    expect(synced[0].endMs).toBe(2000);
  });

  it("clamps to 0 — never negative", () => {
    const cues = [{ id: "a", startMs: 100, endMs: 500, text: "A" }];
    const synced = linearSync(cues, 1000, 0, 2000, 0);
    expect(synced[0].startMs).toBe(0);
    expect(synced[0].endMs).toBe(0);
  });

  it("falls back to simple offset when subA === subB", () => {
    const cues = [{ id: "a", startMs: 1000, endMs: 3000, text: "A" }];
    // Would divide by zero; should apply offset = actualA - subA = 500 - 1000 = -500
    const synced = linearSync(cues, 1000, 500, 1000, 800);
    expect(synced[0].startMs).toBe(500); // 1000 - 500
  });
});

// ── findReplace ───────────────────────────────────────────────────────────────

describe("findReplace", () => {
  const cues = [
    { id: "a", startMs: 0, endMs: 1000, text: "Hello World" },
    { id: "b", startMs: 1000, endMs: 2000, text: "world peace" },
  ];

  it("replaces plain text case-insensitively by default", () => {
    const result = findReplace(cues, "world", "Earth", false, false);
    expect(result[0].text).toBe("Hello Earth");
    expect(result[1].text).toBe("Earth peace");
  });

  it("respects case-sensitive flag", () => {
    const result = findReplace(cues, "World", "Earth", false, true);
    expect(result[0].text).toBe("Hello Earth");
    expect(result[1].text).toBe("world peace"); // lowercase unchanged
  });

  it("supports regex mode", () => {
    const result = findReplace(cues, "\\bworld\\b", "Earth", true, false);
    expect(result[0].text).toBe("Hello Earth");
    expect(result[1].text).toBe("Earth peace");
  });

  it("returns same references for unmatched cues", () => {
    const result = findReplace(cues, "xyz", "abc", false, false);
    expect(result[0]).toBe(cues[0]);
    expect(result[1]).toBe(cues[1]);
  });

  it("returns cues unchanged if pattern is empty", () => {
    const result = findReplace(cues, "", "abc", false, false);
    expect(result).toEqual(cues);
  });

  it("handles invalid regex gracefully (no-op)", () => {
    const result = findReplace(cues, "[invalid", "abc", true, false);
    expect(result).toEqual(cues);
  });
});

// ── countMatches ──────────────────────────────────────────────────────────────

describe("countMatches", () => {
  const cues = [
    { id: "a", startMs: 0, endMs: 1000, text: "foo bar foo" },
    { id: "b", startMs: 1000, endMs: 2000, text: "baz foo" },
  ];

  it("counts all occurrences across cues", () => {
    expect(countMatches(cues, "foo", false, false)).toBe(3);
  });

  it("returns 0 for empty pattern", () => {
    expect(countMatches(cues, "", false, false)).toBe(0);
  });

  it("returns 0 for invalid regex", () => {
    expect(countMatches(cues, "[invalid", true, false)).toBe(0);
  });
});
