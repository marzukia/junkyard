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

// Maximum representable monetary value: beyond this, arithmetic results are
// clamped to avoid Infinity/NaN leaking into PDF output.
const MAX_MONEY = 1e15;

/** Clamp a computed monetary value to a finite range. */
function clampMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_MONEY, Math.max(-MAX_MONEY, n));
}

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
    clampMoney(items.reduce((acc, item) => acc + Math.max(0, item.qty) * item.unitPrice, 0))
  );
  const discountAmount = round2(clampMoney(subtotal * (clampedDiscountPercent / 100)));
  const taxableAmount = round2(clampMoney(subtotal - discountAmount));
  // taxOnGross: tax is applied to pre-discount subtotal; default is net (post-discount)
  const taxBase = taxOnGross ? subtotal : taxableAmount;
  const taxAmount = round2(clampMoney(taxBase * (clampedTaxRate / 100)));
  const clampedShipping = clampMoney(shipping);
  const total = round2(clampMoney(taxableAmount + taxAmount + clampedShipping));
  const clampedAmountPaid = clampMoney(amountPaid);
  const balanceDue = round2(Math.max(0, clampMoney(total - clampedAmountPaid)));
  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    shipping: clampedShipping,
    total,
    amountPaid: clampedAmountPaid,
    balanceDue,
  };
}

/** Format a monetary value with the given currency code. */
export function formatMoney(amount: number, currency: string): string {
  // Guard non-finite values (Infinity, -Infinity, NaN) that arise from extreme
  // line-item quantities/prices before calcTotals' clampMoney has a chance to
  // normalise them.  Without this guard, Intl.NumberFormat.format(Infinity)
  // renders "$∞" directly in the line-item Amount column.
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(safe);
  } catch {
    // Fallback for unrecognised currency codes
    return `${currency} ${safe.toFixed(2)}`;
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
