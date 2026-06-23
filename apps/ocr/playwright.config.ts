import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:4173",
  },
  webServer: {
    command: "bun run preview",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
      },
    },
  ],
});
