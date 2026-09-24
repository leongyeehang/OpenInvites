import { defineConfig, devices } from "@playwright/test";

// The contributor tools in scripts/ that drive the app as the browser tests do (CONTRIBUTING.md):
// `pnpm measure:backgrounds` (scripts/measure-backgrounds.ts) and `pnpm screenshots`
// (scripts/screenshots.ts). They run against whatever is on port 3000, `pnpm dev` or the Compose
// test profile, whose operator first opens the instance to sign-ups, as the browser tests'
// operator does. One test at a time, so no measurement shares the machine with another.
export default defineConfig({
  testDir: "./scripts",
  workers: 1,
  reporter: "list",
  reportSlowTests: null,
  timeout: 10 * 60_000,
  use: {
    baseURL: "http://localhost:3000",
    locale: "en-US",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: "operator", testDir: "./e2e", testMatch: /operator\.setup\.ts/ },
    { name: "backgrounds", testMatch: /measure-backgrounds\.ts$/, dependencies: ["operator"] },
    { name: "screenshots", testMatch: /screenshots\.ts$/, dependencies: ["operator"] },
  ],
});
