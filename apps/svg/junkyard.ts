import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "svg",
  name: "SVG Optimizer",
  category: "image",
  order: 12,
  tagline: "Shrink SVG files with SVGO",
  description: "Free SVG optimizer powered by SVGO. Paste or upload an SVG, strip metadata, collapse groups, round precision, and get a smaller file instantly. No upload, no signup, runs entirely in your browser. A free SVGOMG alternative.",
  incumbent: "SVGOMG",
  path: "/svg/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/svgOptimize.ts",
    tools: [],
  },
};
