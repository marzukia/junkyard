import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "splice",
  name: "Video Splicer",
  category: "image",
  order: 47,
  tagline: "Combine multiple videos in your browser",
  description:
    "Free video splicer. Combine multiple video clips into one. Runs entirely in your browser with ffmpeg.wasm - no upload, no signup, no watermark.",
  incumbent: "clideo",
  path: "/splice/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/lib/ffmpeg.ts",
    tools: [],
  },
  tags: ["large-download"],
};
