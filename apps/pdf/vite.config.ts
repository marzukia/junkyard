import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    rollupOptions: {
      external: ["@huggingface/transformers", "@pdf-lib/fontkit"],
    },
    target: "es2022",
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
