import { defineAppConfig } from "@junkyardsh/vite-config";
export default defineAppConfig({
  extra: {
    resolve: {
      conditions: ["browser", "module", "import", "default"],
    },
    test: {
      resolve: {
        conditions: ["browser", "module", "import", "default"],
      },
    },
  },
});
