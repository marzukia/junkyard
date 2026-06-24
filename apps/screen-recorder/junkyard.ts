import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "screen-recorder",
  name: "Screen Recorder",
  category: "image",
  order: 45,
  tagline: "Record your screen in-browser, no upload, no account",
  description:
    "Free screen recorder: capture your screen with optional mic and system audio, preview, and download as WebM. Runs entirely client-side — no upload, no account, no watermark. A Loom alternative that never leaves your browser.",
  incumbent: "Loom",
  path: "/screen-recorder/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/lib/recorder.ts",
    tools: [],
  },
};
