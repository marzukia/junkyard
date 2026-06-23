import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

/**
 * Patches @ffmpeg/ffmpeg ESM classes.js so Vite bundles the ffmpeg worker
 * as a classic (IIFE) worker instead of a module worker.
 *
 * Why: @ffmpeg/ffmpeg's worker.js uses importScripts() to load ffmpeg-core.js,
 * which is only available in classic workers. The library source hardcodes
 * { type: "module" } on both Worker() call sites, so Vite emits a module
 * worker that cannot call importScripts and throws "failed to import
 * ffmpeg-core.js". Changing the type to "classic" makes Vite emit an IIFE
 * worker bundle, which supports importScripts correctly.
 *
 * We exclude @ffmpeg/ffmpeg from optimizeDeps so the transform hook runs on
 * its source before the esbuild pre-bundler hides it from the plugin pipeline.
 */
function ffmpegClassicWorkerPlugin(): Plugin {
  return {
    name: "ffmpeg-classic-worker",
    transform(code, id) {
      if (!id.includes("@ffmpeg/ffmpeg") || !id.includes("classes")) {
        return null;
      }
      // Simple string replacement for both Worker instantiation sites.
      // The source uses multiline object literals so we match the exact
      // string segments that appear in @ffmpeg/ffmpeg@0.12.15 classes.js.
      const patched = code
        .split('new Worker(new URL(classWorkerURL, import.meta.url), {\n                    type: "module",\n                })')
        .join('new Worker(new URL(classWorkerURL, import.meta.url), { type: "classic" })')
        .split('new Worker(new URL("./worker.js", import.meta.url), {\n                    type: "module",\n                })')
        .join('new Worker(new URL("./worker.js", import.meta.url), { type: "classic" })');

      if (patched === code) {
        // Fallback: use regex with dotAll flag in case whitespace differs
        const patched2 = code
          .replace(
            /new Worker\(new URL\(classWorkerURL, import\.meta\.url\),\s*\{\s*type:\s*"module",?\s*\}\)/s,
            'new Worker(new URL(classWorkerURL, import.meta.url), { type: "classic" })'
          )
          .replace(
            /new Worker\(new URL\("\.\/worker\.js", import\.meta\.url\),\s*\{\s*type:\s*"module",?\s*\}\)/s,
            'new Worker(new URL("./worker.js", import.meta.url), { type: "classic" })'
          );
        if (patched2 === code) {
          console.warn("[ffmpeg-classic-worker] pattern not found in", id, "- engine may fail to load");
          return null;
        }
        console.log("[ffmpeg-classic-worker] patched (regex fallback) Worker type to classic in", id);
        return { code: patched2, map: null };
      }

      console.log("[ffmpeg-classic-worker] patched Worker type to classic in", id);
      return { code: patched, map: null };
    },
  };
}

export default defineConfig({
  plugins: [ffmpegClassicWorkerPlugin(), react()],
  optimizeDeps: {
    // Exclude so the transform hook above can patch classes.js before
    // esbuild pre-bundling hides it from Vite's plugin pipeline.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  base: "/",
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
