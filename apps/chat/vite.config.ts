import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    target: "es2022",
  },
  // Exclude WebLLM from pre-bundling — it uses dynamic imports internally
  optimizeDeps: {
    exclude: ["@mlc-ai/web-llm"],
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
