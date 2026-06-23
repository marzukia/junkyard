import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "resume",
  name: "Resume",
  category: "docs",
  order: 41,
  tagline: "Build a CV, export to PDF",
  description: "Free resume builder. Create a professional resume or CV with contact info, summary, experience, education and skills. Export a clean PDF instantly. No signup, no upload, 100% private. A free alternative to Zety, Resume.io, and Canva resume.",
  incumbent: "Zety",
  path: "/resume/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/lib/resumeUtils.ts",
    tools: [],
  },
};
