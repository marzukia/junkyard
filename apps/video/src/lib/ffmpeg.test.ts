import { describe, expect, it } from "vitest";
import { formatBytes, formatTime, parseTime } from "./ffmpeg";

describe("parseTime", () => {
  it("parses plain seconds", () => {
    expect(parseTime("90")).toBe(90);
    expect(parseTime("0")).toBe(0);
    expect(parseTime("3.5")).toBe(3.5);
  });

  it("parses MM:SS format", () => {
    expect(parseTime("1:30")).toBe(90);
    expect(parseTime("0:00")).toBe(0);
    expect(parseTime("10:05")).toBe(605);
  });

  it("parses HH:MM:SS format", () => {
    expect(parseTime("1:00:00")).toBe(3600);
    expect(parseTime("0:01:30")).toBe(90);
    expect(parseTime("2:30:15")).toBe(9015);
  });

  it("returns 0 for invalid input", () => {
    expect(parseTime("abc")).toBe(0);
    expect(parseTime("1:xx")).toBe(0);
  });
});

describe("formatTime", () => {
  it("formats seconds under one minute as M:SS", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats one minute and above as M:SS", () => {
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(90)).toBe("1:30");
    expect(formatTime(605)).toBe("10:05");
  });

  it("formats one hour and above as H:MM:SS", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(9015)).toBe("2:30:15");
  });

  it("round-trips through parseTime", () => {
    const seconds = [0, 45, 90, 3600, 7261];
    for (const s of seconds) {
      expect(parseTime(formatTime(s))).toBe(s);
    }
  });
});

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });
});
