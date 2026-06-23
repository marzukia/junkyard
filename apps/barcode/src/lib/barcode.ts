/**
 * Pure validation and metadata helpers for barcode generation.
 *
 * JsBarcode renders to a DOM element (SVG/canvas), so generation itself happens
 * in the React component via a ref. This module contains the format definitions,
 * input validation, and EAN/UPC check-digit logic that can be unit-tested without
 * a DOM.
 */

export type BarcodeFormat = "CODE128" | "EAN13" | "UPC" | "EAN8" | "CODE39" | "CODE93" | "ITF";

export interface FormatMeta {
  label: string;
  description: string;
  placeholder: string;
  /** Returns null if valid, or a human-readable error string. */
  validate: (value: string) => string | null;
  /** Minimum display width (px). */
  minWidth: number;
}

// ── EAN-13 check digit ─────────────────────────────────────────────────────

/** Compute the EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(digits: string): number {
  if (digits.length !== 12) throw new Error("Expected 12 digits");
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a full 13-digit EAN-13 string (includes check digit). */
export function validateEan13(value: string): string | null {
  if (!/^\d{13}$/.test(value)) return "EAN-13 must be exactly 13 digits (0-9).";
  const expected = ean13CheckDigit(value.slice(0, 12));
  if (Number(value[12]) !== expected) {
    return `Invalid check digit. Expected ${expected}, got ${value[12]}.`;
  }
  return null;
}

/**
 * If exactly 12 digits are given, auto-append the EAN-13 check digit.
 * Returns { value, appended } where appended is true when a digit was added.
 */
export function ean13Autofix(value: string): { value: string; appended: boolean } {
  if (/^\d{12}$/.test(value)) {
    return { value: value + ean13CheckDigit(value), appended: true };
  }
  return { value, appended: false };
}

// ── UPC-A check digit ──────────────────────────────────────────────────────

/** Compute the UPC-A check digit for the first 11 digits. */
export function upcaCheckDigit(digits: string): number {
  if (digits.length !== 11) throw new Error("Expected 11 digits");
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a full 12-digit UPC-A string (includes check digit). */
export function validateUpca(value: string): string | null {
  if (!/^\d{12}$/.test(value)) return "UPC-A must be exactly 12 digits (0-9).";
  const expected = upcaCheckDigit(value.slice(0, 11));
  if (Number(value[11]) !== expected) {
    return `Invalid check digit. Expected ${expected}, got ${value[11]}.`;
  }
  return null;
}

/**
 * If exactly 11 digits are given, auto-append the UPC-A check digit.
 * Returns { value, appended } where appended is true when a digit was added.
 */
export function upcaAutofix(value: string): { value: string; appended: boolean } {
  if (/^\d{11}$/.test(value)) {
    return { value: value + upcaCheckDigit(value), appended: true };
  }
  return { value, appended: false };
}

// ── EAN-8 check digit ──────────────────────────────────────────────────────

/** Compute the EAN-8 check digit for the first 7 digits. */
export function ean8CheckDigit(digits: string): number {
  if (digits.length !== 7) throw new Error("Expected 7 digits");
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a full 8-digit EAN-8 string (includes check digit). */
export function validateEan8(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return "EAN-8 must be exactly 8 digits (0-9).";
  const expected = ean8CheckDigit(value.slice(0, 7));
  if (Number(value[7]) !== expected) {
    return `Invalid check digit. Expected ${expected}, got ${value[7]}.`;
  }
  return null;
}

/**
 * If exactly 7 digits are given for EAN-8, auto-append the check digit.
 * Returns { value, appended } where appended is true when a digit was added.
 */
export function ean8Autofix(value: string): { value: string; appended: boolean } {
  if (/^\d{7}$/.test(value)) {
    return { value: value + ean8CheckDigit(value), appended: true };
  }
  return { value, appended: false };
}

// ── Code93 ────────────────────────────────────────────────────────────────

const CODE93_CHARS = /^[A-Z0-9 \-$.\/+%]*$/;

export function validateCode93(value: string): string | null {
  if (value.length === 0) return "Enter at least one character.";
  const upper = value.toUpperCase();
  if (!CODE93_CHARS.test(upper)) {
    return "Code93 supports A-Z, 0-9 and special chars: - . $ / + % space.";
  }
  return null;
}

// ── ITF (Interleaved 2-of-5) ───────────────────────────────────────────────

/** ITF requires an even number of digits. */
export function validateItf(value: string): string | null {
  if (value.length === 0) return "Enter at least 2 digits.";
  if (!/^\d+$/.test(value)) return "ITF must contain only digits (0-9).";
  if (value.length % 2 !== 0) return "ITF requires an even number of digits.";
  return null;
}

// ── Code39 ────────────────────────────────────────────────────────────────

const CODE39_CHARS = /^[A-Z0-9 \-$.\/+%]*$/;

export function validateCode39(value: string): string | null {
  if (value.length === 0) return "Enter at least one character.";
  const upper = value.toUpperCase();
  if (!CODE39_CHARS.test(upper)) {
    return "Code39 supports A-Z, 0-9 and special chars: - . $ / + % space.";
  }
  return null;
}

// ── Code128 ───────────────────────────────────────────────────────────────

export function validateCode128(value: string): string | null {
  if (value.length === 0) return "Enter at least one character.";
  // Code128 supports all ASCII 0-127
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 127) {
      return "Code128 supports ASCII characters only (codes 0-127).";
    }
  }
  return null;
}

// ── Format registry ────────────────────────────────────────────────────────

export const FORMAT_META: Record<BarcodeFormat, FormatMeta> = {
  CODE128: {
    label: "Code 128",
    description: "General-purpose. Encodes full ASCII. Used in shipping and logistics.",
    placeholder: "Hello World 123",
    validate: validateCode128,
    minWidth: 200,
  },
  EAN13: {
    label: "EAN-13",
    description:
      "European retail standard. 13 digits with check digit. Enter 12 digits to auto-compute it.",
    placeholder: "5901234123457",
    validate: validateEan13,
    minWidth: 220,
  },
  UPC: {
    label: "UPC-A",
    description:
      "North American retail standard. 12 digits with check digit. Enter 11 digits to auto-compute it.",
    placeholder: "012345678905",
    validate: validateUpca,
    minWidth: 220,
  },
  EAN8: {
    label: "EAN-8",
    description:
      "Compact retail barcode for small packages. 8 digits with check digit. Enter 7 digits to auto-compute it.",
    placeholder: "96385074",
    validate: validateEan8,
    minWidth: 180,
  },
  CODE39: {
    label: "Code 39",
    description: "Alphanumeric. Widely supported. A-Z, 0-9 and select special chars.",
    placeholder: "CODE 39",
    validate: validateCode39,
    minWidth: 200,
  },
  CODE93: {
    label: "Code 93",
    description: "Compact successor to Code 39. A-Z, 0-9 and select special chars.",
    placeholder: "CODE 93",
    validate: validateCode93,
    minWidth: 200,
  },
  ITF: {
    label: "ITF-14",
    description: "Digits only. Even number of digits required. Used in packaging.",
    placeholder: "12345678901231",
    validate: validateItf,
    minWidth: 200,
  },
};

export const FORMAT_ORDER: BarcodeFormat[] = [
  "CODE128",
  "EAN13",
  "UPC",
  "EAN8",
  "CODE39",
  "CODE93",
  "ITF",
];

// ── Size helpers ───────────────────────────────────────────────────────────

export interface BarcodeSize {
  width: number;
  height: number;
  margin: number;
}

export function clampSize(size: BarcodeSize, format: BarcodeFormat): BarcodeSize {
  const { minWidth } = FORMAT_META[format];
  return {
    width: Math.max(minWidth, Math.min(600, size.width)),
    height: Math.max(40, Math.min(300, size.height)),
    margin: Math.max(0, Math.min(40, size.margin)),
  };
}
