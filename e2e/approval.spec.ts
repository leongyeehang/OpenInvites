import { APPROVAL, createPublished, type DraftFields } from "./events";
import { latestMailTo, linkIn, newHost } from "./hosts";
import { clientAddress, expect, test, type Browser, type Page } from "./test";

// Ticket 07 (M3): approval. With approval on, a reply waits for the host; the guest sees the
// invitation and their own reply, but not the guest list or the comments, until the host approves
// it, which applies the capacity and tells the guest by email. A declined guest is told on the
// page and nowhere else. Every guest is on a device of their own, reaching the instance from an
// address of their own. Each test runs at 390 pixels in the mobile project and at desktop width
// in the other.

const WAITING = "Your reply is waiting for the host’s approval.";
const LIST_WAITING = "Once the host approves your reply you’ll see who’s coming.";
const COMMENTS_WAITING = "Once the host approves your reply you can join the conversation.";
const DECLINED = "The host wasn’t able to accept your reply.";

const SUPPER = { rsvpStyle: "Inline", title: "Ada’s supper club", start: "2027-03-06T19:00", plusOnes: "1", askEmail: true, approval: true } satisfies DraftFields;

// A guest on a device of their own.
async function newGuest(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  return context.newPage();
}

// A Going reply on the Poster's steps: the name (and an email), then who they bring when the event
// allows plus-ones, then Send.
async function replyGoing(page: Page, link: string, name: string, email?: string) {
  await page.goto(link);
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  if (email) await page.getByLabel("Email").fill(email);
  if (await page.getByRole("button", { name: "Continue" }).isVisible()) {
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: "Just me" }).click();
  }
  await page.getByRole("button", { name: "Send RSVP" }).click();
}

// The host's word on one guest, from the section of the guest list the guest is in.
async function decide(hostPage: Page, section: RegExp, name: string, button: "Approve" | "Decline") {
  await hostPage.getByRole("region", { name: section }).getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: button }).click();
}

// The host turns approval on or off on the event form, from the manage page.
async function setApproval(hostPage: Page, manage: string, on: boolean) {
  await hostPage.goto(manage);
  await hostPage.getByRole("group", { name: "Guests", exact: true }).getByLabel(APPROVAL).setChecked(on);
  await hostPage.getByRole("button", { name: "Save changes" }).click();
  await expect(hostPage.getByText(/^Saved\./)).toBeVisible({ timeout: 15_000 });
}

async function closeAll(...pages: Page[]) {
  for (const page of pages) await page.context().close();
}

test("a reply waits for the host, who approves it with an email; a guest waiting or declined can neither read nor post comments, even by a crafted request, until approved", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "approval-walk", SUPPER);
  const manage = host.page.url();
  const guests = `${manage}/guests`;
  const [asha, mei, visitor] = [await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  const ashaEmail = newHost("approval-asha").email;

  // Asha replies Going: her reply waits, the guest list and the comments stay locked for her with
  // their own lines, and there is no comment form.
  await replyGoing(asha, host.link, "Asha Menon", ashaEmail);
  await expect(asha.getByRole("heading", { name: WAITING })).toBeVisible({ timeout: 15_000 });
  await expect(asha.getByText(LIST_WAITING)).toBeVisible();
  await expect(asha.getByText(COMMENTS_WAITING)).toBeVisible();
  await expect(asha.getByLabel("Add a comment")).toHaveCount(0);
  // The host is told she is waiting for them.
  await expect
    .poll(() => latestMailTo(request, host.email), { timeout: 30_000, message: "the host told Asha is waiting" })
    .toContain("Asha Menon replied to Ada’s supper club: Going, and is waiting for your approval.");

  // The host sees her under Waiting for approval, at the top, and the dashboard counts her.
  await host.page.goto("/dashboard");
  await expect(host.page.getByText(/ · 1 waiting for approval · /)).toBeVisible();
  await host.page.goto(guests);
  await expect(host.page.getByText(/ · 1 waiting for approval$/)).toBeVisible();
  await expect(host.page.getByRole("heading", { level: 2 }).first()).toHaveText("Waiting for approval (1)");
  await expect(host.page.getByRole("heading", { name: "Going (0)" })).toBeVisible();
  await decide(host.page, /^Waiting for approval/, "Asha Menon", "Approve");
  await expect(host.page.getByRole("region", { name: /^Going/ }).getByText("Asha Menon")).toBeVisible();
  await expect(host.page.getByRole("heading", { name: "Waiting for approval (0)" })).toBeVisible();

  // Back on her page she is Going with the list open, and Mailpit has "You're in" with the event's
  // path.
  await asha.reload();
  await expect(asha.getByRole("heading", { name: "You’re going!" })).toBeVisible();
  await expect(asha.getByText("1 person expected")).toBeVisible();
  await expect(asha.getByLabel("Add a comment")).toBeVisible();
  const mail = await latestMailTo(request, ashaEmail);
  expect(mail).toContain("You’re in: the host approved your reply to Ada’s supper club.");
  expect(mail).toContain("You said Going.");
  expect(new URL(linkIn(mail)).pathname).toBe(new URL(host.link).pathname);

  // Asha's comment, caught on its way to the server and stopped there, to be sent again exactly as
  // it was from other browsers.
  const comment = "Who’s bringing dessert?";
  let sent: { headers: Record<string, string>; body: Buffer } | undefined;
  await asha.route(host.link, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    sent = { headers: route.request().headers(), body: route.request().postDataBuffer()! };
    await route.abort();
  });
  await asha.getByLabel("Add a comment").fill(comment);
  await asha.getByRole("button", { name: "Post", exact: true }).click();
  await expect.poll(() => sent !== undefined).toBe(true);
  await asha.unrouteAll({ behavior: "ignoreErrors" });
  const replay = async (from: Page) => {
    const response = await from.request.post(host.link, {
      headers: Object.fromEntries(
        ["next-action", "next-router-state-tree", "content-type", "accept", "origin"]
          .filter((name) => sent!.headers[name] !== undefined)
          .map((name) => [name, sent!.headers[name]]),
      ),
      data: sent!.body,
    });
    expect(response.ok()).toBe(true);
    return response.text();
  };
  // Someone who has not replied is refused.
  await visitor.goto(host.link);
  expect(await replay(visitor)).toContain('"error":"closed"');

  // Mei replies Going, and waits. The page she is sent holds nobody's name, and her crafted
  // comment is refused as the visitor's was.
  await replyGoing(mei, host.link, "Mei Lin");
  await expect(mei.getByRole("heading", { name: WAITING })).toBeVisible({ timeout: 15_000 });
  expect(await (await mei.request.get(host.link)).text()).not.toContain("Asha Menon");
  expect(await replay(mei)).toContain('"error":"closed"');

  // The host declines her: her page says so, with the list and the comments still locked, and her
  // crafted comment is still refused.
  await host.page.goto(guests);
  await decide(host.page, /^Waiting for approval/, "Mei Lin", "Decline");
  await expect(host.page.getByRole("region", { name: /^Declined/ }).getByText("Mei Lin")).toBeVisible();
  await expect(host.page.getByRole("heading", { level: 2 }).last()).toHaveText("Declined (1)");
  await mei.reload();
  await expect(mei.getByRole("heading", { name: DECLINED })).toBeVisible();
  await expect(mei.getByRole("button", { name: "Change my answer" })).toBeVisible();
  await expect(mei.getByRole("button", { name: "Remove my RSVP" })).toBeVisible();
  await expect(mei.getByLabel("Add a comment")).toHaveCount(0);
  expect(await (await mei.request.get(host.link)).text()).not.toContain("Asha Menon");
  expect(await replay(mei)).toContain('"error":"closed"');

  // No comment appeared from any of it; the same post from Asha's browser is taken, so what was
  // refused was the action itself.
  await asha.reload();
  await expect(asha.getByText(comment)).toHaveCount(0);
  expect(await replay(asha)).toContain('"posted":true');
  await asha.reload();
  await expect(asha.getByText(comment)).toHaveCount(1);

  // The host changes their mind and approves Mei from Declined: the list and the comments open.
  await host.page.goto(guests);
  await decide(host.page, /^Declined/, "Mei Lin", "Approve");
  await expect(host.page.getByRole("region", { name: /^Going/ }).getByText("Mei Lin")).toBeVisible();
  await mei.reload();
  await expect(mei.getByRole("heading", { name: "You’re going!" })).toBeVisible();
  await expect(mei.getByText("2 people expected")).toBeVisible();
  await expect(mei.getByText(comment)).toBeVisible();

  await closeAll(asha, mei, visitor, host.page);
});

test("approving applies the capacity, with the waitlist's email, and turning approval off approves the reply still waiting, in turn", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "approval-capacity", { ...SUPPER, title: "Supper for one", plusOnes: "0", capacity: "1" });
  const manage = host.page.url();
  const guests = `${manage}/guests`;
  const [arjun, bea, chen] = [await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  const beaEmail = newHost("approval-bea").email;
  const chenEmail = newHost("approval-chen").email;

  // Two Going replies wait, and neither takes the one place while it waits.
  await replyGoing(arjun, host.link, "Arjun Rao");
  await expect(arjun.getByRole("heading", { name: WAITING })).toBeVisible({ timeout: 15_000 });
  await replyGoing(bea, host.link, "Bea Lim", beaEmail);
  await expect(bea.getByRole("heading", { name: WAITING })).toBeVisible({ timeout: 15_000 });
  await expect(bea.getByText("This event is full. You can join the waitlist.")).toHaveCount(0);

  // Arjun approved takes the place; Bea approved after him waits for one, and is told her place.
  await host.page.goto(guests);
  await expect(host.page.getByText(/^0 of 1 people expected/)).toBeVisible();
  await decide(host.page, /^Waiting for approval/, "Arjun Rao", "Approve");
  await expect(host.page.getByRole("region", { name: /^Going/ }).getByText("Arjun Rao")).toBeVisible();
  await decide(host.page, /^Waiting for approval/, "Bea Lim", "Approve");
  await expect(host.page.getByRole("region", { name: /^Waitlist/ }).getByText("Bea Lim")).toBeVisible();
  await expect(host.page.getByText(/^1 of 1 people expected · 1 going · 0 maybe · 0 can’t go · 1 on the waitlist$/)).toBeVisible();
  const beaMail = await latestMailTo(request, beaEmail);
  expect(beaMail).toContain("The host approved your reply to Supper for one, but the event is full, so you’re number 1 on the waitlist.");
  expect(new URL(linkIn(beaMail)).pathname).toBe(new URL(host.link).pathname);
  await bea.reload();
  await expect(bea.getByRole("heading", { name: "You’re on the waitlist, number 1." })).toBeVisible();

  // Chen's reply waits when the host turns approval off: it is approved, behind Bea.
  await replyGoing(chen, host.link, "Chen Wei", chenEmail);
  await expect(chen.getByRole("heading", { name: WAITING })).toBeVisible({ timeout: 15_000 });
  await setApproval(host.page, manage, false);
  const chenMail = await latestMailTo(request, chenEmail);
  expect(chenMail).toContain("so you’re number 2 on the waitlist.");
  await chen.reload();
  await expect(chen.getByRole("heading", { name: "You’re on the waitlist, number 2." })).toBeVisible();
  await host.page.goto(guests);
  await expect(host.page.getByRole("heading", { name: "Waitlist (2)" })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: /^Waiting for approval/ })).toHaveCount(0);

  // Turning it on again changes no reply.
  await setApproval(host.page, manage, true);
  await host.page.goto(guests);
  await expect(host.page.getByRole("heading", { name: "Waiting for approval (0)" })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: "Going (1)" })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: "Waitlist (2)" })).toBeVisible();

  await closeAll(arjun, bea, chen, host.page);
});

test("the Broadsheet confirms a reply waiting for the host, then says it was declined, and one replied again waits again", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "approval-broadsheet", {
    layout: "Broadsheet",
    title: "Supper at Mei’s",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    approval: true,
  });
  const priya = await newGuest(browser);

  const reply = async () => {
    await priya.getByRole("radio", { name: "I’ll be there", exact: true }).check();
    await priya.getByLabel("Your name").fill("Priya Nair");
    await priya.getByRole("button", { name: "Post my reply" }).click();
    await expect(priya.getByRole("heading", { name: WAITING })).toBeVisible({ timeout: 15_000 });
  };
  await priya.goto(host.link);
  await reply();
  await expect(priya.getByText(WAITING)).toHaveCount(1);
  await expect(priya.getByText(LIST_WAITING)).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  await decide(host.page, /^Waiting for approval/, "Priya Nair", "Decline");
  await expect(host.page.getByRole("region", { name: /^Declined/ }).getByText("Priya Nair")).toBeVisible();
  await priya.reload();
  await expect(priya.getByRole("heading", { name: DECLINED })).toBeVisible();

  // Withdrawn and sent again, the reply waits for the host again.
  await priya.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(priya.getByRole("radio", { name: "I’ll be there", exact: true })).not.toBeChecked();
  await reply();

  await closeAll(priya, host.page);
});

test("the Thread promises to ask the host, then says the reply was declined, in its own voice", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "approval-thread", {
    layout: "Thread",
    title: "Ada’s party",
    start: "2027-03-06T15:00",
    plusOnes: "0",
    approval: true,
  });
  const priya = await newGuest(browser);
  const doneBubble = priya.locator('[data-slot="done"]');

  await priya.goto(host.link);
  await priya.getByRole("button", { name: "Going", exact: true }).click();
  await priya.getByLabel("Your name").fill("Priya Nair");
  await priya.getByRole("button", { name: "Send", exact: true }).click();
  const promise = "Thanks, Priya! I’ll check with the host and let you know.";
  await expect(doneBubble).toContainText(promise, { timeout: 15_000 });
  await expect(priya.getByText(promise)).toHaveCount(1);
  await expect(priya.getByText(LIST_WAITING)).toBeVisible();
  // Nobody waiting is counted in the replies the page shows.
  await expect(priya.getByText("Invitation", { exact: true })).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  await decide(host.page, /^Waiting for approval/, "Priya Nair", "Decline");
  await expect(host.page.getByRole("region", { name: /^Declined/ }).getByText("Priya Nair")).toBeVisible();
  await priya.reload();
  await expect(doneBubble).toContainText(DECLINED);
  await expect(priya.getByRole("button", { name: "Edit my details" })).toBeVisible();

  await closeAll(priya, host.page);
});
