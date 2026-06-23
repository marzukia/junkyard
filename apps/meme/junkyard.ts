import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "meme",
  name: "Meme Generator",
  category: "image",
  order: 10,
  tagline: "Top/bottom text, no watermark",
  description: "Free meme generator. Add top and bottom text to any image with Impact font, drag to reposition, export PNG. A free imgflip alternative with no watermark, no account, runs entirely in your browser.",
  incumbent: "imgflip",
  path: "/meme/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/meme.ts",
    tools: [],
  },
};
