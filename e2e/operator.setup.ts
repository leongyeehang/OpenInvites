import { expect, test as setup } from "./test";
import { mailCountTo, OPERATOR, PASSWORD, signIn, signUp, verifyEmail } from "./hosts";

// Every other spec signs up hosts of its own, so `app` runs with registration open. Its operator
// opens it here, on the instance settings page, as a person would: signing in to the account an
// earlier run left, or signing up, which the email OPERATOR_EMAIL names may always do. On an
// instance with mail that account runs it only once its email is verified, so it verifies first.
setup("the operator opens registration to everyone", async ({ page, request }) => {
  const noAccount = page.getByText("That email and password do not match.");
  const unverified = page.getByText("Verify your email");
  const mails = await mailCountTo(request, OPERATOR.email);
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page.getByRole("banner").or(noAccount)).toBeVisible({ timeout: 15_000 });
  if (await noAccount.isVisible()) await signUp(page, OPERATOR);
  else if (await unverified.isVisible()) await page.getByRole("button", { name: "Resend email" }).click();
  if (await unverified.isVisible()) await verifyEmail(page, request, OPERATOR.email, mails);

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Instance settings" }).click();
  await page.getByLabel("Open", { exact: true }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});
