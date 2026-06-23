import { describe, expect, it } from "vitest";
import { mobileWarningMessage } from "./MobileWarning";

describe("mobileWarningMessage", () => {
  // Non-phone: always null regardless of tags
  it("returns null when not a phone", () => {
    expect(mobileWarningMessage(["on-device-ai", "large-download"], false, false)).toBeNull();
  });

  it("returns null when not a phone and webgpu tag present", () => {
    expect(mobileWarningMessage(["webgpu"], false, false)).toBeNull();
  });

  // Dismissed: always null
  it("returns null when dismissed", () => {
    expect(mobileWarningMessage(["on-device-ai"], true, true)).toBeNull();
  });

  it("returns null when dismissed even with webgpu", () => {
    expect(mobileWarningMessage(["webgpu", "large-download"], true, true)).toBeNull();
  });

  // Non-heavy tags: null on phone
  it("returns null for empty tags on phone", () => {
    expect(mobileWarningMessage([], true, false)).toBeNull();
  });

  it("returns null for non-heavy tag on phone", () => {
    expect(mobileWarningMessage(["beta"], true, false)).toBeNull();
  });

  // webgpu takes precedence over on-device-ai
  it("returns webgpu message when both webgpu and on-device-ai present", () => {
    const msg = mobileWarningMessage(["webgpu", "on-device-ai", "large-download"], true, false);
    expect(msg).toContain("WebGPU");
    expect(msg).not.toContain("downloads and runs an AI model");
  });

  // on-device-ai takes precedence over large-download (no webgpu)
  it("returns on-device-ai message when on-device-ai present without webgpu", () => {
    const msg = mobileWarningMessage(["on-device-ai", "large-download"], true, false);
    expect(msg).toContain("downloads and runs an AI model");
    expect(msg).not.toContain("WebGPU");
  });

  // large-download alone
  it("returns large-download message when only large-download tag present", () => {
    const msg = mobileWarningMessage(["large-download"], true, false);
    expect(msg).toContain("large engine");
    expect(msg).not.toContain("WebGPU");
    expect(msg).not.toContain("AI model");
  });

  // webgpu alone
  it("returns webgpu message when only webgpu tag present", () => {
    const msg = mobileWarningMessage(["webgpu"], true, false);
    expect(msg).toContain("WebGPU");
  });

  // on-device-ai alone
  it("returns on-device-ai message when only on-device-ai tag present", () => {
    const msg = mobileWarningMessage(["on-device-ai"], true, false);
    expect(msg).toContain("downloads and runs an AI model");
  });
});
