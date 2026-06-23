import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "gif",
  name: "GIF Maker",
  category: "image",
  order: 13,
  tagline: "Turn images into animated GIFs",
  description: "Free animated GIF maker. Add images, reorder frames, set delay and loop count, preview and export. Runs entirely in your browser with no upload and no account. A free ezgif alternative.",
  incumbent: "EZGIF",
  path: "/gif/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/gif.ts",
    tools: [],
  },
};
