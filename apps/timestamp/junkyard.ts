import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "timestamp",
  name: "Timestamp",
  category: "text",
  order: 21,
  tagline: "Unix epoch to human dates",
  description: "Free Unix timestamp converter. Convert epoch (seconds or milliseconds) to human-readable dates, ISO 8601, RFC 2822, relative time, and across time zones. A free epochconverter.com alternative. No upload, no account, runs in your browser.",
  incumbent: "epochconverter",
  path: "/timestamp/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/timestamp.ts",
    tools: [],
  },
};
