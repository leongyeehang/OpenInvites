import { expect, expectNotFoundAsSent, test, type Browser, type Page } from "./test";
import { dismissOperatorWelcome, expectSignedInAs, latestMailTo, linkIn, mailCountTo, newHost, offersSiteSettings, PASSWORD, signIn, signUp, submitSignUp, verifyEmail } from "./hosts";
import { expectNoSeriousViolations } from "./axe";
import { recreate } from "./instances";

// Runs against `app-fresh` (compose.yaml), an instance of its own whose database starts empty:
// who creates the first account, and which registration mode is on, belong to the whole instance.
// So these scenarios run in order, each leaving the instance as the next one expects it. The
// operator works at desktop width; the people signing up are on 390px phones.
test.describe.configure({ mode: "serial" });

// The email OPERATOR_EMAIL names on app-fresh.
const OPERATOR = { name: "Olive Operator", email: "operator@fresh.openinvites.test" };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const REFUSED = "You need a host invitation from whoever runs it to create an account.";
const UNUSABLE = "This host invitation can no longer be used. Ask whoever runs this site for a new one.";

let firstHost: Page;
const FIRST = newHost("first");
let operator: Page;

// Recreating the database container as well gives an instance nobody has used.
test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh");
});

test.afterAll(async () => {
  await firstHost?.context().close();
  await operator?.context().close();
});

async function onPhone(browser: Browser): Promise<Page> {
  return (await browser.newContext(PHONE)).newPage();
}

// The first visit to the operator's dashboard (home page, ticket 04) opens a welcome sheet, which
// hides the page behind it, so the first account's way to Site settings is through it.
test("the first account on an empty instance is its operator, is welcomed once, and registration starts invitation only", async ({
  browser,
}) => {
  firstHost = await (await browser.newContext()).newPage();
  await signUp(firstHost, FIRST);
  const welcome = firstHost.getByRole("dialog", { name: "This site is yours" });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole("heading", { name: "This site is yours" })).toBeFocused();
  await expect(welcome.getByText("Not set: the home page says “OpenInvites”")).toBeVisible();
  await expect(welcome.getByText("Invitation only", { exact: true })).toBeVisible();
  await expect(welcome.getByText("50 events per host · kept 365 days after they end")).toBeVisible();
  await expect(welcome.locator("img")).toHaveAttribute("alt", "");

  // An open sheet is as accessible at a phone's width as at a desktop's.
  await expectNoSeriousViolations(firstHost, "the operator's welcome sheet, at desktop width");
  await firstHost.setViewportSize({ width: 390, height: 844 });
  await expectNoSeriousViolations(firstHost, "the operator's welcome sheet, at 390px");
  await firstHost.setViewportSize({ width: 1280, height: 800 });

  await welcome.getByRole("button", { name: "Name your site" }).click();
  await expect(firstHost).toHaveURL(/\/instance#home-page$/);
  await expect(firstHost.getByRole("heading", { name: "Site settings" })).toBeVisible();
  await expect(firstHost.getByLabel("Name", { exact: true })).toBeFocused();
  await expect(firstHost.getByLabel("Invitation only")).toBeChecked();

  await firstHost.goto("/dashboard");
  await firstHost.reload();
  await expect(firstHost.getByRole("heading", { name: "Your events" })).toBeVisible();
  await expect(firstHost.getByRole("dialog")).toHaveCount(0);
});

test("the sign-up page says a host invitation is needed, and a sign-up without one is refused", async ({ browser }) => {
  const page = await onPhone(browser);
  const host = newHost("uninvited");
  await page.goto("/sign-up");
  await expect(page.getByText("This site is invitation only. To create an account, you need a host invitation")).toBeVisible();

  await submitSignUp(page, host);
  await expect(page.getByText(REFUSED)).toBeVisible();
  await signIn(page, host.email, PASSWORD);
  await expect(page.getByText("That email and password do not match.")).toBeVisible();
  await page.context().close();
});

// Anyone may type the OPERATOR_EMAIL address into the sign-up form; only its verification link,
// sent to that address, shows the account is the operator's.
test("the email OPERATOR_EMAIL names signs up anyway, and takes over as the operator once it is verified", async ({
  browser,
  request,
}) => {
  // It restarts app-fresh, which on CI's runners takes a good part of the usual 90 seconds.
  test.setTimeout(180_000);
  operator = await (await browser.newContext()).newPage();
  const mails = await mailCountTo(request, OPERATOR.email);
  await signUp(operator, OPERATOR);
  await expect(operator.getByText("Verify your email")).toBeVisible();
  expect(await offersSiteSettings(operator)).toBe(false);
  await operator.goto("/instance");
  await expect(operator.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // Nor does a restart make an account the operator before its email is verified.
  recreate("app-fresh");
  await operator.goto("/dashboard");
  await expectSignedInAs(operator, OPERATOR.name);
  expect(await offersSiteSettings(operator)).toBe(false);
  await firstHost.goto("/dashboard");
  expect(await offersSiteSettings(firstHost)).toBe(true);

  await verifyEmail(operator, request, OPERATOR.email, mails);
  await operator.goto("/dashboard");
  // The new operator is welcomed in their turn, and once: Not now is for good.
  await dismissOperatorWelcome(operator);
  await operator.reload();
  expect(await offersSiteSettings(operator)).toBe(true);
  await expect(operator.getByRole("dialog")).toHaveCount(0);

  await firstHost.goto("/dashboard");
  await expectSignedInAs(firstHost, FIRST.name);
  expect(await offersSiteSettings(firstHost)).toBe(false);
  await firstHost.goto("/instance");
  await expect(firstHost.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a host invitation link lets one person sign up, and nobody after them", async ({ browser }) => {
  await operator.goto("/instance");
  await operator.getByRole("button", { name: "Create host invitation" }).click();
  await expect(operator.getByText("Host invitation created.")).toBeVisible();
  await operator.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await operator.getByRole("button", { name: "Copy link" }).click();
  await expect(operator.getByRole("button", { name: "Copied" })).toBeVisible();
  const link = await operator.evaluate(() => navigator.clipboard.readText());

  const invited = await onPhone(browser);
  const host = newHost("invited");
  await invited.goto(link);
  await expect(invited.getByText("You have a host invitation.")).toBeVisible();
  await submitSignUp(invited, host);
  await expect(invited).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expectSignedInAs(invited, host.name);
  // A host who is not the operator is not welcomed as one.
  await expect(invited.getByRole("heading", { name: "Your events" })).toBeVisible();
  await expect(invited.getByRole("dialog")).toHaveCount(0);

  const second = await onPhone(browser);
  await second.goto(link);
  await expect(second.getByText("This host invitation can no longer be used:")).toBeVisible();
  await submitSignUp(second, newHost("second"));
  await expect(second.getByText(UNUSABLE)).toBeVisible();

  await operator.reload();
  const row = operator.getByRole("listitem").filter({ hasText: `Used by ${host.email}` });
  await expect(row.getByText("Used", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  await invited.context().close();
  await second.context().close();
});

test("a host invitation emailed to someone fills in their email on the sign-up form", async ({ browser, request }) => {
  const host = newHost("emailed");
  await operator.goto("/instance");
  await operator.getByLabel("Email (optional)").fill(host.email);
  await operator.getByLabel("Email the link to this address").check();
  await operator.getByRole("button", { name: "Create host invitation" }).click();
  await expect(operator.getByText(`Sent to ${host.email}.`)).toBeVisible();
  await expect(operator.getByRole("listitem").filter({ hasText: host.email }).getByText("Pending")).toBeVisible();

  const mail = await latestMailTo(request, host.email);
  expect(mail).toContain("Here is your host invitation for OpenInvites.");
  const invited = await onPhone(browser);
  await invited.goto(linkIn(mail));
  await expect(invited.getByLabel("Email")).toHaveValue(host.email);
  await invited.getByLabel("Display name").fill(host.name);
  await invited.getByLabel("Password").fill(PASSWORD);
  await invited.getByRole("button", { name: "Create account" }).click();
  await expect(invited).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await invited.context().close();
});

test("a revoked host invitation lets nobody in", async ({ browser }) => {
  const addressee = newHost("revoked");
  await operator.goto("/instance");
  await operator.getByLabel("Email (optional)").fill(addressee.email);
  await operator.getByRole("button", { name: "Create host invitation" }).click();
  const link = await operator.getByLabel("Host invitation link").inputValue();
  const row = operator.getByRole("listitem").filter({ hasText: addressee.email });
  await expect(row.getByText("Pending")).toBeVisible();
  await expect(row.getByText("Expires in 14 days")).toBeVisible();
  await row.getByRole("button", { name: "Revoke" }).click();
  // Exactly: the address itself has "revoked" in it.
  await expect(row.getByText("Revoked", { exact: true })).toBeVisible();

  const page = await onPhone(browser);
  await page.goto(link);
  await expect(page.getByText("This host invitation can no longer be used:")).toBeVisible();
  await submitSignUp(page, addressee);
  await expect(page.getByText(UNUSABLE)).toBeVisible();
  await page.context().close();
});

test("a host invitation link nobody made is not found", async ({ request }) => {
  await expectNotFoundAsSent(await request.get("/host-invitation/not-a-real-token", { maxRedirects: 0 }));
});

test("switching registration to Open lets anyone sign up", async ({ browser }) => {
  await operator.goto("/instance");
  await operator.getByLabel("Open", { exact: true }).check();
  await operator.locator("form").filter({ has: operator.getByLabel("Open", { exact: true }) }).getByRole("button", { name: "Save" }).click();
  await expect(operator.getByText("Saved.")).toBeVisible();

  const page = await onPhone(browser);
  await page.goto("/sign-up");
  await expect(page.getByText("This site is invitation only")).toHaveCount(0);
  await signUp(page, newHost("open"));
  await page.context().close();
});
