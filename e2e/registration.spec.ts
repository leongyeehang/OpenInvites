import { expect, expectNotFoundAsSent, test, type Browser, type Page } from "./test";
import { latestMailTo, linkIn, mailCountTo, newHost, PASSWORD, signIn, signUp, submitSignUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";

// Runs against `app-fresh` (compose.yaml), an instance of its own whose database starts empty:
// who creates the first account, and which registration mode is on, belong to the whole instance.
// So these scenarios run in order, each leaving the instance as the next one expects it. The
// operator works at desktop width; the people signing up are on 390px phones.
test.describe.configure({ mode: "serial" });

// The email OPERATOR_EMAIL names on app-fresh.
const OPERATOR = { name: "Olive Operator", email: "operator@fresh.openinvites.test" };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const REFUSED = "You need a host invitation from its operator to create an account.";
const UNUSABLE = "This host invitation can no longer be used. Ask the operator of this instance for a new one.";

let firstHost: Page;
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

test("the first account on an empty instance is its operator, and registration starts invitation only", async ({
  browser,
}) => {
  firstHost = await (await browser.newContext()).newPage();
  await signUp(firstHost, newHost("first"));
  await firstHost.getByRole("link", { name: "Instance settings" }).click();
  await expect(firstHost.getByRole("heading", { name: "Instance settings" })).toBeVisible();
  await expect(firstHost.getByLabel("Invitation only")).toBeChecked();
});

test("the sign-up page says a host invitation is needed, and a sign-up without one is refused", async ({ browser }) => {
  const page = await onPhone(browser);
  const host = newHost("uninvited");
  await page.goto("/sign-up");
  await expect(page.getByText("This instance is invitation only. To create an account, you need a host invitation")).toBeVisible();

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
  test.slow();
  operator = await (await browser.newContext()).newPage();
  const mails = await mailCountTo(request, OPERATOR.email);
  await signUp(operator, OPERATOR);
  await expect(operator.getByText("Verify your email")).toBeVisible();
  await expect(operator.getByRole("link", { name: "Instance settings" })).toHaveCount(0);
  await operator.goto("/instance");
  await expect(operator.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // Nor does a restart make an account the operator before its email is verified.
  recreate("app-fresh");
  await operator.goto("/dashboard");
  await expect(operator.getByRole("banner").getByText(OPERATOR.name)).toBeVisible();
  await expect(operator.getByRole("link", { name: "Instance settings" })).toHaveCount(0);
  await firstHost.goto("/dashboard");
  await expect(firstHost.getByRole("link", { name: "Instance settings" })).toBeVisible();

  await verifyEmail(operator, request, OPERATOR.email, mails);
  await operator.goto("/dashboard");
  await expect(operator.getByRole("link", { name: "Instance settings" })).toBeVisible();

  await firstHost.goto("/dashboard");
  await expect(firstHost.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(firstHost.getByRole("link", { name: "Instance settings" })).toHaveCount(0);
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
  await expect(invited.getByRole("banner").getByText(host.name)).toBeVisible();

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
  await expect(row.getByText("Revoked")).toBeVisible();

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
  await operator.getByRole("button", { name: "Save" }).click();
  await expect(operator.getByText("Saved.")).toBeVisible();

  const page = await onPhone(browser);
  await page.goto("/sign-up");
  await expect(page.getByText("This instance is invitation only")).toHaveCount(0);
  await signUp(page, newHost("open"));
  await page.context().close();
});
