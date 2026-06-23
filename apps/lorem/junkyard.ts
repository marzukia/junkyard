import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "lorem",
  name: "Lorem Ipsum",
  category: "text",
  order: 25,
  tagline: "Placeholder text and images",
  description: "Free lorem ipsum generator and placeholder image maker. Generate paragraphs, sentences, words, or lists of lorem ipsum text. Create custom placeholder images with any size, colour, and label, rendered client-side as SVG or PNG. No upload, no account, runs entirely in your browser. A free lipsum.com and placeholder.com alternative.",
  incumbent: "lipsum",
  path: "/lorem/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/lorem.ts",
    tools: [],
  },
};
