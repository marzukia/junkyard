import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "convert",
  name: "Image Converter",
  category: "image",
  order: 1,
  tagline: "HEIC to JPG, WebP & PNG, compress & resize",
  description: "Free image converter and compressor. Convert HEIC to JPG, PNG to WebP, JPG to PNG and more, all in your browser, no upload, no account. A fast TinyPNG alternative with HEIC support.",
  incumbent: "TinyPNG",
  path: "/convert/",
  runtime: "client",
  mcp: {
    exposed: true,
    lib: "src/convert.ts",
    tools: [],
  },
};
