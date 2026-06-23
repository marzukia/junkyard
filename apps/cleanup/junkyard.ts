import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "cleanup",
  name: "Cleanup",
  category: "image",
  order: 44,
  tagline: "Erase objects from photos, on-device",
  description:
    "Free object and people remover. Brush over anything you want gone and erase it with on-device inpainting - no upload, no signup, no watermark. A Cleanup.pictures alternative that runs entirely in your browser.",
  incumbent: "Cleanup.pictures",
  path: "/cleanup/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/lib/inpaint.ts",
    tools: [],
  },
  tags: ["beta"],
};
