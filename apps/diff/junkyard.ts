import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "diff",
  name: "Text Diff",
  category: "text",
  order: 15,
  tagline: "Compare two texts, every change",
  description: "Free online text diff tool. Compare two texts or code files side-by-side or inline, with line and word-level highlighting. No signup, no upload, runs entirely in your browser.",
  incumbent: "diffchecker",
  path: "/diff/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/diff.ts",
    tools: [],
  },
};
