import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// The specs that need an instance to themselves: `app-fresh` and `app-no-mail` of the Compose
// test profile.
const FRESH_INSTANCE = /registration(-without-mail)?\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    // The specs read the English interface, so every browser asks for English whatever the
    // machine running them speaks; e2e/locales.spec.ts asks for the other languages itself.
    locale: "en-US",
    trace: "on-first-retry",
  },
  projects: [
    // The operator of `app` opens registration to everyone before the specs that sign up hosts.
    {
      name: "operator",
      testMatch: /operator\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      dependencies: ["operator"],
      testIgnore: FRESH_INSTANCE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: "desktop",
      dependencies: ["operator"],
      testIgnore: FRESH_INSTANCE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    // One instance per spec, so one project: each spec's scenarios run in order and change what
    // its instance is. The operator works at desktop width and the people signing up at 390px.
    {
      name: "fresh-instance",
      testMatch: FRESH_INSTANCE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, baseURL: "http://localhost:3002" },
    },
  ],
});
