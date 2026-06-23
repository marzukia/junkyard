import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "base64",
  name: "Base64",
  category: "text",
  order: 17,
  tagline: "Encode & decode text and files",
  description: "Free Base64 encoder and decoder, encode or decode text, files, and images in your browser. URL-safe Base64, data-URI preview, file download. No upload, no signup, fully private.",
  incumbent: "base64encode",
  path: "/base64/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/base64.ts",
    tools: [],
  },
};
