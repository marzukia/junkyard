import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "cron",
  name: "Cron Builder",
  category: "docs",
  order: 38,
  tagline: "Build & decode cron schedules",
  description: "Free cron expression builder and decoder. Edit minute/hour/day/month/weekday fields with instant human-readable descriptions and next-run previews. No upload, no signup, runs entirely in your browser. A crontab.guru alternative.",
  incumbent: "crontab.guru",
  path: "/cron/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/cron.ts",
    tools: [],
  },
};
