import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "screenshot",
  name: "Screenshot Beautifier",
  category: "image",
  order: 9,
  tagline: "Frame shots with bg, padding, shadow",
  description: "Free screenshot beautifier. Add gradients, backgrounds, padding, rounded corners, drop shadows, and macOS window frames to any screenshot - all in your browser, no upload, no account. A free shots.so and screenshot.rocks alternative.",
  incumbent: "shots.so",
  path: "/screenshot/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/beautifier.ts",
    tools: [],
  },
};
