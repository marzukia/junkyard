/**
 * Content-type templates for QR code payload assembly.
 * Each template assembles a standardised string from structured fields.
 * Pure functions - no side effects, easily testable.
 *
 * WiFi and vCard builders delegate to the canonical kit/lib/qrContent.ts
 * (vendored here as ./qrContent). Edit the canonical; run vendor-qrcontent.mjs.
 */

export type ContentType = "url" | "wifi" | "vcard" | "email" | "sms" | "phone";

export interface WifiFields {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface VCardFields {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  organisation: string;
  url: string;
}

export interface EmailFields {
  to: string;
  subject: string;
  body: string;
}

export interface SmsFields {
  to: string;
  message: string;
}

export interface PhoneFields {
  number: string;
}

// Re-export from the canonical so callers that import these from templates.ts
// continue to work without import-path changes.
export {
  buildVCardPayload,
  buildWifiPayload,
  escapeWifiField,
} from "@junkyardsh/kit";

/** Assembles a mailto: URI for email QR codes. */
export function buildEmailPayload(fields: EmailFields): string {
  const params: string[] = [];
  if (fields.subject) params.push(`subject=${encodeURIComponent(fields.subject)}`);
  if (fields.body) params.push(`body=${encodeURIComponent(fields.body)}`);
  const qs = params.length > 0 ? `?${params.join("&")}` : "";
  return `mailto:${fields.to}${qs}`;
}

/** Assembles an smsto: URI for SMS QR codes. */
export function buildSmsPayload(fields: SmsFields): string {
  if (fields.message) {
    return `smsto:${fields.to}:${fields.message}`;
  }
  return `smsto:${fields.to}`;
}

/** Assembles a tel: URI for phone QR codes. */
export function buildPhonePayload(fields: PhoneFields): string {
  return `tel:${fields.number}`;
}

/** Returns a user-friendly label for each content type. */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  url: "URL",
  wifi: "Wi-Fi",
  vcard: "Contact",
  email: "Email",
  sms: "SMS",
  phone: "Phone",
};

/** Returns the QR capacity limit that triggers the overflow message. */
export const QR_MAX_BYTES = 2953; // max for binary, version 40, EC level L

/**
 * Estimates whether a string will exceed QR capacity at the given EC level.
 * Uses byte length (UTF-8) as a conservative bound.
 */
export function willExceedCapacity(text: string, ecLevel: "L" | "M" | "Q" | "H"): boolean {
  const byteLen = new TextEncoder().encode(text).length;
  // Conservative capacity limits by EC level (binary mode, version 40)
  const limits: Record<string, number> = {
    L: 2953,
    M: 2331,
    Q: 1663,
    H: 1273,
  };
  return byteLen > (limits[ecLevel] ?? 1273);
}
