import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "ocr",
  name: "Image to Text",
  category: "image",
  order: 3,
  tagline: "Pull text out of any image (OCR)",
  description: "Extract text from any image or screenshot instantly. Free OCR tool that runs entirely in your browser, no upload, no signup, 100% private. A fast alternative to Google Drive OCR, Adobe Acrobat, and NewOCR.",
  incumbent: "i2OCR",
  path: "/ocr/",
  runtime: "client",
  mcp: {
    exposed: false,
    lib: "src/ocrUtils.ts",
    tools: [],
  },
};
