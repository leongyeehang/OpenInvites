import { expect, test } from "./test";
import { newHost, OPERATOR, PASSWORD, signIn, signUp } from "./hosts";

// What depends on the registration mode runs on an instance of its own (registration.spec.ts).
// This is what the operator of `app` and everyone else see of the instance settings page.

test("the operator reaches the instance settings from the host area", async ({ page }) => {
  await signIn(page, OPERATOR.email, PASSWORD);
  await page.getByRole("link", { name: "Instance settings" }).click();
  await expect(page.getByRole("heading", { name: "Instance settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registration" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Host invitations", exact: true })).toBeVisible();
});

test("anyone else, signed in or not, finds the page an unknown address gives, and no link to it", async ({ page }) => {
  const unknown = await page.goto("/no-such-page");
  const unknownTitle = await page.title();
  expect(unknown?.status()).toBe(404);

  const signedOut = await page.goto("/instance");
  expect(signedOut?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(await page.title()).toBe(unknownTitle);

  await signUp(page, newHost("not-operator"));
  await expect(page.getByRole("link", { name: "Instance settings" })).toHaveCount(0);
  const signedIn = await page.goto("/instance");
  expect(signedIn?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(await page.title()).toBe(unknownTitle);
});
