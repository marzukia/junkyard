import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "og",
  name: "OG Image",
  category: "image",
  order: 4,
  tagline: "Social share cards, 1200x630",
  description: "Free OG image generator. Make open graph images, Twitter cards, and social share images (1200×630) in seconds. No signup, no upload, runs entirely in your browser. A fast Bannerbear & Placid alternative.",
  incumbent: "Vercel OG",
  path: "/og/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/ogLogic.ts",
    tools: [],
  },
};
