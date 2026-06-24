/**
 * Canonical WiFi (WIFI: meCard) and vCard 3.0 QR payload builders.
 *
 * Vendored into apps/qr/src/lib/qrContent.ts and apps/barcode/src/lib/qrContent.ts
 * by scripts/vendor-qrcontent.mjs. Edit the canonical here; run the vendor script to
 * propagate. The CI guard in deploy-pages.yml catches drift.
 *
 * Spec decisions:
 *   WiFi escape: backslash-escape `\ ; , " :` — exactly the set the ZXing/meCard
 *     de-facto standard requires. Backtick and dot are NOT special and are NOT escaped.
 *   WiFi format: WIFI:T:<auth>;S:<ssid>;P:<pass>;H:<hidden>;; — trailing ";;" per the
 *     de-facto ZXing standard; H: is always emitted when true, omitted when false.
 *     nopass networks omit the P: segment entirely.
 *   vCard 3.0: both the structured N:Last;First;;; line AND the formatted FN:First Last
 *     line are required by RFC 2426 §3.1. All optional fields (ORG/TEL/EMAIL/URL) are
 *     omitted when blank.
 */

// ── WiFi ─────────────────────────────────────────────────────────────────────

export interface WifiPayloadFields {
  ssid: string;
  password: string;
  /** "WPA" covers WPA/WPA2/WPA3; "WEP" for legacy; "nopass" for open networks. */
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

/**
 * Escapes special characters in a WiFi SSID or password field.
 * The meCard Wi-Fi standard requires backslash-escaping: \ ; , " :
 * Backtick and dot are NOT special and are left unescaped.
 */
export function escapeWifiField(value: string): string {
  return value.replace(/[\\;,":]/g, (c) => `\\${c}`);
}

/**
 * Builds a WiFi QR payload string in the meCard WIFI: format.
 * Output example: WIFI:T:WPA;S:MyNet;P:secret;;
 * With hidden:    WIFI:T:WPA;S:MyNet;P:secret;H:true;;
 */
export function buildWifiPayload(fields: WifiPayloadFields): string {
  const ssid = escapeWifiField(fields.ssid);
  const hidden = fields.hidden ? "H:true;" : "";
  // nopass networks have no password; omit P: to avoid leaking any value the
  // user may have typed before switching security mode.
  const passwordSegment =
    fields.security === "nopass" ? "" : `P:${escapeWifiField(fields.password)};`;
  return `WIFI:T:${fields.security};S:${ssid};${passwordSegment}${hidden};`;
}

// ── vCard 3.0 ─────────────────────────────────────────────────────────────────

export interface VCardPayloadFields {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  organisation: string;
  url: string;
}

/**
 * Builds a vCard 3.0 QR payload string per RFC 2426.
 * Always emits both the structured N: line and the formatted FN: line.
 * Optional fields (TEL/EMAIL/ORG/URL) are omitted when blank.
 */
export function buildVCardPayload(fields: VCardPayloadFields): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${fields.lastName};${fields.firstName};;;`,
    `FN:${`${fields.firstName} ${fields.lastName}`.trim()}`,
  ];
  if (fields.phone) lines.push(`TEL:${fields.phone}`);
  if (fields.email) lines.push(`EMAIL:${fields.email}`);
  if (fields.organisation) lines.push(`ORG:${fields.organisation}`);
  if (fields.url) lines.push(`URL:${fields.url}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}
