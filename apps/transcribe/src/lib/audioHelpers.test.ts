import { describe, expect, it } from "vitest";
import {
  ACCEPTED_AUDIO_TYPES,
  formatBytes,
  formatElapsed,
  formatJSON,
  formatProgress,
  formatSRT,
  formatTimestamp,
  formatVTT,
  isSupportedAudio,
} from "./audioHelpers";

describe("isSupportedAudio", () => {
  it("accepts MP3 files by MIME type", () => {
    const file = new File([""], "audio.mp3", { type: "audio/mpeg" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("accepts WAV files", () => {
    const file = new File([""], "audio.wav", { type: "audio/wav" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("accepts OGG files", () => {
    const file = new File([""], "audio.ogg", { type: "audio/ogg" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("accepts WebM files", () => {
    const file = new File([""], "audio.webm", { type: "audio/webm" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("accepts MP4 video files", () => {
    const file = new File([""], "video.mp4", { type: "video/mp4" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("accepts files by extension when MIME is generic", () => {
    const file = new File([""], "audio.mp3", { type: "application/octet-stream" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("accepts .m4a by extension", () => {
    const file = new File([""], "audio.m4a", { type: "application/octet-stream" });
    expect(isSupportedAudio(file)).toBe(true);
  });

  it("rejects PDF files", () => {
    const file = new File([""], "doc.pdf", { type: "application/pdf" });
    expect(isSupportedAudio(file)).toBe(false);
  });

  it("rejects image files", () => {
    const file = new File([""], "photo.jpg", { type: "image/jpeg" });
    expect(isSupportedAudio(file)).toBe(false);
  });

  it("rejects files with no extension and unknown MIME", () => {
    const file = new File([""], "unknown");
    expect(isSupportedAudio(file)).toBe(false);
  });

  it("covers all ACCEPTED_AUDIO_TYPES via MIME check", () => {
    for (const mime of ACCEPTED_AUDIO_TYPES) {
      const ext = mime.split("/")[1].split(";")[0];
      const file = new File([""], `test.${ext}`, { type: mime });
      expect(isSupportedAudio(file)).toBe(true);
    }
  });
});

describe("formatBytes", () => {
  it("formats bytes below 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats fractional MB", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});

describe("formatProgress", () => {
  it("returns 0% for zero total", () => {
    expect(formatProgress(0, 0)).toBe("0%");
  });

  it("returns correct percentage", () => {
    expect(formatProgress(50, 100)).toBe("50%");
  });

  it("caps at 100%", () => {
    expect(formatProgress(200, 100)).toBe("100%");
  });

  it("rounds to integer", () => {
    expect(formatProgress(1, 3)).toBe("33%");
  });
});

describe("formatTimestamp", () => {
  it("formats zero as 0:00", () => {
    expect(formatTimestamp(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatTimestamp(45)).toBe("0:45");
  });

  it("formats exactly one minute", () => {
    expect(formatTimestamp(60)).toBe("1:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatTimestamp(65)).toBe("1:05");
  });

  it("pads single-digit seconds", () => {
    expect(formatTimestamp(61)).toBe("1:01");
  });

  it("formats hours", () => {
    expect(formatTimestamp(3665)).toBe("1:01:05");
  });

  it("truncates fractional seconds", () => {
    expect(formatTimestamp(65.9)).toBe("1:05");
  });
});

describe("formatSRT", () => {
  it("produces valid SRT with two cues", () => {
    const chunks = [
      { start: 0, end: 3.5, text: "Hello world" },
      { start: 3.5, end: 7, text: "How are you" },
    ];
    const srt = formatSRT(chunks);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:03,500\nHello world");
    expect(srt).toContain("2\n00:00:03,500 --> 00:00:07,000\nHow are you");
  });

  it("falls back to start+2s when end is null", () => {
    const chunks = [{ start: 5, end: null, text: "Test" }];
    const srt = formatSRT(chunks);
    expect(srt).toContain("00:00:05,000 --> 00:00:07,000");
  });

  it("trims whitespace from chunk text", () => {
    const chunks = [{ start: 0, end: 1, text: "  trimmed  " }];
    expect(formatSRT(chunks)).toContain("\ntrimmed");
  });

  it("separates cues with a blank line", () => {
    const chunks = [
      { start: 0, end: 1, text: "A" },
      { start: 1, end: 2, text: "B" },
    ];
    expect(formatSRT(chunks)).toContain("A\n\n2\n");
  });
});

describe("formatVTT", () => {
  it("starts with WEBVTT header", () => {
    const chunks = [{ start: 0, end: 2, text: "Hi" }];
    expect(formatVTT(chunks)).toMatch(/^WEBVTT\n\n/);
  });

  it("uses dot separator instead of comma", () => {
    const chunks = [{ start: 1.5, end: 3, text: "Test" }];
    const vtt = formatVTT(chunks);
    expect(vtt).toContain("00:00:01.500 --> 00:00:03.000");
    expect(vtt).not.toContain(",");
  });

  it("falls back to start+2s when end is null", () => {
    const chunks = [{ start: 10, end: null, text: "X" }];
    expect(formatVTT(chunks)).toContain("00:00:10.000 --> 00:00:12.000");
  });
});

describe("formatJSON", () => {
  it("produces valid JSON with text and chunks fields", () => {
    const chunks = [{ start: 0, end: 2, text: "Hello" }];
    const json = JSON.parse(formatJSON("Hello", chunks));
    expect(json.text).toBe("Hello");
    expect(json.chunks).toHaveLength(1);
    expect(json.chunks[0].start).toBe(0);
    expect(json.chunks[0].text).toBe("Hello");
  });

  it("preserves null end in chunks", () => {
    const chunks = [{ start: 0, end: null, text: "A" }];
    const json = JSON.parse(formatJSON("A", chunks));
    expect(json.chunks[0].end).toBeNull();
  });

  it("handles empty chunks array", () => {
    const json = JSON.parse(formatJSON("plain text", []));
    expect(json.text).toBe("plain text");
    expect(json.chunks).toHaveLength(0);
  });
});

describe("formatElapsed", () => {
  it("formats zero as 0:00", () => {
    expect(formatElapsed(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatElapsed(45)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(65)).toBe("1:05");
  });

  it("pads single-digit seconds", () => {
    expect(formatElapsed(61)).toBe("1:01");
  });

  it("formats multi-hour elapsed", () => {
    // 90 minutes = 5400 seconds
    expect(formatElapsed(5400)).toBe("90:00");
  });
});
