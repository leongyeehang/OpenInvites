import { expectNoSeriousViolations } from "./axe";
import { signOut, signUpVerified } from "./hosts";
import { expect, test, type Page } from "./test";

// M4 ticket 08: a host adds a passkey on their account page, signs in with it, renames and removes
// it. The device is Chromium's virtual authenticator, which answers as a fingerprint would.

async function virtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

function passkeysCard(page: Page) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: "Passkeys" }) });
}

test("a host adds a passkey, signs in with it by keyboard, renames it, and once it is removed it signs nobody in", async ({ page, request }) => {
  test.slow();
  await virtualAuthenticator(page);
  await signUpVerified(page, request, "passkeys");

  await page.goto("/account");
  const card = passkeysCard(page);
  await expect(card.getByText("You have no passkeys yet.")).toBeVisible();
  await card.getByRole("button", { name: "Add a passkey" }).click();
  await expect(card.getByRole("status")).toHaveText("Passkey added.", { timeout: 15_000 });
  await expect(card.getByText("Passkey 1", { exact: true })).toBeVisible();
  await expect(card.getByText(/Not used to sign in yet/)).toBeVisible();
  await expectNoSeriousViolations(page, "the account page with a passkey");

  // Renamed, it keeps the new name across a reload.
  await card.getByRole("button", { name: "Rename Passkey 1" }).click();
  await card.getByLabel("Name").fill("Work laptop");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Work laptop", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(card.getByText("Work laptop", { exact: true })).toBeVisible();

  // Signed out, the sign-in page offers the passkey in the email field as it opens, and the virtual
  // authenticator, which needs no touch, takes the offer: the host is signed in.
  await signOut(page);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await signOut(page);

  // In a browser without that offer, the button signs in, by keyboard alone; the account page then
  // says when the passkey was last used.
  await page.addInitScript(() => {
    if (window.PublicKeyCredential) window.PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  });
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("autocomplete", "username webauthn");
  await expectNoSeriousViolations(page, "the sign-in page with the passkey button");
  const button = page.getByRole("button", { name: "Sign in with a passkey" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto("/account");
  await expect(card.getByText(/Last used/)).toBeVisible();

  // Removed, after a confirmation: the email and password stay, and the passkey signs nobody in.
  await card.getByRole("button", { name: "Remove Work laptop" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("You won’t be able to sign in with Work laptop any more.");
  await confirm.getByRole("button", { name: "Remove it" }).click();
  await expect(card.getByText("You have no passkeys yet.")).toBeVisible({ timeout: 15_000 });
  await signOut(page);
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByText("That passkey didn’t sign you in. Try again, or sign in with your email and password.")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/sign-in/);
});
