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
    expect(result.discountAmount).toBe(20);
    expect(result.taxableAmount).toBe(180);
    expect(result.total).toBe(180);
  });

  it("applies tax to post-discount amount", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 15, 0);
    expect(result.taxAmount).toBe(15);
    expect(result.total).toBe(115);
  });

  it("applies discount then tax correctly", () => {
    const items = [item("A", 1, 200)];
    // 10% discount -> 180, then 15% tax on 180 = 27 -> 207
    const result = calcTotals(items, 15, 10);
    expect(result.discountAmount).toBe(20);
    expect(result.taxableAmount).toBe(180);
    expect(result.taxAmount).toBe(27);
    expect(result.total).toBe(207);
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
    expect(result.subtotal).toBe(100);
  });

  // C1: 100 items at $9.99 with 8.5% tax -- classic float-drift scenario
  it("C1: 100 items at 9.99 with 8.5% tax produces exact rounded total", () => {
    const items = Array.from({ length: 100 }, (_, i) => item(`Item ${i}`, 1, 9.99));
    const result = calcTotals(items, 8.5, 0);
    // subtotal = 100 * 9.99 = 999.00 (exact after round2)
    expect(result.subtotal).toBe(999);
    // taxableAmount = 999.00
    expect(result.taxableAmount).toBe(999);
    // taxAmount = 999 * 0.085 = 84.915 -> round2 = 84.92
    expect(result.taxAmount).toBe(84.92);
    // total = 999 + 84.92 = 1083.92
    expect(result.total).toBe(1083.92);
  });

  // H2: clamping validation
  it("H2: taxRate above 100 is clamped to 100", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 150, 0);
    // clamped to 100%: tax = 100, total = 200
    expect(result.taxAmount).toBe(100);
    expect(result.total).toBe(200);
  });

  it("H2: discountPercent above 100 is clamped to 100", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 0, 200);
    // clamped: 100% discount = subtotal all off
    expect(result.discountAmount).toBe(100);
    expect(result.taxableAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("H2: negative taxRate is clamped to 0", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, -10, 0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(100);
  });

  it("H2: negative discountPercent is clamped to 0", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 0, -20);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(100);
  });

  // H4: taxOnGross option
  it("H4: taxOnGross=true applies tax on pre-discount subtotal", () => {
    const items = [item("A", 1, 200)];
    // 10% discount -> taxable = 180, but tax base = 200 (gross)
    // taxAmount = 200 * 0.15 = 30, total = 180 + 30 = 210
    const result = calcTotals(items, 15, 10, 0, 0, true);
    expect(result.discountAmount).toBe(20);
    expect(result.taxableAmount).toBe(180);
    expect(result.taxAmount).toBe(30);
    expect(result.total).toBe(210);
  });

  it("H4: taxOnGross=false (default) applies tax on post-discount amount", () => {
    const items = [item("A", 1, 200)];
    const result = calcTotals(items, 15, 10);
    expect(result.taxAmount).toBe(27); // 180 * 0.15
    expect(result.total).toBe(207);
  });

  it("H4: taxOnGross with no discount is identical to net behaviour", () => {
    const items = [item("A", 1, 100)];
    const net = calcTotals(items, 20, 0, 0, 0, false);
    const gross = calcTotals(items, 20, 0, 0, 0, true);
    expect(net.taxAmount).toBe(gross.taxAmount);
    expect(net.total).toBe(gross.total);
  });
});

describe("calcTotals - shipping and amount paid", () => {
  it("adds shipping to total", () => {
    const items = [item("A", 1, 100)];
    const result = calcTotals(items, 0, 0, 15);
    expect(result.shipping).toBe(15);
    expect(result.total).toBe(115);
  });

  it("computes balance due after partial payment", () => {
    const items = [item("A", 1, 200)];
    const result = calcTotals(items, 0, 0, 0, 50);
    expect(result.amountPaid).toBe(50);
    expect(result.balanceDue).toBe(150);
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
  it("formats USD amounts with 2 decimal places", () => {
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

  it("formats zero correctly for USD", () => {
    const result = formatMoney(0, "USD");
    expect(result).toMatch(/0\.00/);
  });

  // C2/H5: JPY should have no decimal places
  it("C2: JPY formats without decimal places", () => {
    const result = formatMoney(1000, "JPY");
    // Intl with locale=undefined + JPY -> no fraction digits
    expect(result).not.toMatch(/\./);
    expect(result).toMatch(/1[,.]?000/);
  });

  it("C2: JPY zero formats without decimal places", () => {
    const result = formatMoney(0, "JPY");
    expect(result).not.toMatch(/\./);
  });

  it("formats negative amounts without throwing", () => {
    const result = formatMoney(-50, "USD");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats very large numbers without throwing", () => {
    expect(() => formatMoney(999_999_999.99, "USD")).not.toThrow();
  });
});

// Bug-4: extreme values must never produce Infinity or NaN in any field
describe("calcTotals — extreme value guard (Bug-4)", () => {
  it("qty=1e300 × price=1e300 produces finite, consistent totals with no NaN", () => {
    const items = [item("Extreme", 1e300, 1e300)];
    const result = calcTotals(items, 0, 0);
    for (const [key, val] of Object.entries(result)) {
      expect(Number.isFinite(val), `${key} should be finite`).toBe(true);
      expect(Number.isNaN(val), `${key} should not be NaN`).toBe(false);
    }
  });

  it("subtotal=Infinity with 0% discount produces consistent discountAmount (not NaN)", () => {
    const items = [item("Big", 1e300, 1e300)];
    const result = calcTotals(items, 0, 0);
    // Both subtotal and discountAmount must be finite — the old code had Infinity * 0 = NaN
    expect(Number.isFinite(result.subtotal)).toBe(true);
    expect(Number.isFinite(result.discountAmount)).toBe(true);
    expect(Number.isNaN(result.discountAmount)).toBe(false);
  });

  it("total is always >= subtotal when tax=0, discount=0, shipping=0", () => {
    const items = [item("Big", 1e300, 1e300)];
    const result = calcTotals(items, 0, 0);
    expect(result.total).toBeGreaterThanOrEqual(result.taxableAmount);
  });

  it("normal values still work correctly after adding the isFinite guard", () => {
    const items = [item("Normal", 2, 50)];
    const result = calcTotals(items, 10, 5);
    // subtotal=100, 5% discount=5, taxable=95, 10% tax=9.5, total=104.5
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(5);
    expect(result.taxableAmount).toBe(95);
    expect(result.taxAmount).toBe(9.5);
    expect(result.total).toBe(104.5);
  });
});

// H4 toggle wire-up: assert the toggle meaningfully changes the total
describe("H4 taxOnGross UI toggle effect", () => {
  it("toggling taxOnGross produces a different total when both tax and discount are set", () => {
    const items = [{ id: "t1", description: "Widget", qty: 4, unitPrice: 50 }];
    // subtotal = 200, 25% discount -> taxable = 150, 20% tax
    const net = calcTotals(items, 20, 25, 0, 0, false);
    const gross = calcTotals(items, 20, 25, 0, 0, true);
    // net:   tax = 150 * 0.20 = 30  -> total = 180
    // gross: tax = 200 * 0.20 = 40  -> total = 190
    expect(net.taxAmount).toBe(30);
    expect(gross.taxAmount).toBe(40);
    expect(gross.total).toBeGreaterThan(net.total);
  });
});
