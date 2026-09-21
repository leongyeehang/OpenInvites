import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  latestMailTo,
  linkIn,
  mailCountTo,
  newHost,
  PASSWORD,
  requestResetLink,
  signIn,
  signOut,
  signUp,
} from "./hosts";

test("a person signs up, verifies their email through the fake mail server, and the banner goes away", async ({
  page,
  request,
}) => {
  const host = newHost("verify");
  await signUp(page, host);
  await expect(page.getByText("Verify your email")).toBeVisible();
  await expect(page.getByText(`We sent a link to ${host.email}`)).toBeVisible();

  await page.goto(linkIn(await latestMailTo(request, host.email)));
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();

  await page.getByRole("link", { name: "Go to your dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Verify your email")).toHaveCount(0);
});

test("the banner resends the verification email", async ({ page, request }) => {
  const host = newHost("resend");
  await signUp(page, host);
  await page.getByRole("button", { name: "Resend email" }).click();
  await expect(page.getByText("Sent. Check your inbox.")).toBeVisible();
  await expect.poll(() => mailCountTo(request, host.email)).toBe(2);
});

test("sessions on two devices are independent: signing out of one keeps the other signed in", async ({
  page,
  browser,
}) => {
  const host = newHost("devices");
  await signUp(page, host);

  const otherDevice = await browser.newContext();
  const otherPage = await otherDevice.newPage();
  await signIn(otherPage, host.email, PASSWORD);
  await expect(otherPage).toHaveURL(/\/dashboard$/);

  await signOut(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);

  await otherPage.reload();
  await expect(otherPage).toHaveURL(/\/dashboard$/);
  await expect(otherPage.getByRole("banner").getByText(host.name)).toBeVisible();
  await otherDevice.close();
});

test("a host changes their display name and sees it in the header", async ({ page }) => {
  const host = newHost("rename");
  await signUp(page, host);
  await page.getByRole("banner").getByRole("link", { name: host.name }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByLabel("Display name").fill("Grace Hopper");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Display name saved.")).toBeVisible();
  await expect(page.getByRole("banner").getByText("Grace Hopper")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("banner").getByText("Grace Hopper")).toBeVisible();
});

test("a host changes their password and signs in with the new one", async ({ page }) => {
  const host = newHost("password");
  await signUp(page, host);
  await page.goto("/account");
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password").fill("a brand new passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();

  await signOut(page);
  await signIn(page, host.email, "a brand new passphrase");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a host resets a forgotten password by email", async ({ page, request }) => {
  const host = newHost("reset");
  await signUp(page, host);
  await signOut(page);

  await page.goto(await requestResetLink(page, request, host.email));
  await page.getByLabel("New password").fill("another passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your password has been changed.")).toBeVisible();

  await signIn(page, host.email, PASSWORD);
  await expect(page.getByText("That email and password do not match.")).toBeVisible();
  await signIn(page, host.email, "another passphrase");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a reset link cannot be used twice", async ({ page, request }) => {
  const host = newHost("reuse");
  await signUp(page, host);
  await signOut(page);
  const link = await requestResetLink(page, request, host.email);

  await page.goto(link);
  await page.getByLabel("New password").fill("first new passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  await page.goto(link);
  await page.getByLabel("New password").fill("second new passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("This link is not valid or has expired.")).toBeVisible();
});

test("the operator resets a host's password with the command inside the container", async ({ page }) => {
  const host = newHost("operator");
  await signUp(page, host);
  await signOut(page);

  const output = execFileSync(
    "docker",
    ["compose", "--profile", "test", "exec", "-T", "app", "node", "scripts/reset-password.mjs", host.email],
    { encoding: "utf8" },
  );
  const temporaryPassword = output.match(/Temporary password for .*: (\S+)/)?.[1];
  expect(temporaryPassword, output).toBeTruthy();

  await signIn(page, host.email, temporaryPassword!);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a host deletes their account after confirming with their password", async ({ page }) => {
  const host = newHost("delete");
  await signUp(page, host);
  await page.goto("/account");
  await page.getByRole("button", { name: "Delete account" }).click();

  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Delete your account?")).toBeVisible();
  await dialog.getByLabel("Password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Delete my account" }).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();

  await signIn(page, host.email, PASSWORD);
  await expect(page.getByText("That email and password do not match.")).toBeVisible();
});

test("a visitor who is not signed in is sent to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
});
