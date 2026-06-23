import { describe, expect, it } from "vitest";
import { calcTotals, formatMoney } from "../lib/invoiceCalc";
import type { LineItem } from "../store/useInvoiceStore";

function item(description: string, qty: number, unitPrice: number): LineItem {
  return { id: "test", description, qty, unitPrice };
}

describe("calcTotals", () => {
  it("computes subtotal from line items", () => {
    const items = [item("A", 2, 100), item("B", 1, 50)];
    const result = calcTotals(items, 0, 0);
    expect(result.subtotal).toBe(250);
  });

  it("applies discount to subtotal", () => {
    const items = [item("A", 1, 200)];
    const result = calcTotals(items, 0, 10);
    expect(result.discountAmount).toBeCloseTo(20);
    expect(result.taxableAmount).toBeCloseTo(180);
    expect(result.total).toBeCloseTo(180);
  });

  it("applies tax to post-discount amount", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 15, 0);
    expect(result.taxAmount).toBeCloseTo(15);
    expect(result.total).toBeCloseTo(115);
  });

  it("applies discount then tax correctly", () => {
    const items = [item("A", 1, 200)];
    // 10% discount -> 180, then 15% tax on 180 = 27 -> 207
    const result = calcTotals(items, 15, 10);
    expect(result.discountAmount).toBeCloseTo(20);
    expect(result.taxableAmount).toBeCloseTo(180);
    expect(result.taxAmount).toBeCloseTo(27);
    expect(result.total).toBeCloseTo(207);
  });

  it("returns zero totals for empty items", () => {
    const result = calcTotals([], 10, 5);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("handles zero tax and zero discount", () => {
    const items = [item("X", 3, 50)];
    const result = calcTotals(items, 0, 0);
    expect(result.subtotal).toBe(150);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(150);
  });

  it("fractional quantities multiply correctly", () => {
    const items = [item("Fractional", 2.5, 40)];
    const result = calcTotals(items, 0, 0);
    expect(result.subtotal).toBeCloseTo(100);
  });
});

describe("calcTotals - shipping and amount paid", () => {
  it("adds shipping to total", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 0, 0, 15);
    expect(result.shipping).toBe(15);
    expect(result.total).toBeCloseTo(115);
  });

  it("computes balance due after partial payment", () => {
    const items = [item("A", 1, 200)];
    const result = calcTotals(items, 0, 0, 0, 50);
    expect(result.amountPaid).toBe(50);
    expect(result.balanceDue).toBeCloseTo(150);
  });

  it("clamps balance due to 0 when overpaid", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 0, 0, 0, 200);
    expect(result.balanceDue).toBe(0);
  });

  it("treats negative qty as 0 in subtotal", () => {
    const items = [item("A", -5, 100)];
    const result = calcTotals(items, 0, 0);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats USD amounts", () => {
    const result = formatMoney(1234.5, "USD");
    expect(result).toMatch(/1,234\.50/);
  });

  it("formats NZD amounts", () => {
    const result = formatMoney(99.99, "NZD");
    expect(result).toMatch(/99\.99/);
  });

  it("falls back gracefully for unknown currency codes", () => {
    const result = formatMoney(50, "XYZ");
    expect(result).toContain("XYZ");
    expect(result).toContain("50.00");
  });

  it("formats zero correctly", () => {
    const result = formatMoney(0, "USD");
    expect(result).toMatch(/0\.00/);
  });
});
