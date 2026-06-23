import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "video",
  name: "Video Toolkit",
  category: "image",
  order: 43,
  tagline: "Trim, convert, compress & GIF - in your browser",
  description:
    "Free in-browser video toolkit: trim, convert (mp4/webm/gif), compress, and turn video into GIF. Runs entirely client-side with ffmpeg.wasm - no upload, no signup, no watermark. A Veed / Kapwing / ezgif alternative.",
  incumbent: "Veed",
  path: "/video/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/lib/ffmpeg.ts",
    tools: [],
  },
  tags: ["large-download"],
};
