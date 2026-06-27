import { defineAppConfig } from "@junkyardsh/vite-config";
export default defineAppConfig({
  noExternal: ["@pdf-lib/fontkit", "pako"],
  include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
});
