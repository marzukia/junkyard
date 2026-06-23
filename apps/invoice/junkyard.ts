import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "invoice",
  name: "Invoice",
  category: "docs",
  order: 40,
  tagline: "Fill & export an invoice PDF",
  description: "Free invoice generator. Create professional invoices with line items, tax, discounts, logo and currency. Export a clean PDF instantly. No signup, no upload, 100% private. A free invoice-generator.com and DocuSign alternative.",
  incumbent: "invoice-generator",
  path: "/invoice/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/invoiceCalc.ts",
    tools: [],
  },
};
