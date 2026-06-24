/**
 * Regression guard for the onDrop type-check in the video App.
 *
 * Bug: onDrop previously called handleFile(f) unconditionally. Dropping a
 * non-video file (image, PDF, etc.) silently accepted it, then the <video>
 * element would stall or error with no user feedback.
 *
 * Fix: onDrop now calls isVideoFile(f) and rejects if false.
 *
 * Perturbation proof: replacing the body of isVideoFile with `return true`
 * makes the "rejects non-video" cases below fail immediately. Restricting to
 * a single exact type (e.g. === "video/mp4") makes the webm/quicktime/matroska
 * cases fail. Restoring `startsWith("video/")` makes all cases pass.
 */
import { describe, expect, it } from "vitest";
import { isVideoFile } from "./dropGuard";

describe("isVideoFile — onDrop type guard", () => {
  it("accepts common video MIME types", () => {
    expect(isVideoFile({ type: "video/mp4" })).toBe(true);
    expect(isVideoFile({ type: "video/webm" })).toBe(true);
    expect(isVideoFile({ type: "video/quicktime" })).toBe(true);
    expect(isVideoFile({ type: "video/x-matroska" })).toBe(true);
    expect(isVideoFile({ type: "video/ogg" })).toBe(true);
  });

  it("rejects image files", () => {
    expect(isVideoFile({ type: "image/jpeg" })).toBe(false);
    expect(isVideoFile({ type: "image/png" })).toBe(false);
    expect(isVideoFile({ type: "image/webp" })).toBe(false);
  });

  it("rejects audio files", () => {
    expect(isVideoFile({ type: "audio/mp3" })).toBe(false);
    expect(isVideoFile({ type: "audio/mpeg" })).toBe(false);
    expect(isVideoFile({ type: "audio/wav" })).toBe(false);
  });

  it("rejects document and archive files", () => {
    expect(isVideoFile({ type: "application/pdf" })).toBe(false);
    expect(isVideoFile({ type: "text/plain" })).toBe(false);
    expect(isVideoFile({ type: "application/zip" })).toBe(false);
  });

  it("rejects empty type (browser may omit for unknown extensions)", () => {
    expect(isVideoFile({ type: "" })).toBe(false);
  });
});
