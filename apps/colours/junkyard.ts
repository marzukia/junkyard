import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "colours",
  name: "Colours",
  category: "docs",
  order: 37,
  tagline: "Gradients, palettes & contrast",
  description: "Free online colour gradient and palette generator. Create stepped gradients with LAB/RGB/HSL interpolation, generate harmonious color palettes, copy hex/CSS. A fast coolors & colordesigner alternative.",
  incumbent: "Coolors",
  path: "/colours/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/color.ts",
    tools: [],
  },
};
