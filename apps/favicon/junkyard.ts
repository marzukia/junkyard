import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "favicon",
  name: "Favicon",
  category: "image",
  order: 6,
  tagline: "Any image into a full favicon set",
  description: "Free favicon generator. Upload any PNG or SVG and instantly get a full favicon set: 16×16, 32×32, 48×48, 180×180 Apple Touch, 192×192 and 512×512 PWA icons, favicon.ico, manifest.json, and the HTML snippet. A fast realfavicongenerator alternative, runs entirely in your browser, no upload, no signup.",
  incumbent: "favicon.io",
  path: "/favicon/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/faviconCore.ts",
    tools: [],
  },
};
