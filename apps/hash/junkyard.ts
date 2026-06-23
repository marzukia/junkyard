import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "hash",
  name: "Hash",
  category: "text",
  order: 23,
  tagline: "MD5, SHA-1, SHA-256 checksums",
  description: "Free online hash generator. Compute MD5, SHA-1, SHA-256 and SHA-512 hashes for text or files, private, runs entirely in your browser, no upload, no signup.",
  incumbent: "", // intentional - no single dominant incumbent in this space
  path: "/hash/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/hash.ts",
    tools: [],
  },
};
