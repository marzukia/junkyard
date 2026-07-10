import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "audio",
  name: "Audio Converter",
  category: "docs",
  order: 48,
  tagline: "Convert between MP3, WAV, FLAC, M4A, OGG, OPUS, AIFF",
  description:
    "Free audio converter: convert between MP3, WAV, FLAC, M4A, OGG, OPUS, AIFF. Change sample rate, channel mode, bitrate. No upload, no signup, runs entirely in your browser. An Auphonic alternative.",
  incumbent: "Auphonic",
  path: "/audio/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/lib/convert.ts",
    tools: [],
  },
};