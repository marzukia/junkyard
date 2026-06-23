import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "translate",
  name: "Translate",
  category: "ai",
  order: 30,
  tagline: "200 languages, on your device",
  description: "Translate text between 200+ languages instantly in your browser, free, private, no upload. A DeepL and Google Translate alternative powered by AI that runs entirely client-side. No signup, no API key, no data leaves your device.",
  incumbent: "DeepL",
  path: "/translate/",
  runtime: "client-ai",
  mcp: {
    exposed: false,
    lib: "src/lib/translator.ts",
    tools: [],
  },
};
