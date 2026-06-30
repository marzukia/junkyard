import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "fingerprint",
  name: "Fingerprint",
  category: "text",
  order: 46,
  tagline: "Browser fingerprint & bot detection scanner",
  description:
    "Free online browser fingerprint scanner. See what an anti-bot stack reads off your browser: canvas/WebGL/WebGPU/audio/font fingerprints, automation tells, a derived visitor ID, and a bot risk score. Client-side only, nothing leaves your browser. Ported from ghostprint.",
  incumbent: "",
  path: "/fingerprint/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "",
    tools: [],
  },
};
