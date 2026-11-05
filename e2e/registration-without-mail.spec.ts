import { expect, test, type Page } from "./test";
import { dismissOperatorWelcome, newHost, signUp } from "./hosts";
import { recreate } from "./instances";

// Runs against `app-no-mail` (compose.yaml): an instance of its own that has no mail, so no email
// can be verified there. The account OPERATOR_EMAIL names may still sign up, but an operator who
// is already there stays the operator until a restart, which only the operator can bring about.
// Without mail, a host who forgets their password is sent to the operator instead. In order, like
// registration.spec.ts.
test.describe.configure({ mode: "serial" });
test.use({ baseURL: "http://localhost:3003" });

// The email OPERATOR_EMAIL names on app-no-mail.
const OPERATOR = { name: "Olive Operator", email: "operator@no-mail.openinvites.test" };

let firstHost: Page;
let firstHostName: string;
let operator: Page;

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-no-mail", "app-no-mail");
});

test.afterAll(async () => {
  await firstHost?.context().close();
  await operator?.context().close();
});

test("the first account is the operator, and has no way to email a host invitation", async ({ browser }) => {
  firstHost = await (await browser.newContext()).newPage();
  const host = newHost("no-mail-first");
  firstHostName = host.name;
  await signUp(firstHost, host);
  await dismissOperatorWelcome(firstHost);
  await firstHost.getByRole("link", { name: "Instance settings" }).click();
  await expect(firstHost.getByLabel("Email (optional)")).toBeVisible();
  await expect(firstHost.getByLabel("Email the link to this address")).toHaveCount(0);
  await firstHost.getByRole("button", { name: "Create host invitation" }).click();
  await expect(firstHost.getByLabel("Host invitation link")).toHaveValue(/^http:\/\/localhost:3003\/host-invitation\//);
});

test("the operator can have the home page say Run by their name", async ({ page }) => {
  await firstHost.goto("/instance");
  await firstHost.getByRole("button", { name: "More options" }).click();
  await firstHost.getByLabel("Show “Run by” with my display name").check();
  await firstHost.locator("form").filter({ has: firstHost.getByLabel("Welcome line") }).getByRole("button", { name: "Save" }).click();
  await expect(firstHost.getByText("Saved.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(`Run by ${firstHostName}`, { exact: true })).toBeVisible();
});

test("a new account with the email OPERATOR_EMAIL names does not take over from the operator", async ({ browser }) => {
  operator = await (await browser.newContext()).newPage();
  await signUp(operator, OPERATOR);
  await expect(operator.getByRole("link", { name: "Instance settings" })).toHaveCount(0);
  await operator.goto("/instance");
  await expect(operator.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await firstHost.goto("/dashboard");
  await expect(firstHost.getByRole("link", { name: "Instance settings" })).toBeVisible();
});

test("a restart hands the instance to the account OPERATOR_EMAIL names", async ({ page }) => {
  test.slow();
  recreate("app-no-mail");
  await operator.goto("/dashboard");
  // The new operator's welcome sheet, by keyboard alone: the Tab key stays inside it, and Escape
  // closes it as Not now does, the focus going to the page's heading.
  const welcome = operator.getByRole("dialog", { name: "This site is yours" });
  await expect(welcome.getByRole("heading", { name: "This site is yours" })).toBeFocused();
  for (let tab = 0; tab < 6; tab++) {
    await operator.keyboard.press("Tab");
    expect(await operator.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  }
  await operator.keyboard.press("Escape");
  await expect(welcome).toBeHidden();
  await expect(operator.getByRole("heading", { name: "Your events" })).toBeFocused();
  await operator.reload();
  await expect(operator.getByRole("heading", { name: "Your events" })).toBeVisible();
  await expect(operator.getByRole("dialog")).toHaveCount(0);
  await expect(operator.getByRole("link", { name: "Instance settings" })).toBeVisible();

  // The first operator's consent to be named does not pass to the account that took the seat.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^Run by/)).toBeHidden();
  await operator.goto("/instance");
  await operator.getByRole("button", { name: "More options" }).click();
  await expect(operator.getByLabel("Show “Run by” with my display name")).not.toBeChecked();

  await firstHost.goto("/dashboard");
  await expect(firstHost.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(firstHost.getByRole("link", { name: "Instance settings" })).toHaveCount(0);
});

test("a host who forgets their password is told how to reach the operator, as readers of the legal pages are", async ({ page }) => {
  const contact = "help@no-mail.openinvites.test";
  await page.goto("/forgot-password");
  await expect(page.getByText("This instance cannot send email, so the operator resets passwords by hand.")).toBeVisible();
  await expect(page.getByText(`Contact the operator at ${contact} to reset your password.`)).toBeVisible();
  await expect(page.getByRole("link", { name: contact })).toHaveAttribute("href", `mailto:${contact}`);
  for (const path of ["/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: contact }), path).toHaveAttribute("href", `mailto:${contact}`);
  }
});

// From magic-link.spec.ts, here so that no spec of the mobile or desktop project opens this
// instance while the fresh-instance or retention projects restart it.
test("the sign-in page of an instance without mail has no sign-in link form", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email me a sign-in link" })).toHaveCount(0);
  await expect(page.getByLabel("Email for the sign-in link")).toHaveCount(0);
});
