import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The app reads no environment variables; the gitignored .env holds only an
// optional E2E_PORT for a machine where the default port is taken.
if (existsSync(".env")) process.loadEnvFile(".env");

// 4321 is Astro's default preview port: neither astro.config.mjs nor the
// preview script sets one. E2E_PORT overrides it when that port is taken.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  // Outside src/, so neither Vitest nor the Tailwind scan discovers these files.
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // The HTML report never opens by itself, so a failed run does not block the terminal.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // One desktop browser (test-plan.md §7). The app has no auth, so no setup project or storageState.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The built app under `astro preview`: the only mode where the CSP (connect-src 'none') is in effect.
    // On CI, ci.yml has already built dist/ and run check:csp on it, so E2E serves that same artifact.
    command: process.env.CI
      ? `npm run preview -- --port ${PORT}`
      : `npm run build && npm run preview -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Astro 7's preview detects an agent and moves itself into a background daemon,
    // which Playwright reports as an early exit; this keeps it in the foreground.
    env: { ASTRO_PREVIEW_BACKGROUND: "1" },
  },
});
