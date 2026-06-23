import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "chat",
  name: "Local Chat",
  category: "ai",
  order: 32,
  tagline: "An LLM running in your browser",
  description: "Chat with an AI that runs 100% in your browser. No API key, no server, no upload. A free ChatGPT alternative that stays fully private. Works offline after first load.",
  incumbent: "ChatGPT",
  path: "/chat/",
  runtime: "client-ai",
  mcp: {
    exposed: false,
    lib: "src/lib/llmEngine.ts",
    tools: [],
  },
};
