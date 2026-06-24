/**
 * Augmented tests for qr.ts covering qrPresetLabel (untested) and
 * additional negative/edge cases for buildQrContent and buildWifiString.
 */
import { describe, expect, it } from "vitest";
import {
  buildQrContent,
  buildVCardString,
  buildWifiString,
  qrPresetLabel,
} from "./qr";

// ── qrPresetLabel ─────────────────────────────────────────────────────────────

describe("qrPresetLabel", () => {
  it("returns 'Text' for text preset", () => {
    expect(qrPresetLabel("text")).toBe("Text");
  });

  it("returns 'URL' for url preset", () => {
    expect(qrPresetLabel("url")).toBe("URL");
  });

  it("returns 'WiFi' for wifi preset", () => {
    expect(qrPresetLabel("wifi")).toBe("WiFi");
  });

  it("returns 'Contact' for vcard preset", () => {
    expect(qrPresetLabel("vcard")).toBe("Contact");
  });
});

// ── buildWifiString additional edge cases ─────────────────────────────────────

describe("buildWifiString - additional edge cases", () => {
  it("produces correct WIFI string for WEP security", () => {
    const result = buildWifiString({
      ssid: "WepNet",
      password: "abc123",
      security: "WEP",
      hidden: false,
    });
    expect(result).toBe("WIFI:T:WEP;S:WepNet;P:abc123;;");
  });

  it("escapes backslash in SSID", () => {
    const result = buildWifiString({
      ssid: "Net\\Work",
      password: "pass",
      security: "WPA",
      hidden: false,
    });
    expect(result).toContain("S:Net\\\\Work");
  });

  it("escapes double-quote in password", () => {
    const result = buildWifiString({
      ssid: "Net",
      password: 'pa"ss',
      security: "WPA",
      hidden: false,
    });
    expect(result).toContain('P:pa\\"ss');
  });

  it("handles empty SSID without throwing", () => {
    const result = buildWifiString({
      ssid: "",
      password: "",
      security: "nopass",
      hidden: false,
    });
    expect(result).toContain("T:nopass");
    expect(typeof result).toBe("string");
  });
});

// ── buildVCardString additional edge cases ─────────────────────────────────────

describe("buildVCardString - additional edge cases", () => {
  it("always emits N: and FN: lines (vCard 3.0 requires both, even when name is empty)", () => {
    // Old behaviour omitted FN: when name was blank; canonical always emits both
    // per RFC 2426 §3.1 — N: and FN: are REQUIRED properties.
    const result = buildVCardString({ name: "", phone: "123", email: "", org: "", url: "" });
    expect(result).toContain("N:");
    expect(result).toContain("FN:");
    expect(result).toContain("TEL:123");
  });

  it("always begins with BEGIN:VCARD and ends with END:VCARD even for empty input", () => {
    const result = buildVCardString({ name: "", phone: "", email: "", org: "", url: "" });
    expect(result.trim().startsWith("BEGIN:VCARD")).toBe(true);
    expect(result.trim().endsWith("END:VCARD")).toBe(true);
  });
});

// ── buildQrContent - additional cases ────────────────────────────────────────

describe("buildQrContent - additional cases", () => {
  const dummyWifi = { ssid: "", password: "", security: "WPA" as const, hidden: false };
  const dummyVcard = { name: "", phone: "", email: "", org: "", url: "" };

  it("does not prepend https:// when URL already has http://", () => {
    expect(buildQrContent("url", "http://example.com", dummyWifi, dummyVcard)).toBe(
      "http://example.com"
    );
  });

  it("does not prepend https:// when URL has ftp:// protocol", () => {
    expect(buildQrContent("url", "ftp://files.example.com", dummyWifi, dummyVcard)).toBe(
      "ftp://files.example.com"
    );
  });

  it("returns empty string for empty url preset input", () => {
    expect(buildQrContent("url", "", dummyWifi, dummyVcard)).toBe("");
  });

  it("returns empty string for empty text preset input", () => {
    expect(buildQrContent("text", "", dummyWifi, dummyVcard)).toBe("");
  });

  it("wifi preset delegates to buildWifiString with the wifi param", () => {
    const wifi = { ssid: "MyNet", password: "secret", security: "WPA" as const, hidden: false };
    const result = buildQrContent("wifi", "", wifi, dummyVcard);
    expect(result).toBe(buildWifiString(wifi));
  });

  it("vcard preset delegates to buildVCardString with the vcard param", () => {
    const vcard = { name: "Joe", phone: "123", email: "j@x.com", org: "X", url: "x.com" };
    const result = buildQrContent("vcard", "", dummyWifi, vcard);
    expect(result).toBe(buildVCardString(vcard));
  });
});
