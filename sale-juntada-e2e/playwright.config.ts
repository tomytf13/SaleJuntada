import { defineConfig, devices } from "@playwright/test";

const localBrowser = process.env.CI ? {} : { channel: "chrome" as const };

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "Mobile Chrome", use: { ...devices["Pixel 7"], ...localBrowser } },
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"], ...localBrowser },
    },
  ],
  webServer: {
    command: "npm run dev --prefix ../sale-juntada-front",
    env: {
      VITE_SUPABASE_URL: process.env.E2E_REAL_DB === "1" ? process.env.VITE_SUPABASE_URL ?? "" : "https://auth.example.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_REAL_DB === "1" ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" : "sb_publishable_test",
    },
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
