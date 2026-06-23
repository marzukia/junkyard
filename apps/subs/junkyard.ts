import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "subs",
  name: "Subtitle Editor",
  category: "docs",
  order: 34,
  tagline: "Edit, shift & convert .srt/.vtt",
  description: "Free online subtitle editor. Load .srt or .vtt files, edit lines and timings, time-shift all or selected subtitles, convert SRT to VTT or VTT to SRT, fix overlaps, and download. No upload, no signup, runs entirely in your browser.",
  incumbent: "Subtitle Edit",
  path: "/subs/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/subtitle.ts",
    tools: [],
  },
};
