import { describe, expect, it } from "vitest";
import { buildQrContent, buildVCardString, buildWifiString } from "./qr";

describe("buildWifiString", () => {
  it("produces correct WIFI: string for WPA", () => {
    const result = buildWifiString({
      ssid: "MyNetwork",
      password: "secret",
      security: "WPA",
      hidden: false,
    });
    expect(result).toBe("WIFI:T:WPA;S:MyNetwork;P:secret;;");
  });

  it("omits password for open network", () => {
    const result = buildWifiString({
      ssid: "OpenNet",
      password: "",
      security: "nopass",
      hidden: false,
    });
    expect(result).toContain("T:nopass");
    expect(result).not.toContain("P:");
  });

  it("includes H:true for hidden networks", () => {
    const result = buildWifiString({
      ssid: "HiddenNet",
      password: "pass",
      security: "WPA",
      hidden: true,
    });
    expect(result).toContain("H:true");
  });

  it("escapes semicolons in SSID", () => {
    const result = buildWifiString({
      ssid: "Net;Work",
      password: "pass",
      security: "WPA",
      hidden: false,
    });
    expect(result).toContain("S:Net\\;Work");
  });

  it("does not escape backtick (not a special meCard char)", () => {
    const result = buildWifiString({
      ssid: "Net`Work",
      password: "pass",
      security: "WPA",
      hidden: false,
    });
    expect(result).toContain("S:Net`Work");
    expect(result).not.toContain("S:Net\\`Work");
  });
});

describe("buildVCardString", () => {
  it("produces a valid vCard 3.0 string with N: and FN: lines", () => {
    const result = buildVCardString({
      name: "Jane Smith",
      phone: "+1 555 0000",
      email: "jane@example.com",
      org: "Acme",
      url: "https://example.com",
    });
    expect(result).toContain("BEGIN:VCARD");
    expect(result).toContain("VERSION:3.0");
    // Canonical vCard 3.0 requires both structured N: and formatted FN:
    // barcode splits on last space: "Jane Smith" → firstName="Jane", lastName="Smith"
    expect(result).toContain("N:Smith;Jane;;;");
    expect(result).toContain("FN:Jane Smith");
    expect(result).toContain("TEL:+1 555 0000");
    expect(result).toContain("EMAIL:jane@example.com");
    expect(result).toContain("ORG:Acme");
    expect(result).toContain("URL:https://example.com");
    expect(result).toContain("END:VCARD");
  });

  it("omits empty fields", () => {
    const result = buildVCardString({
      name: "Jane",
      phone: "",
      email: "",
      org: "",
      url: "",
    });
    expect(result).not.toContain("TEL:");
    expect(result).not.toContain("EMAIL:");
    expect(result).not.toContain("ORG:");
    expect(result).not.toContain("URL:");
  });

  it("handles a single-word name (no space) - firstName only, lastName empty", () => {
    const result = buildVCardString({ name: "Madonna", phone: "", email: "", org: "", url: "" });
    expect(result).toContain("N:;Madonna;;;");
    expect(result).toContain("FN:Madonna");
  });
});

describe("buildQrContent", () => {
  it("returns raw text for text preset", () => {
    const dummy = { ssid: "", password: "", security: "WPA" as const, hidden: false };
    const dummyV = { name: "", phone: "", email: "", org: "", url: "" };
    expect(buildQrContent("text", "hello", dummy, dummyV)).toBe("hello");
  });

  it("prepends https:// when URL has no protocol", () => {
    const dummy = { ssid: "", password: "", security: "WPA" as const, hidden: false };
    const dummyV = { name: "", phone: "", email: "", org: "", url: "" };
    expect(buildQrContent("url", "example.com", dummy, dummyV)).toBe("https://example.com");
  });

  it("does not double-prepend https:// when already present", () => {
    const dummy = { ssid: "", password: "", security: "WPA" as const, hidden: false };
    const dummyV = { name: "", phone: "", email: "", org: "", url: "" };
    expect(buildQrContent("url", "https://example.com", dummy, dummyV)).toBe("https://example.com");
  });
});
