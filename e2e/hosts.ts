import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Shared steps for tests that need a host. Mailpit, the fake mail server of the Compose test
// profile, exposes its API on 8025.
export const MAILPIT = "http://localhost:8025";
export const PASSWORD = "correct horse battery";

// The operator of `app`: the account OPERATOR_EMAIL names in compose.yaml and .env.development.
export const OPERATOR = { name: "Olive Operator", email: "operator@openinvites.test" };

export function newHost(label: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { name: `Ada ${suffix}`, email: `${label}-${suffix}@example.test` };
}

// Fills in the sign-up form on the page already open, and sends it.
export async function submitSignUp(page: Page, host: { name: string; email: string }) {
  await page.getByLabel("Display name").fill(host.name);
  await page.getByLabel("Email").fill(host.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function signUp(page: Page, host: { name: string; email: string }) {
  await page.goto("/sign-up");
  await submitSignUp(page, host);
  // Sign-up hashes the password and sends the verification email before it redirects.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  // The operator's welcome sheet, if it is open, hides the page behind it from the accessibility tree.
  await expect(page.getByRole("banner").getByRole("button", { name: "Account menu" }).or(page.getByRole("dialog", { name: "This site is yours" }))).toBeVisible();
}

// The operator's first visit to their dashboard opens a welcome sheet (home page, ticket 04). A
// spec whose first account becomes the operator closes it with Not now, as that account would.
export async function dismissOperatorWelcome(page: Page) {
  const welcome = page.getByRole("dialog", { name: "This site is yours" });
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "Not now" }).click();
  await expect(welcome).toBeHidden();
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

// The host's initials in the header open the account menu (dashboard, ticket 02): their name and
// email, Account, Site settings for the operator, and Sign out.
export async function openAccountMenu(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Account menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

// Who is signed in: the account menu names them, where the header named them before.
export async function expectSignedInAs(page: Page, name: string) {
  const menu = await openAccountMenu(page);
  await expect(menu.getByText(name, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
}

export async function signOut(page: Page) {
  await (await openAccountMenu(page)).getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}

export async function toSiteSettings(page: Page) {
  await (await openAccountMenu(page)).getByRole("menuitem", { name: "Site settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Site settings" })).toBeVisible();
}

// Whether the account menu offers Site settings, which only the operator's does. The menu is
// closed again afterwards.
export async function offersSiteSettings(page: Page): Promise<boolean> {
  const menu = await openAccountMenu(page);
  await expect(menu.getByRole("menuitem", { name: "Account" })).toBeVisible();
  const offered = (await menu.getByRole("menuitem", { name: "Site settings" }).count()) > 0;
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  return offered;
}

export async function mailCountTo(request: APIRequestContext, email: string): Promise<number> {
  const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  return ((await response.json()) as { messages: unknown[] }).messages.length;
}

// The newest email Mailpit holds for this address, as plain text. `after` waits for one that
// arrived once there were that many, for an address that has had mail before.
export async function latestMailTo(request: APIRequestContext, email: string, after = 0): Promise<string> {
  let id = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
        const body = (await response.json()) as { messages: { ID: string }[] };
        id = body.messages[0]?.ID ?? "";
        return body.messages.length;
      },
      { timeout: 15_000, message: `an email to ${email}` },
    )
    .toBeGreaterThan(after);
  const message = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string };
  return message.Text;
}

export function linkIn(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No link in:\n${text}`);
  return match[0];
}

// Opens the verification link from the sign-up email on this page.
export async function verifyEmail(page: Page, request: APIRequestContext, email: string, after = 0) {
  const link = linkIn(await latestMailTo(request, email, after));
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
}

// A host who is signed up and verified, ready to create events.
export async function signUpVerified(page: Page, request: APIRequestContext, label: string) {
  const host = newHost(label);
  await signUp(page, host);
  await verifyEmail(page, request, host.email);
  return host;
}

// Asks for a reset link and returns it once it has arrived.
export async function requestResetLink(page: Page, request: APIRequestContext, email: string): Promise<string> {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("a reset link is on its way")).toBeVisible();
  await expect.poll(async () => (await latestMailTo(request, email)).includes("choose a new password")).toBe(true);
  return linkIn(await latestMailTo(request, email));
}
