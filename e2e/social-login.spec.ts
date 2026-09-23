import { expect, test } from "@playwright/test";

// `app` (the default baseURL, port 3000) has no Google or GitHub credentials configured.
// `app-social` (port 3001) is the same image with dummy credentials for both, started by the
// Compose `test` profile alongside `app`. Neither container's tests call the real providers.
const CONFIGURED_BASE_URL = "http://localhost:3001";

test("the sign-in and sign-up pages have no social buttons when the operator has configured no provider", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toHaveCount(0);

  await page.goto("/sign-up");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toHaveCount(0);
});

test("the sign-in and sign-up pages show a button for each provider the operator has configured", async ({ page }) => {
  await page.goto(`${CONFIGURED_BASE_URL}/sign-in`);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();

  await page.goto(`${CONFIGURED_BASE_URL}/sign-up`);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
});
