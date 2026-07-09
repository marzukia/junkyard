import type { Plugin } from "vite";
import { defineAppConfig } from "@junkyardsh/vite-config";

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
 *
 * VERSION PAIRING — do not "align" these independently:
 *   @ffmpeg/ffmpeg  0.12.15  (npm, exact-pinned) — the JS wrapper; this patch
 *                            targets its classes.js Worker() call sites.
 *   @ffmpeg/core    0.12.10  (CDN, runtime)      — the WASM binary; loaded in
 *                            ffmpeg.ts via jsDelivr, NOT bundled here.
 * Bumping either version without reviewing the other can break the engine.
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
          throw new Error(
            `ffmpeg worker patch failed: expected string not found in ${id} — ` +
              "@ffmpeg/ffmpeg internals changed (pinned 0.12.15); update the patch."
          );
        }
        console.log("[ffmpeg-classic-worker] patched (regex fallback) Worker type to classic in", id);
        return { code: patched2, map: null };
      }

      console.log("[ffmpeg-classic-worker] patched Worker type to classic in", id);
      return { code: patched, map: null };
    },
  };
}

export default defineAppConfig({
  extraPlugins: [ffmpegClassicWorkerPlugin()],
  extra: {
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
  },
});
