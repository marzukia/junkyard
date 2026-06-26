import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: true }), react()],
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
