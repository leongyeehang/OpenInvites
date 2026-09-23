import { expect, test as setup } from "@playwright/test";
import { OPERATOR, PASSWORD, signIn, signUp } from "./hosts";

// Every other spec signs up hosts of its own, so `app` runs with registration open. Its operator
// opens it here, on the instance settings page, as a person would: signing in to the account an
// earlier run left, or signing up, which the email OPERATOR_EMAIL names may always do.
setup("the operator opens registration to everyone", async ({ page }) => {
  const settings = page.getByRole("link", { name: "Instance settings" });
  const noAccount = page.getByText("That email and password do not match.");
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(settings.or(noAccount)).toBeVisible({ timeout: 15_000 });
  if (await noAccount.isVisible()) await signUp(page, OPERATOR);

  await settings.click();
  await page.getByLabel("Open", { exact: true }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});
