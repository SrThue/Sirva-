import { defineConfig, devices } from "@playwright/test";

const porta = 3000;
const chromiumLocal = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${porta}`, trace: "on-first-retry" },
  projects: [
    {
      name: "celular",
      use: {
        ...devices["Pixel 7"],
        launchOptions: chromiumLocal ? { executablePath: chromiumLocal } : {},
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: `http://localhost:${porta}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
