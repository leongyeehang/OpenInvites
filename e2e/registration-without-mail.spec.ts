import { expect, test, type Page } from "@playwright/test";
import { newHost, signUp } from "./hosts";
import { recreate } from "./instances";

// Runs against `app-no-mail` (compose.yaml): an instance of its own that has no mail, so no email
// can be verified there. The account OPERATOR_EMAIL names may still sign up, but an operator who
// is already there stays the operator until a restart, which only the operator can bring about.
// In order, like registration.spec.ts.
test.describe.configure({ mode: "serial" });
test.use({ baseURL: "http://localhost:3003" });

// The email OPERATOR_EMAIL names on app-no-mail.
const OPERATOR = { name: "Olive Operator", email: "operator@no-mail.openinvites.test" };

let firstHost: Page;
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
  await signUp(firstHost, newHost("no-mail-first"));
  await firstHost.getByRole("link", { name: "Instance settings" }).click();
  await expect(firstHost.getByLabel("Email (optional)")).toBeVisible();
  await expect(firstHost.getByLabel("Email the link to this address")).toHaveCount(0);
  await firstHost.getByRole("button", { name: "Create host invitation" }).click();
  await expect(firstHost.getByLabel("Host invitation link")).toHaveValue(/^http:\/\/localhost:3003\/host-invitation\//);
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

test("a restart hands the instance to the account OPERATOR_EMAIL names", async () => {
  test.slow();
  recreate("app-no-mail");
  await operator.goto("/dashboard");
  await expect(operator.getByRole("link", { name: "Instance settings" })).toBeVisible();

  await firstHost.goto("/dashboard");
  await expect(firstHost.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(firstHost.getByRole("link", { name: "Instance settings" })).toHaveCount(0);
});
