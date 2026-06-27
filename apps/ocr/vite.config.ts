import { defineAppConfig } from "@junkyardsh/vite-config";
export default defineAppConfig({
  rollupExternal: ["@huggingface/transformers"],
  noExternal: ["@pdf-lib/fontkit", "pako"],
  include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
});
