import { defineAppConfig } from "@junkyardsh/vite-config";
export default defineAppConfig({
  extra: {
    optimizeDeps: {
      exclude: ["@mlc-ai/web-llm"],
    },
  },
});
