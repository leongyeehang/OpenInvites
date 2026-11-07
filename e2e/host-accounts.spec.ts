import { execFileSync } from "node:child_process";
import { expect, test } from "./test";
import {
  latestMailTo,
  linkIn,
  mailCountTo,
  newHost,
  openAccountMenu,
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

// The banner is part of the frame, as wide as the header above it (dashboard leftovers).
test("the verification banner lines up with the header", async ({ page }) => {
  await signUp(page, newHost("banner-width"));
  const banner = page.getByRole("alert").filter({ hasText: "Verify your email" });
  const [bannerBox, nameBox, menuBox] = await Promise.all([
    banner.boundingBox(),
    page.getByRole("banner").getByRole("link").first().boundingBox(),
    page.getByRole("banner").getByRole("button", { name: "Account menu" }).boundingBox(),
  ]);
  expect(Math.abs(bannerBox!.x - nameBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(bannerBox!.x + bannerBox!.width - (menuBox!.x + menuBox!.width))).toBeLessThanOrEqual(1);
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
  await expect((await openAccountMenu(otherPage)).getByText(host.name)).toBeVisible();
  await otherDevice.close();
});

// The header's account menu names the host, and its initials stand for them (dashboard, ticket 02).
test("a host changes their display name and sees it in the header", async ({ page }) => {
  const host = newHost("rename");
  await signUp(page, host);
  await (await openAccountMenu(page)).getByRole("menuitem", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByLabel("Display name").fill("Grace Hopper");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Display name saved.")).toBeVisible();
  await expect((await openAccountMenu(page)).getByText("Grace Hopper")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/dashboard");
  await expect(page.getByRole("banner").getByRole("button", { name: "Account menu" })).toHaveText("GH");
  await expect((await openAccountMenu(page)).getByText("Grace Hopper")).toBeVisible();
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

test("resetting a password by email signs the host out on every device, the one that reset it too", async ({
  page,
  browser,
  request,
}) => {
  const host = newHost("reset-everywhere");
  await signUp(page, host);
  const otherDevice = await browser.newContext();
  const otherPage = await otherDevice.newPage();
  await signIn(otherPage, host.email, PASSWORD);
  await expect(otherPage).toHaveURL(/\/dashboard$/);

  await page.goto(await requestResetLink(page, request, host.email));
  await page.getByLabel("New password").fill("a passphrase nobody else has");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Your password has been changed. Sign in with the new one.")).toBeVisible();

  await otherPage.goto("/dashboard");
  await expect(otherPage).toHaveURL(/\/sign-in$/);
  await otherDevice.close();

  await signIn(page, host.email, "a passphrase nobody else has");
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

test("the operator resets a host's password with the command inside the container, signing them out", async ({
  page,
}) => {
  const host = newHost("operator");
  await signUp(page, host);

  const output = execFileSync(
    "docker",
    ["compose", "--profile", "test", "exec", "-T", "app", "node", "scripts/reset-password.mjs", host.email],
    { encoding: "utf8" },
  );
  const temporaryPassword = output.match(/Temporary password for .*: (\S+)/)?.[1];
  expect(temporaryPassword, output).toBeTruthy();
  expect(output).toContain("They have been signed out everywhere.");

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
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

// The account menu is named for who is signed in, so a screen reader says whose it is as it opens
// (dashboard leftovers).
test("the account menu is named for the host it belongs to", async ({ page }) => {
  const host = newHost("menu-name");
  await signUp(page, host);
  await openAccountMenu(page);
  await expect(page.getByRole("menu", { name: `${host.name} ${host.email}` })).toBeVisible();
});

// Before the page's script has run, or where it never does, the initials are a link to the Account
// page, and the Account page signs the host out (dashboard leftovers).
test("without JavaScript the initials open the Account page, which signs the host out", async ({ page, browser }) => {
  const host = newHost("no-script");
  await signUp(page, host);
  const plain = await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() });
  const noScript = await plain.newPage();
  await noScript.goto("/dashboard");
  await noScript.getByRole("banner").getByRole("button", { name: "Account menu" }).click();
  await expect(noScript).toHaveURL(/\/account$/);
  await noScript.getByRole("button", { name: "Sign out" }).click();
  await expect(noScript).toHaveURL(/\/$/);
  await noScript.goto("/dashboard");
  await expect(noScript).toHaveURL(/\/sign-in$/);
  await plain.close();
});

test("a visitor who is not signed in is sent to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
});
