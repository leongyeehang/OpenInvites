import { expect, test, type Page } from "./test";
import { latestMailTo, linkIn, mailCountTo, newHost, PASSWORD, signIn, signOut, signUp, signUpVerified, verifyEmail } from "./hosts";

// A host with mail can sign in through a link emailed to them (spec, "Magic-link login"): it signs
// an existing host in, once, within 15 minutes, and never creates an account. That an instance
// without mail offers no such link is in registration-without-mail.spec.ts, whose project owns
// `app-no-mail`.

async function askForLink(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email for the sign-in link").fill(email);
  await page.getByRole("button", { name: "Send me the link" }).click();
  await expect(page.getByRole("status")).toHaveText(
    `If an account exists here, we sent a sign-in link to ${email}.`,
  );
}

test("a host asks for a sign-in link, and opening it signs them in", async ({ page, request }) => {
  const host = await signUpVerified(page, request, "link");
  await page.goto("/dashboard");
  await signOut(page);

  const before = await mailCountTo(request, host.email);
  await askForLink(page, host.email);
  const mail = await latestMailTo(request, host.email, before);
  expect(mail).toContain("valid for 15 minutes");

  await page.goto(linkIn(mail));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("banner").getByText(host.name)).toBeVisible();
});

test("an address with no account is told the same, and gets no mail", async ({ page, request }) => {
  const stranger = newHost("nobody");
  await askForLink(page, stranger.email);
  expect(await mailCountTo(request, stranger.email)).toBe(0);
});

test("a host who has not verified their email gets no sign-in link, and keeps their password until they do", async ({ page, request }) => {
  const host = newHost("unverified");
  await signUp(page, host);
  await signOut(page);

  await askForLink(page, host.email);
  // Only the verification email from signing up.
  expect(await mailCountTo(request, host.email)).toBe(1);

  await signIn(page, host.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);

  await verifyEmail(page, request, host.email);
  await page.goto("/dashboard");
  await signOut(page);
  await askForLink(page, host.email);
  await page.goto(linkIn(await latestMailTo(request, host.email, 1)));
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a sign-in link works once", async ({ page, request }) => {
  const host = await signUpVerified(page, request, "twice");
  await page.goto("/dashboard");
  await signOut(page);
  const before = await mailCountTo(request, host.email);
  await askForLink(page, host.email);
  const link = linkIn(await latestMailTo(request, host.email, before));

  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);

  await page.goto(link);
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("That sign-in link has expired or was already used.")).toBeVisible();
});
