import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "summarize",
  name: "Summarize",
  category: "ai",
  order: 31,
  tagline: "Summarize long text and articles",
  description: "Summarize long articles and text instantly in your browser, free, private, no upload. A Jasper, QuillBot and TLDR This alternative that runs entirely client-side with AI. No signup, no API key, no data leaves your device.",
  incumbent: "QuillBot",
  path: "/summarize/",
  runtime: "client-ai",
  mcp: {
    exposed: false,
    lib: "src/lib/summarizer.ts",
    tools: [],
  },
  tags: ["on-device-ai", "large-download"],
};
