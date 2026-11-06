import { expect, expectNotFoundAsSent, test } from "./test";
import { newHost, offersSiteSettings, OPERATOR, PASSWORD, signIn, signUp, toSiteSettings } from "./hosts";

// What depends on the registration mode runs on an instance of its own (registration.spec.ts).
// This is what the operator of `app` and everyone else see of the instance settings page.

test("the operator reaches the instance settings from the host area", async ({ page }) => {
  await signIn(page, OPERATOR.email, PASSWORD);
  await toSiteSettings(page);
  await expect(page.getByRole("heading", { name: "Site settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registration" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Host invitations", exact: true })).toBeVisible();
});

// The account menu under the operator's initials, by keyboard alone (dashboard, ticket 02).
test("the operator's account menu opens, moves and closes by keyboard, and leads to Site settings", async ({ page }) => {
  await signIn(page, OPERATOR.email, PASSWORD);
  const trigger = page.getByRole("banner").getByRole("button", { name: "Account menu" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByText(OPERATOR.name)).toBeVisible();
  await expect(menu.getByText(OPERATOR.email)).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveText(["Account", "Site settings", "Sign out"]);
  await expect(menu.getByRole("menuitem", { name: "Account" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Site settings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitem", { name: "Account" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Site settings" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Site settings" })).toBeVisible();
});

test("anyone else, signed in or not, finds the page an unknown address gives, and no link to it", async ({ page }) => {
  const unknown = await page.goto("/no-such-page");
  const unknownTitle = await page.title();
  expect(unknown?.status()).toBe(404);

  await expectNotFoundAsSent(await page.goto("/instance"));
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(await page.title()).toBe(unknownTitle);

  await signUp(page, newHost("not-operator"));
  expect(await offersSiteSettings(page)).toBe(false);
  await expectNotFoundAsSent(await page.goto("/instance"));
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(await page.title()).toBe(unknownTitle);
});

// Emailing a host invitation is mail like any other (RATE_LIMIT_MAIL=5/1m in the Compose test
// profile and .env.development).
test("the operator emailing host invitation after host invitation is told to slow down in the form", async ({ page }) => {
  await signIn(page, OPERATOR.email, PASSWORD);
  await toSiteSettings(page);
  const invite = async (email: string) => {
    await page.getByLabel("Email (optional)").fill(email);
    await page.getByLabel("Email the link to this address").check();
    await page.getByRole("button", { name: "Create host invitation" }).click();
  };
  for (let sent = 0; sent < 5; sent++) {
    const email = newHost(`invited-${sent}`).email;
    await invite(email);
    await expect(page.getByText(`Sent to ${email}.`)).toBeVisible();
  }
  await invite(newHost("invited-too-many").email);
  await expect(page.getByText("You’re going too fast. Try again shortly.")).toBeVisible();
});

