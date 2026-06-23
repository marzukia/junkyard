import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "bg",
  name: "Background Remover",
  category: "image",
  order: 7,
  tagline: "Erase backgrounds with on-device AI",
  description: "Remove image backgrounds instantly in your browser, free, private, no upload. A remove.bg alternative that runs entirely client-side with AI. No signup, no watermark, no data leaves your device.",
  incumbent: "remove.bg",
  path: "/bg/",
  runtime: "client-ai",
  mcp: {
    exposed: false,
    lib: "src/lib/bgRemoval.ts",
    tools: [],
  },
};
