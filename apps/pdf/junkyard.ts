import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "pdf",
  name: "PDF Toolkit",
  category: "docs",
  order: 33,
  tagline: "Merge, split & compress PDFs",
  description: "Free online PDF toolkit. Merge multiple PDFs, split or extract pages, reorder, compress, convert images to PDF, and export PDF pages as images. No upload, no signup, runs entirely in your browser. A free iLovePDF and Smallpdf alternative.",
  incumbent: "iLovePDF",
  path: "/pdf/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/lib/pdfUtils.ts",
    tools: [],
  },
};
