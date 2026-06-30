import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "path";

export interface AppConfigOptions {
  /** Per-app globals for test (default: true) */
  globals?: boolean;
  /** Per-app noExternal packages (default: none) */
  noExternal?: string[];
  /** Per-app test include patterns (default: none) */
  include?: string[];
  /** Extra plugins to add after react() (default: none) */
  extraPlugins?: any[];
  /** Extra config to merge (optimizeDeps, test.environment, etc.) */
  extra?: Record<string, any>;
  /** Rollup external list (default: ["@huggingface/transformers", "@pdf-lib/fontkit"]) */
  rollupExternal?: string[];
  /** Worker rollup external list (default: [] — bundle everything into workers) */
  workerExternal?: string[];
  /** Whether to include the worker block (default: true if rollupExternal or workerExternal is set) */
  hasWorker?: boolean;
  /** Base path (default: "/") */
  base?: string;
  /** Build target (default: "es2022") */
  target?: string;
  /** Test environment (default: "jsdom") */
  testEnvironment?: string;
}

export function defineAppConfig(options: AppConfigOptions = {}): Record<string, any> {
  const {
    globals = true,
    noExternal,
    include,
    extraPlugins,
    extra,
    rollupExternal = ["@huggingface/transformers", "@pdf-lib/fontkit"],
    workerExternal: workerExternalOpt,
    hasWorker = rollupExternal.length > 0 || (workerExternalOpt?.length ?? 0) > 0,
    base = "/",
    target = "es2022",
    testEnvironment = "jsdom",
  } = options;

  const workerExternal = workerExternalOpt ?? ["@pdf-lib/fontkit"];

  const config: Record<string, any> = {
    plugins: [react()],
    base,
    resolve: {
      // Force @mantine/core and react to resolve from the app's own
      // node_modules. Without this, @junkyardsh/ui (symlinked from
      // packages/ui/) brings its own node_modules copy of @mantine/core,
      // causing Vite to bundle two instances → duplicate React contexts →
      // "MantineProvider was not found in tree" crash.
      alias: [
        {
          find: "@mantine/core",
          replacement: resolve(process.cwd(), "node_modules/@mantine/core"),
        },
        {
          find: "react",
          replacement: resolve(process.cwd(), "node_modules/react"),
        },
        {
          find: "react-dom",
          replacement: resolve(process.cwd(), "node_modules/react-dom"),
        },
      ],
      dedupe: ["react", "react-dom", "@mantine/core"],
    },
    build: {
      rollupOptions: {
        external: rollupExternal,
      },
      target,
    },
    test: {
      environment: testEnvironment,
      globals,
      ...(include ? { include } : {}),
    },
  };

  // Add worker block if app has worker files
  if (hasWorker) {
    config.worker = {
      rollupOptions: {
        external: workerExternal,
      },
    };
  }

  // Add optimizeDeps.exclude by default unless overridden via extra
  if (!extra?.optimizeDeps?.exclude) {
    config.optimizeDeps = {
      exclude: ["@huggingface/transformers"],
    };
  }

  // Merge extra plugins — they go before react() so they can transform before react's transform
  if (extraPlugins) {
    config.plugins = [...(Array.isArray(extraPlugins) ? extraPlugins : [extraPlugins]), react()];
  }

  // Deep-merge extra config — preserve defaults for nested objects
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      const existing = config[key];
      if (existing && typeof existing === "object" && typeof val === "object" && !Array.isArray(val)) {
        config[key] = { ...existing, ...val };
      } else {
        config[key] = val;
      }
    }
  }

  // Handle noExternal in build
  if (noExternal) {
    config.build = {
      ...config.build,
      noExternal,
    };
  }

  return defineConfig(config);
}
