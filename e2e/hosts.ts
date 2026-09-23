import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Shared steps for tests that need a host. Mailpit, the fake mail server of the Compose test
// profile, exposes its API on 8025.
export const MAILPIT = "http://localhost:8025";
export const PASSWORD = "correct horse battery";

export function newHost(label: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { name: `Ada ${suffix}`, email: `${label}-${suffix}@example.test` };
}

export async function signUp(page: Page, host: { name: string; email: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill(host.name);
  await page.getByLabel("Email").fill(host.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  // Sign-up hashes the password and sends the verification email before it redirects.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("banner").getByText(host.name)).toBeVisible();
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}

export async function mailCountTo(request: APIRequestContext, email: string): Promise<number> {
  const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  return ((await response.json()) as { messages: unknown[] }).messages.length;
}

// The newest email Mailpit holds for this address, as plain text.
export async function latestMailTo(request: APIRequestContext, email: string): Promise<string> {
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
    .toBeGreaterThan(0);
  const message = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string };
  return message.Text;
}

export function linkIn(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No link in:\n${text}`);
  return match[0];
}

// Opens the verification link from the sign-up email on this page.
//
// Better Auth limits how often one client opens verification links, and its count only starts
// again after a quiet ten seconds, which a whole suite run never has. A real instance sits
// behind a reverse proxy that tells the app which client each request comes from; the test
// profile has none, so every host in the run would count as one client, and the suite would be
// refused after its hundredth host. Each host here is someone on their own device, so the page
// says so, the way the proxy would (X-Forwarded-For, which Better Auth reads).
export async function verifyEmail(page: Page, request: APIRequestContext, email: string) {
  const link = linkIn(await latestMailTo(request, email));
  await page.setExtraHTTPHeaders({ "x-forwarded-for": clientAddress() });
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
}

// An address from a private range, different for every host in the run.
function clientAddress() {
  const byte = () => Math.floor(Math.random() * 254) + 1;
  return `10.${byte()}.${byte()}.${byte()}`;
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
