/**
 * QR code content builders and helpers.
 *
 * The `qrcode` npm package handles actual rendering (to SVG/data-URL);
 * this module provides pure string builders for structured content types
 * and the type definitions used across the QR UI.
 *
 * WiFi and vCard payload assembly delegates to the canonical kit/lib/qrContent.ts
 * (vendored as ./qrContent). Edit the canonical; run vendor-qrcontent.mjs.
 */

import { buildVCardPayload, buildWifiPayload } from "@junkyardsh/ui";

export type QrPreset = "text" | "url" | "wifi" | "vcard";

export interface QrWifiOptions {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface QrVCardOptions {
  /** Full display name, e.g. "Jane Smith". Used for both FN: and N: lines. */
  name: string;
  phone: string;
  email: string;
  org: string;
  url: string;
}

/** Build a WiFi QR string per the meCard Wi-Fi standard. */
export function buildWifiString(opts: QrWifiOptions): string {
  return buildWifiPayload(opts);
}

/**
 * Build a vCard 3.0 QR string.
 * The barcode app collects a single full-name field; we split on the last
 * space to derive firstName/lastName for the structured N: line.
 * If the name has no space, it goes into firstName with lastName empty.
 */
export function buildVCardString(opts: QrVCardOptions): string {
  const spaceIdx = opts.name.lastIndexOf(" ");
  const firstName = spaceIdx >= 0 ? opts.name.slice(0, spaceIdx) : opts.name;
  const lastName = spaceIdx >= 0 ? opts.name.slice(spaceIdx + 1) : "";
  return buildVCardPayload({
    firstName,
    lastName,
    phone: opts.phone,
    email: opts.email,
    organisation: opts.org,
    url: opts.url,
  });
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
