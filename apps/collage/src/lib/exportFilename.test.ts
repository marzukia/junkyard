import { describe, expect, it, vi } from "vitest";
import { exportFilename } from "./exportFilename";

describe("exportFilename", () => {
  it("returns a PNG filename for format 'png'", () => {
    expect(exportFilename("png")).toMatch(/\.png$/);
  });

  it("returns a JPG filename for format 'jpg'", () => {
    expect(exportFilename("jpg")).toMatch(/\.jpg$/);
  });

  it("starts with 'collage-'", () => {
    expect(exportFilename("png")).toMatch(/^collage-/);
  });

  it("contains a date segment in YYYYMMDD-HHmmss format", () => {
    const name = exportFilename("png");
    // e.g. collage-20260622-143022.png
    expect(name).toMatch(/^collage-\d{8}-\d{6}\.(png|jpg)$/);
  });

  it("two calls with same mocked time return the same filename", () => {
    const fixed = new Date("2026-06-22T12:00:00.000Z");
    vi.setSystemTime(fixed);
    const a = exportFilename("png");
    const b = exportFilename("png");
    vi.useRealTimers();
    expect(a).toBe(b);
  });
});
