/**
 * Augmented tests for invoiceCalc.ts.
 * Covers negative/edge pathways not reached by the existing tests.
 */
import { describe, expect, it } from "vitest";
import { CURRENCIES, calcTotals, formatMoney } from "../lib/invoiceCalc";
import type { LineItem } from "../store/useInvoiceStore";

function item(description: string, qty: number, unitPrice: number): LineItem {
  return { id: "test", description, qty, unitPrice };
}

// calcTotals edge/negative cases

describe("calcTotals — additional edge and negative cases", () => {
  it("100% discount leaves taxable amount and total at 0", () => {
    const items = [item("A", 1, 200)];
    const result = calcTotals(items, 10, 100);
    expect(result.discountAmount).toBe(200);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("shipping is included even when items subtotal is zero", () => {
    const result = calcTotals([], 0, 0, 25);
    expect(result.shipping).toBe(25);
    expect(result.total).toBe(25);
    expect(result.balanceDue).toBe(25);
  });

  it("multiple items sum subtotal correctly", () => {
    const items = [item("A", 10, 5), item("B", 3, 20), item("C", 1, 100)];
    // 50 + 60 + 100 = 210
    const result = calcTotals(items, 0, 0);
    expect(result.subtotal).toBe(210);
  });

  it("zero unit price contributes nothing to subtotal", () => {
    const items = [item("Free", 100, 0)];
    const result = calcTotals(items, 20, 10);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("large number does not lose floating-point precision after rounding", () => {
    const items = [item("Big", 1, 1_000_000)];
    const result = calcTotals(items, 10, 0);
    expect(result.taxAmount).toBe(100_000);
    expect(result.total).toBe(1_100_000);
  });

  it("full payment sets balanceDue to 0 (not negative)", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 0, 0, 0, 100);
    expect(result.balanceDue).toBe(0);
  });

  it("combined shipping + tax + discount accumulate correctly", () => {
    // subtotal=200, 20% discount=40, taxable=160, 10% tax=16, shipping=10 => total=186
    const items = [item("A", 2, 100)];
    const result = calcTotals(items, 10, 20, 10);
    expect(result.subtotal).toBe(200);
    expect(result.discountAmount).toBe(40);
    expect(result.taxableAmount).toBe(160);
    expect(result.taxAmount).toBe(16);
    expect(result.total).toBe(186);
  });
});

// formatMoney negative/edge cases

describe("formatMoney — additional edge and negative cases", () => {
  it("formats negative amounts (e.g. credit notes)", () => {
    const result = formatMoney(-50, "USD");
    // Should contain the number without crashing
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats very large numbers without throwing", () => {
    expect(() => formatMoney(999_999_999.99, "USD")).not.toThrow();
  });

  it("formats JPY with no decimal places (zero decimal currency)", () => {
    const result = formatMoney(1000, "JPY");
    expect(result).not.toMatch(/\./);
  });

  it("falls back for empty string currency code", () => {
    // Empty string is invalid; falls back to `${currency} ${amount.toFixed(2)}`
    const result = formatMoney(9.99, "");
    expect(result).toContain("9.99");
  });
});

// CURRENCIES constant

describe("CURRENCIES", () => {
  it("is a non-empty array", () => {
    expect(CURRENCIES.length).toBeGreaterThan(0);
  });

  it("every entry has a non-empty code and label", () => {
    for (const c of CURRENCIES) {
      expect(c.code.length).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it("includes NZD", () => {
    expect(CURRENCIES.some((c) => c.code === "NZD")).toBe(true);
  });

  it("includes USD", () => {
    expect(CURRENCIES.some((c) => c.code === "USD")).toBe(true);
  });

  it("all codes are 3 uppercase letters", () => {
    for (const c of CURRENCIES) {
      expect(c.code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("all entries are unique by code", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
