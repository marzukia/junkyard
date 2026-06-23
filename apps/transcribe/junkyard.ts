import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "transcribe",
  name: "Transcribe",
  category: "ai",
  order: 26,
  tagline: "Whisper speech to text",
  description: "Transcribe audio and video to text instantly in your browser. Free Otter.ai and Whisper alternative. No upload, no signup, no API key. Runs 100% client-side with on-device AI.",
  incumbent: "Otter.ai",
  path: "/transcribe/",
  runtime: "client-ai",
  mcp: {
    exposed: false,
    lib: "src/lib/transcription.ts",
    tools: [],
  },
  tags: ["on-device-ai", "large-download"],
};
