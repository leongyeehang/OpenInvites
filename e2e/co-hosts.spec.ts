import { expect, expectNotFoundAsSent, test, type APIRequestContext, type Browser, type Page } from "./test";
import { createPublished } from "./events";
import { latestMailTo, newHost, PASSWORD, signOut, signUp, signUpVerified, verifyEmail } from "./hosts";

// A host shares an event's management through a co-host link (spec, "Co-hosts"): whoever accepts it
// while signed in can do everything the owner can, but delete the event or manage its co-hosts.

const EVENT = { rsvpStyle: "Inline" as const, title: "Ada’s birthday", start: "2027-03-06T19:00" };
const LINK = /^https?:\/\/\S+\/co-host\/[A-Za-z0-9_-]{32}$/;

// On the event's manage page: the owner opens its hosts page and makes a co-host link, which is
// shown this once.
async function makeCoHostLink(ownerPage: Page): Promise<string> {
  await ownerPage.getByRole("link", { name: "Hosts", exact: true }).click();
  await expect(ownerPage.getByRole("heading", { name: "Hosts", level: 1 })).toBeVisible();
  await ownerPage.getByRole("button", { name: "Make a co-host link" }).click();
  await expect(
    ownerPage.getByText("Copy this link now: it is not shown again. It works for one person and expires in 7 days."),
  ).toBeVisible({ timeout: 15_000 });
  const link = await ownerPage.getByRole("textbox", { name: "Co-host link" }).inputValue();
  expect(link).toMatch(LINK);
  return link;
}

// A second host, signed up and verified in a browser of their own, who accepts the link and lands on
// the event.
async function acceptAsNewHost(browser: Browser, request: APIRequestContext, link: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const host = await signUpVerified(page, request, "co-host");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: EVENT.title })).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return { context, page, ...host };
}

test("a host accepts a co-host link, sees the event on their dashboard, edits it, and the page names both hosts", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const owner = await createPublished(browser, request, "co-host-owner", EVENT);
  const manage = owner.page.url();
  const link = await makeCoHostLink(owner.page);
  await expect(owner.page.getByText(/^Made .+ · Expires .+$/)).toHaveCount(1);

  const coHost = await acceptAsNewHost(browser, request, link);
  expect(coHost.page.url()).toBe(manage);
  await expect(coHost.page.getByRole("heading", { name: EVENT.title, level: 1 })).toBeVisible();
  await expect(coHost.page.getByRole("main").getByText("Co-host", { exact: true })).toBeVisible();

  await coHost.page.goto("/dashboard");
  const upcoming = coHost.page.getByRole("region", { name: "Upcoming" });
  await expect(upcoming.getByText(EVENT.title)).toBeVisible();
  await expect(upcoming.getByText("Co-host", { exact: true })).toBeVisible();

  // The link has been used: the owner sees the co-host among the hosts and no link waiting.
  await owner.page.reload();
  await expect(owner.page.getByRole("listitem").filter({ hasText: owner.name }).getByText("Host", { exact: true })).toBeVisible();
  await expect(owner.page.getByRole("listitem").filter({ hasText: coHost.name }).getByText("Co-host", { exact: true })).toBeVisible();
  await expect(owner.page.getByText("No co-host links are waiting to be used.")).toBeVisible();

  await coHost.page.goto(manage);
  await coHost.page.getByLabel("Title").fill("Ada’s 30th");
  await coHost.page.getByRole("button", { name: "Save changes" }).click();
  await expect(coHost.page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

  await page.goto(owner.link);
  await expect(page.getByRole("heading", { name: "Ada’s 30th" })).toBeVisible();
  await expect(page.getByText(`Hosted by ${owner.name} and ${coHost.name}`)).toBeVisible();

  // A guest's reply reaches every host. Each inbox already holds the email from signing up.
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Just me" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  for (const email of [owner.email, coHost.email]) {
    expect(await latestMailTo(request, email, 1)).toContain("Priya Nair replied to Ada’s 30th: Going.");
  }

  // Opening the link again, the co-host is simply taken to the event.
  await coHost.page.goto(link);
  await expect(coHost.page).toHaveURL(manage);
  await coHost.context.close();
  await owner.context.close();
});

test("a co-host has no Delete, and a direct post of the delete action is refused", async ({ browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "co-host-delete", EVENT);
  const manage = owner.page.url();
  const link = await makeCoHostLink(owner.page);
  const coHost = await acceptAsNewHost(browser, request, link);

  await expect(coHost.page.getByRole("button", { name: "Delete event" })).toHaveCount(0);
  await expect(coHost.page.getByRole("link", { name: "Hosts", exact: true })).toHaveCount(0);
  await expect(coHost.page.getByRole("link", { name: "Leave this event" })).toBeVisible();

  // The owner's own delete, caught on its way to the server and stopped there, is sent again from
  // the co-host's browser, exactly as it was.
  await owner.page.goto(manage);
  let sent: { headers: Record<string, string>; body: Buffer } | undefined;
  await owner.page.route(manage, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    sent = { headers: route.request().headers(), body: route.request().postDataBuffer()! };
    await route.abort();
  });
  await owner.page.getByRole("button", { name: "Delete event" }).click();
  await owner.page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect.poll(() => sent !== undefined).toBe(true);
  await owner.page.unrouteAll({ behavior: "ignoreErrors" });
  const replay = (from: Page) =>
    from.request.post(manage, {
      headers: Object.fromEntries(
        ["next-action", "next-router-state-tree", "content-type", "accept", "origin"]
          .filter((name) => sent!.headers[name] !== undefined)
          .map((name) => [name, sent!.headers[name]]),
      ),
      data: sent!.body,
    });

  expect((await replay(coHost.page)).ok()).toBe(true);
  await coHost.page.goto(manage);
  await expect(coHost.page.getByRole("heading", { name: EVENT.title, level: 1 })).toBeVisible();
  expect((await coHost.page.request.get(owner.link)).status()).toBe(200);

  // The same post from the owner deletes it, so the co-host's was the action itself, refused.
  expect((await replay(owner.page)).ok()).toBe(true);
  await expectNotFoundAsSent(await coHost.page.request.get(owner.link));
  await coHost.context.close();
  await owner.context.close();
});

test("a co-host leaves the event, and it is gone from their dashboard", async ({ browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "co-host-leave", EVENT);
  const manage = owner.page.url();
  const coHost = await acceptAsNewHost(browser, request, await makeCoHostLink(owner.page));

  await coHost.page.getByRole("link", { name: "Leave this event" }).click();
  await expect(coHost.page.getByRole("heading", { name: "Hosts", level: 1 })).toBeVisible();
  await expect(coHost.page.getByRole("button", { name: "Make a co-host link" })).toHaveCount(0);
  await expect(coHost.page.getByText(owner.name)).toHaveCount(0);
  await coHost.page.getByRole("button", { name: "Leave this event" }).click();
  const dialog = coHost.page.getByRole("alertdialog");
  await expect(dialog.getByText(`Leave “${EVENT.title}”?`)).toBeVisible();
  await dialog.getByRole("button", { name: "Leave", exact: true }).click();

  await expect(coHost.page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(coHost.page.getByText("You have no events yet. Create one and share its link.")).toBeVisible();
  await expectNotFoundAsSent(await coHost.page.goto(manage));
  await coHost.context.close();
  await owner.context.close();
});

test("the owner removes a co-host", async ({ browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "co-host-remove", EVENT);
  const manage = owner.page.url();
  const coHost = await acceptAsNewHost(browser, request, await makeCoHostLink(owner.page));

  await owner.page.reload();
  const row = owner.page.getByRole("listitem").filter({ hasText: coHost.name });
  await row.getByRole("button", { name: "Remove" }).click();
  const dialog = owner.page.getByRole("alertdialog");
  await expect(dialog.getByText(`Remove ${coHost.name} as a co-host?`)).toBeVisible();
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(owner.page.getByText(coHost.name)).toHaveCount(0);
  // The Remove button went with them, so the focus is on the page's heading rather than lost.
  await expect(owner.page.getByRole("heading", { level: 1, name: "Hosts" })).toBeFocused();

  await expectNotFoundAsSent(await coHost.page.goto(manage));
  await coHost.page.goto("/dashboard");
  await expect(coHost.page.getByText(EVENT.title)).toHaveCount(0);
  await coHost.context.close();
  await owner.context.close();
});

test("a revoked co-host link says so, and one that was never made is not found", async ({ page, browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "co-host-revoke", EVENT);
  const link = await makeCoHostLink(owner.page);
  await owner.page.getByRole("button", { name: "Revoke" }).click();
  await expect(owner.page.getByText("No co-host links are waiting to be used.")).toBeVisible();
  // The Revoke button went with the link, so the focus is on the links' heading rather than lost.
  await expect(owner.page.getByRole("heading", { name: "Co-host links" })).toBeFocused();

  await signUp(page, newHost("co-host-revoked"));
  await page.goto(link);
  await expect(page.getByRole("heading", { name: EVENT.title })).toBeVisible();
  await expect(page.getByText("This co-host link has been revoked. Ask the host for a new one.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toHaveCount(0);

  await expectNotFoundAsSent(await page.goto(`/co-host/${"x".repeat(32)}`));
  await owner.context.close();
});

test("a co-host link opened signed out goes through sign-in and back", async ({ page, browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "co-host-sign-in", EVENT);
  const link = await makeCoHostLink(owner.page);
  const host = newHost("co-host-returning");
  await signUp(page, host);
  await verifyEmail(page, request, host.email);
  await page.goto("/dashboard");
  await signOut(page);

  await page.goto(link);
  await expect(page.getByRole("heading", { name: EVENT.title })).toBeVisible();
  await expect(
    page.getByText("A co-host link needs a host account on this instance. If you don’t have one, create one, then open this link again."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in to accept this co-host link" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.getByLabel("Email", { exact: true }).fill(host.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(link, { timeout: 15_000 });
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole("main").getByText("Co-host", { exact: true })).toBeVisible();
  await owner.context.close();
});

// With mail, a host verifies their email before accepting, as before creating an event: the event's
// mail to its hosts goes there.
test("a host who has not verified their email is asked to before accepting", async ({ page, browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "co-host-verify", EVENT);
  const link = await makeCoHostLink(owner.page);
  const host = newHost("co-host-unverified");
  await signUp(page, host);

  await page.goto(link);
  await expect(page.getByRole("heading", { name: EVENT.title })).toBeVisible();
  await expect(page.getByText(`Before you accept, open the link we sent to ${host.email}. Then open this co-host link again.`)).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Resend email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toHaveCount(0);

  await verifyEmail(page, request, host.email);
  await page.goto(link);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole("main").getByText("Co-host", { exact: true })).toBeVisible();
  await owner.context.close();
});
