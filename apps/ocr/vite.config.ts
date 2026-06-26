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
    rollupOptions: {
      // Force @pdf-lib/fontkit and its transitive dep pako to always be bundled.
      // fontkit's ES module entry (fontkit.es.js) has bare imports to pako, which is
      // a CJS package with no "main"/"module"/"exports" fields in its package.json.
      // In some CI environments (Bun + Rollup), this chain fails to resolve, leaving
      // a bare import specifier in the production output — which causes browsers to
      // throw "Failed to resolve module specifier" and renders the app blank.
      noExternal: ["@pdf-lib/fontkit", "pako"],
    },
  },
    worker: {
    rollupOptions: {
      external: ["@huggingface/transformers", "@pdf-lib/fontkit"],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
