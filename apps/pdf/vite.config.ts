import { defineAppConfig } from "@junkyardsh/vite-config";
export default defineAppConfig({
  extra: {
    optimizeDeps: {
      exclude: ["pdfjs-dist"],
    },
  },
});
