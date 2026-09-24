import { defineConfig, devices } from "@playwright/test";

// `pnpm perf`: the event page's Lighthouse audit (perf/event-page.perf.ts) against the `app` of the
// Compose test profile, which the browser tests' operator first opens to sign-ups, as it does for
// them. One page at a time, so no audit shares the machine with another.
export default defineConfig({
  testDir: "./perf",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "en-US",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: "operator", testDir: "./e2e", testMatch: /operator\.setup\.ts/ },
    { name: "lighthouse", testMatch: /\.perf\.ts$/, dependencies: ["operator"] },
  ],
});
