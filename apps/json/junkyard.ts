import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "json",
  name: "JSON Formatter",
  category: "text",
  order: 14,
  tagline: "Format, validate & minify JSON",
  description: "Free JSON formatter, beautifier and validator, format, minify, validate with precise error locations, and explore a collapsible tree view. No upload, no signup, runs entirely in your browser. A JSONLint alternative.",
  incumbent: "jsonformatter",
  path: "/json/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/json.ts",
    tools: [],
  },
};
