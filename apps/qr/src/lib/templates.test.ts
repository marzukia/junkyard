import { describe, expect, it } from "vitest";
import {
  buildEmailPayload,
  buildPhonePayload,
  buildSmsPayload,
  buildVCardPayload,
  buildWifiPayload,
  escapeWifiField,
  willExceedCapacity,
} from "./templates";

describe("escapeWifiField", () => {
  it("passes through plain alphanumeric strings unchanged", () => {
    expect(escapeWifiField("MyNetwork123")).toBe("MyNetwork123");
  });

  it("escapes backslash", () => {
    expect(escapeWifiField("pa\\ss")).toBe("pa\\\\ss");
  });

  it("escapes semicolon", () => {
    expect(escapeWifiField("pa;ss")).toBe("pa\\;ss");
  });

  it("escapes comma", () => {
    expect(escapeWifiField("pa,ss")).toBe("pa\\,ss");
  });

  it("escapes double-quote", () => {
    expect(escapeWifiField('pa"ss')).toBe('pa\\"ss');
  });

  it("escapes colon", () => {
    expect(escapeWifiField("pa:ss")).toBe("pa\\:ss");
  });
});

describe("buildWifiPayload", () => {
  it("builds a WPA payload", () => {
    expect(
      buildWifiPayload({ ssid: "HomeNet", password: "secret", security: "WPA", hidden: false })
    ).toBe("WIFI:T:WPA;S:HomeNet;P:secret;;");
  });

  it("includes hidden flag when true", () => {
    const result = buildWifiPayload({
      ssid: "HiddenNet",
      password: "pw",
      security: "WPA",
      hidden: true,
    });
    expect(result).toContain("H:true;");
  });

  it("handles nopass security - omits P: segment", () => {
    const result = buildWifiPayload({
      ssid: "OpenNet",
      password: "",
      security: "nopass",
      hidden: false,
    });
    expect(result).not.toContain("P:");
    expect(result).toBe("WIFI:T:nopass;S:OpenNet;;");
  });

  it("nopass does not leak password even when one is supplied", () => {
    // User typed a password then switched to nopass - must not appear in payload
    const result = buildWifiPayload({
      ssid: "net",
      password: "secret",
      security: "nopass",
      hidden: false,
    });
    expect(result).not.toContain("secret");
    expect(result).not.toContain("P:");
  });

  it("escapes special chars in SSID and password", () => {
    const result = buildWifiPayload({
      ssid: "My;Net",
      password: "p:ass",
      security: "WPA",
      hidden: false,
    });
    expect(result).toContain("S:My\\;Net");
    expect(result).toContain("P:p\\:ass");
  });
});

describe("buildVCardPayload", () => {
  it("starts and ends with vCard markers", () => {
    const result = buildVCardPayload({
      firstName: "Jane",
      lastName: "Doe",
      phone: "+1234567890",
      email: "jane@example.com",
      organisation: "ACME",
      url: "https://example.com",
    });
    expect(result).toMatch(/^BEGIN:VCARD/);
    expect(result).toMatch(/END:VCARD$/);
  });

  it("includes name fields", () => {
    const result = buildVCardPayload({
      firstName: "Jane",
      lastName: "Doe",
      phone: "",
      email: "",
      organisation: "",
      url: "",
    });
    expect(result).toContain("N:Doe;Jane;;;");
    expect(result).toContain("FN:Jane Doe");
  });

  it("omits optional fields when blank", () => {
    const result = buildVCardPayload({
      firstName: "Jane",
      lastName: "Doe",
      phone: "",
      email: "",
      organisation: "",
      url: "",
    });
    expect(result).not.toContain("TEL:");
    expect(result).not.toContain("EMAIL:");
    expect(result).not.toContain("ORG:");
    expect(result).not.toContain("URL:");
  });

  it("includes optional fields when provided", () => {
    const result = buildVCardPayload({
      firstName: "Jane",
      lastName: "Doe",
      phone: "555-1234",
      email: "jane@test.com",
      organisation: "Corp",
      url: "https://jane.com",
    });
    expect(result).toContain("TEL:555-1234");
    expect(result).toContain("EMAIL:jane@test.com");
    expect(result).toContain("ORG:Corp");
    expect(result).toContain("URL:https://jane.com");
  });
});

describe("buildEmailPayload", () => {
  it("builds a plain mailto with just address", () => {
    expect(buildEmailPayload({ to: "test@example.com", subject: "", body: "" })).toBe(
      "mailto:test@example.com"
    );
  });

  it("includes subject and body as query params", () => {
    const result = buildEmailPayload({
      to: "test@example.com",
      subject: "Hello World",
      body: "Hi there",
    });
    expect(result).toContain("subject=Hello%20World");
    expect(result).toContain("body=Hi%20there");
  });

  it("includes only subject when body is empty", () => {
    const result = buildEmailPayload({ to: "a@b.com", subject: "Sub", body: "" });
    expect(result).toBe("mailto:a@b.com?subject=Sub");
  });
});

describe("buildSmsPayload", () => {
  it("builds smsto with message", () => {
    expect(buildSmsPayload({ to: "+15551234", message: "Hello" })).toBe("smsto:+15551234:Hello");
  });

  it("builds smsto without message when blank", () => {
    expect(buildSmsPayload({ to: "+15551234", message: "" })).toBe("smsto:+15551234");
  });
});

describe("buildPhonePayload", () => {
  it("builds tel: URI", () => {
    expect(buildPhonePayload({ number: "+15551234567" })).toBe("tel:+15551234567");
  });
});

describe("willExceedCapacity", () => {
  it("returns false for short strings", () => {
    expect(willExceedCapacity("https://example.com", "M")).toBe(false);
  });

  it("returns true for a string that exceeds L capacity", () => {
    // 3000 chars > 2953 limit for L
    const longText = "A".repeat(3000);
    expect(willExceedCapacity(longText, "L")).toBe(true);
  });

  it("returns true for a string exceeding H capacity but not L capacity", () => {
    // 2000 chars > H limit (1273) but < L limit (2953)
    const medText = "A".repeat(2000);
    expect(willExceedCapacity(medText, "H")).toBe(true);
    expect(willExceedCapacity(medText, "L")).toBe(false);
  });
});
