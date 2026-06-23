import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "caption",
  name: "Caption",
  category: "ai",
  order: 29,
  tagline: "Describe any image for alt text",
  description: "Generate image captions and alt text instantly in your browser, free, private, no upload. A free alternative to paid captioning APIs that runs entirely client-side with AI. No signup, no data leaves your device.",
  incumbent: "BLIP",
  path: "/caption/",
  runtime: "client-ai",
  mcp: {
    exposed: false,
    lib: "src/lib/captioner.ts",
    tools: [],
  },
};
