import { expect, test } from "./test";

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

// A Google sign-in the rate limits refuse comes back to the sign-in page, which says so.
// `app-social` counts sign-ins as low as `app` does (RATE_LIMIT_SIGN_IN=5/1m, compose.yaml); the
// provider's page is stood in for, as no test may reach Google.
test("someone starting sign-in with Google again and again is told to slow down on the sign-in page", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Google</h1>" }));
  for (let tried = 0; tried < 5; tried++) {
    await page.goto(`${CONFIGURED_BASE_URL}/sign-in`);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
  }
  await page.goto(`${CONFIGURED_BASE_URL}/sign-in`);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(`${CONFIGURED_BASE_URL}/sign-in?socialError=1&error=TOO_MANY_REQUESTS`);
  await expect(page.getByText("You’re going too fast. Try again shortly.")).toBeVisible();
});
