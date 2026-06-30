import { defineAppConfig } from "@junkyardsh/vite-config";
export default defineAppConfig({
  rollupExternal: ["@huggingface/transformers", "@pdf-lib/fontkit"],
  noExternal: ["pako"],
  include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
});
