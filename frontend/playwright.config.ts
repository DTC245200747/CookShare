import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    browserName: "chromium",
    channel: process.env.E2E_CHROME === "1" ? "chrome" : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
