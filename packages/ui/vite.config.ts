import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    // Skip dts generation when SKIP_DTS is set (CI build-site.sh context
    // where the .d.ts files are not needed for the consolidated site build).
    ...(process.env.SKIP_DTS ? [] : [dts({ rollupTypes: true })]),
    react(),
  ],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        ai: "src/ai.ts",
        pdf: "src/pdf.ts",
      },
      formats: ["es"],
      fileName: "[name]",
      cssFileName: "styles",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "@mantine/core",
        "@huggingface/transformers",
        "pdf-lib",
        "@pdf-lib/fontkit",
      ],
    },
  },
});
