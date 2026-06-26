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
  // Allow transformers.js to use its own worker/wasm resolution
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
