import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    target: "es2022",
  },
  resolve: {
    // Ensure the browser condition is evaluated so svgo/browser resolves
    // to svgo's browser-safe bundle (no Node.js fs/path deps).
    conditions: ["browser", "module", "import", "default"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    resolve: {
      conditions: ["browser", "module", "import", "default"],
    },
  },
});
