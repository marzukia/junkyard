/**
 * QR code content builders and helpers.
 *
 * The `qrcode` npm package handles actual rendering (to SVG/data-URL);
 * this module provides pure string builders for structured content types
 * and the type definitions used across the QR UI.
 */

export type QrPreset = "text" | "url" | "wifi" | "vcard";

export interface QrWifiOptions {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface QrVCardOptions {
  name: string;
  phone: string;
  email: string;
  org: string;
  url: string;
}

/** Build a WiFi QR string per the meCard Wi-Fi standard. */
export function buildWifiString(opts: QrWifiOptions): string {
  const escapeWifi = (s: string) => s.replace(/([\\;,":"])/g, "\\$1");
  const parts = [
    `T:${opts.security}`,
    `S:${escapeWifi(opts.ssid)}`,
    opts.security !== "nopass" ? `P:${escapeWifi(opts.password)}` : "",
    opts.hidden ? "H:true" : "",
  ]
    .filter(Boolean)
    .join(";");
  return `WIFI:${parts};;`;
}

/** Build a vCard 3.0 QR string. */
export function buildVCardString(opts: QrVCardOptions): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  if (opts.name) lines.push(`FN:${opts.name}`);
  if (opts.phone) lines.push(`TEL:${opts.phone}`);
  if (opts.email) lines.push(`EMAIL:${opts.email}`);
  if (opts.org) lines.push(`ORG:${opts.org}`);
  if (opts.url) lines.push(`URL:${opts.url}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/**
 * Returns the QR content string for a given preset plus form values.
 * For text/url presets, `raw` is used directly.
 */
export function buildQrContent(
  preset: QrPreset,
  raw: string,
  wifi: QrWifiOptions,
  vcard: QrVCardOptions
): string {
  switch (preset) {
    case "text":
      return raw;
    case "url":
      // Prepend https:// if no protocol given
      if (raw && !/^[a-z][a-z0-9+\-.]*:\/\//i.test(raw)) {
        return `https://${raw}`;
      }
      return raw;
    case "wifi":
      return buildWifiString(wifi);
    case "vcard":
      return buildVCardString(vcard);
  }
}

/** Returns a human-readable label for a QR preset. */
export function qrPresetLabel(preset: QrPreset): string {
  switch (preset) {
    case "text":
      return "Text";
    case "url":
      return "URL";
    case "wifi":
      return "WiFi";
    case "vcard":
      return "Contact";
  }
}
