import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "css",
  name: "CSS Toolkit",
  category: "text",
  order: 19,
  tagline: "Shadow, gradient, glass & easing",
  description: "Free CSS generator toolkit with live preview and copyable output. Generate box shadows, linear and radial gradients, glassmorphism effects, and cubic-bezier easing curves. No signup, no upload, runs entirely in your browser. A CSS Tricks and cssmatic alternative.",
  incumbent: "cssgradient",
  path: "/css/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/css.ts",
    tools: [],
  },
};
