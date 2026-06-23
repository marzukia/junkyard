import type { LineItem } from "../store/useInvoiceStore";

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  shipping: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
}

/** Round to 2 decimal places, avoiding float drift (e.g. 1.005 -> 1.01). */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compute all monetary totals for an invoice. */
export function calcTotals(
  items: LineItem[],
  taxRate: number,
  discountPercent: number,
  shipping = 0,
  amountPaid = 0,
  taxOnGross = false
): InvoiceTotals {
  // Clamp rates to [0, 100]
  const clampedTaxRate = Math.min(100, Math.max(0, taxRate));
  const clampedDiscountPercent = Math.min(100, Math.max(0, discountPercent));

  const subtotal = round2(
    items.reduce((acc, item) => acc + Math.max(0, item.qty) * item.unitPrice, 0)
  );
  const discountAmount = round2(subtotal * (clampedDiscountPercent / 100));
  const taxableAmount = round2(subtotal - discountAmount);
  // taxOnGross: tax is applied to pre-discount subtotal; default is net (post-discount)
  const taxBase = taxOnGross ? subtotal : taxableAmount;
  const taxAmount = round2(taxBase * (clampedTaxRate / 100));
  const total = round2(taxableAmount + taxAmount + shipping);
  const balanceDue = round2(Math.max(0, total - amountPaid));
  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    shipping,
    total,
    amountPaid,
    balanceDue,
  };
}

/** Format a monetary value with the given currency code. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Fallback for unrecognised currency codes
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Currency options list. */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "NZD", label: "NZD - New Zealand Dollar" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
  { code: "SGD", label: "SGD - Singapore Dollar" },
  { code: "JPY", label: "JPY - Japanese Yen" },
  { code: "CNY", label: "CNY - Chinese Yuan" },
  { code: "INR", label: "INR - Indian Rupee" },
  { code: "CHF", label: "CHF - Swiss Franc" },
  { code: "HKD", label: "HKD - Hong Kong Dollar" },
  { code: "SEK", label: "SEK - Swedish Krona" },
  { code: "NOK", label: "NOK - Norwegian Krone" },
  { code: "DKK", label: "DKK - Danish Krone" },
  { code: "ZAR", label: "ZAR - South African Rand" },
  { code: "MXN", label: "MXN - Mexican Peso" },
  { code: "BRL", label: "BRL - Brazilian Real" },
  { code: "IDR", label: "IDR - Indonesian Rupiah" },
  { code: "MYR", label: "MYR - Malaysian Ringgit" },
];
