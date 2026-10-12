import { createPublished, type DraftFields } from "./events";
import { latestMailTo, linkIn, mailCountTo, newHost } from "./hosts";
import { clientAddress, expect, test, type Browser, type Page } from "./test";

// Ticket 06 (M3): capacity and the waitlist. A host sets a capacity, counted as the headcount is;
// a Going party that does not fit waits on the waitlist, in order, and is promoted, with an email,
// when space opens. Every guest here is on a device of their own, reaching the instance from an
// address of their own, so that the replies of several guests in one test never share the RSVP
// rate limit. Each test runs at 390 pixels in the mobile project and at desktop width in the other.

const FULL = "This event is full. You can join the waitlist.";

const PARTY = { rsvpStyle: "Inline", title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "2", capacity: "3", askEmail: true } satisfies DraftFields;

// A guest on a device of their own.
async function newGuest(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  return context.newPage();
}

// A Going reply on the Poster's steps: the name (and an email), who they bring, then Send.
async function replyGoing(page: Page, link: string, name: string, plusOnes: number, email?: string) {
  await page.goto(link);
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  if (email) await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: plusOnes === 0 ? "Just me" : `+${plusOnes}` }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
}

const waitlisted = (page: Page, position: number) => page.getByRole("heading", { name: `You’re on the waitlist, number ${position}.` });

// The host changes the capacity on the event form, from the manage page: a number, or empty for
// no limit.
async function setCapacity(hostPage: Page, manage: string, capacity: string) {
  await hostPage.goto(manage);
  await hostPage.getByRole("group", { name: "Guests", exact: true }).getByLabel("Capacity").fill(capacity);
  await hostPage.getByRole("button", { name: "Save changes" }).click();
  await expect(hostPage.getByText(/^Saved\./)).toBeVisible({ timeout: 15_000 });
}

async function closeAll(...pages: Page[]) {
  for (const page of pages) await page.context().close();
}

test("a party that does not fit waits, the page says the event is full, and a withdrawal promotes the party with an email", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-walk", PARTY);
  const manage = host.page.url();
  const [arjun, bea, chen, visitor] = [await newGuest(browser), await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  const beaEmail = newHost("capacity-bea").email;

  // Arjun brings one: two of the three places.
  await replyGoing(arjun, host.link, "Arjun Rao", 1);
  await expect(arjun.getByText("You’re going!")).toBeVisible();

  // Bea brings one too, which does not fit: the whole party waits, first in line.
  await replyGoing(bea, host.link, "Bea Lim", 1, beaEmail);
  await expect(waitlisted(bea, 1)).toBeVisible();
  await expect(bea.getByText("Bea Lim, plus one more.")).toBeVisible();
  // The host is told she is waiting, with her party.
  await expect
    .poll(() => latestMailTo(request, host.email), { timeout: 30_000, message: "the host told Bea is on the waitlist" })
    .toContain("Bea Lim is on the waitlist for Ada’s birthday (party of 2).");

  // One place is left, so the page does not say the event is full. Chen takes it, alone.
  await chen.goto(host.link);
  await expect(chen.getByRole("button", { name: "Going", exact: true })).toBeVisible();
  await expect(chen.getByText(FULL)).toHaveCount(0);
  await replyGoing(chen, host.link, "Chen Wei", 0);
  await expect(chen.getByText("You’re going!")).toBeVisible();
  // The guest list leaves the waitlist out, in its names and in its count.
  await expect(chen.getByText("3 people expected")).toBeVisible();
  await expect(chen.getByText("Arjun Rao")).toBeVisible();
  await expect(chen.getByText("Bea Lim")).toHaveCount(0);

  // Now the page says it is full, beside the answers, to anyone who opens it.
  await visitor.goto(host.link);
  await expect(visitor.getByText(FULL)).toBeVisible();

  // Arjun withdraws, and Bea's party of two fits: promoted, as her page says when she comes back.
  await arjun.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(arjun.getByRole("button", { name: "Going", exact: true })).toBeVisible();
  await bea.reload();
  await expect(bea.getByText("You’re going!")).toBeVisible();
  const mail = await latestMailTo(request, beaEmail);
  expect(mail).toContain("A place opened up: you’re going to Ada’s birthday.");
  expect(new URL(linkIn(mail)).pathname).toBe(new URL(host.link).pathname);

  // The host's list: three of three places, and nobody waiting.
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByText(/^3 of 3 people expected · 2 going · 0 maybe · 0 can’t go$/)).toBeVisible();
  await expect(host.page.getByRole("heading", { name: /^Waitlist \(0\)/ })).toBeVisible();
  await expect(host.page.getByRole("region", { name: /^Going/ }).getByText("Bea Lim")).toBeVisible();

  // The manage page and the dashboard read the headcount against the capacity too, and the
  // announcement form offers the waitlist, unticked.
  await host.page.goto(manage);
  await expect(host.page.getByText("3 of 3 people expected", { exact: true })).toBeVisible();
  await host.page.goto("/dashboard");
  await expect(host.page.getByText(/ · 3 of 3 people expected$/)).toBeVisible();
  await host.page.goto(`${manage}/announcements`);
  await expect(host.page.getByRole("checkbox", { name: "Waitlist" })).not.toBeChecked();

  await closeAll(arjun, bea, chen, visitor, host.page);
});

test("two guests replying Going at once for the last place: one is Going and the other waits", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-race", { ...PARTY, title: "Supper for one more", plusOnes: "0", capacity: "1", askEmail: false });
  const [priya, mei] = [await newGuest(browser), await newGuest(browser)];
  for (const [page, name] of [
    [priya, "Priya Nair"],
    [mei, "Mei Lin"],
  ] as const) {
    await page.goto(host.link);
    await page.getByRole("button", { name: "Going", exact: true }).click();
    await page.getByLabel("Your name").fill(name);
  }

  // Both are sent at the same moment, and the second waits for the first to be written.
  await Promise.all([priya, mei].map((page) => page.getByRole("button", { name: "Send RSVP" }).click()));
  for (const page of [priya, mei]) {
    await expect(page.getByRole("heading", { name: /^(You’re going!|You’re on the waitlist, number 1\.)$/ })).toBeVisible({ timeout: 15_000 });
  }

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByRole("heading", { name: /^Going \(1\)/ })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: /^Waitlist \(1\)/ })).toBeVisible();
  await expect(host.page.getByText(/^1 of 1 people expected/)).toBeVisible();

  await closeAll(priya, mei, host.page);
});

test("a large party at the front of the waitlist is not skipped for a small one, and the host can move a guest to Going over capacity", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-order", { ...PARTY, capacity: "2" });
  const manage = host.page.url();
  const [arjun, bea, chen] = [await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  const beaEmail = newHost("capacity-order-bea").email;

  await replyGoing(arjun, host.link, "Arjun Rao", 1);
  await expect(arjun.getByText("You’re going!")).toBeVisible();
  // A party of three waits first, a party of one second.
  await replyGoing(bea, host.link, "Bea Lim", 2, beaEmail);
  await expect(waitlisted(bea, 1)).toBeVisible();
  await replyGoing(chen, host.link, "Chen Wei", 0);
  await expect(waitlisted(chen, 2)).toBeVisible();

  // Arjun comes alone after all: one place opens, which Bea's party does not fit, and Chen, who
  // would, waits behind her.
  await arjun.getByRole("button", { name: "Edit details" }).click();
  await arjun.getByRole("button", { name: "Continue" }).click();
  await arjun.getByRole("radio", { name: "Just me" }).click();
  await arjun.getByRole("button", { name: "Send RSVP" }).click();
  await expect(arjun.getByText("Arjun Rao, just you.")).toBeVisible();
  await chen.reload();
  await expect(waitlisted(chen, 2)).toBeVisible();

  // The host sees the waitlist in order, numbered, with each party.
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByText(/^1 of 2 people expected · 1 going · 0 maybe · 0 can’t go · 2 on the waitlist$/)).toBeVisible();
  const waitlist = host.page.getByRole("region", { name: /^Waitlist/ });
  await expect(waitlist.getByRole("listitem")).toHaveText([/^1\.\s*Bea Lim\s*\+2/, /^2\.\s*Chen Wei/]);

  // The host moves Bea's party to Going, past the capacity, which a host's change never answers to.
  await waitlist.getByRole("listitem").filter({ hasText: "Bea Lim" }).getByRole("button", { name: "Move to Going" }).click();
  await expect(host.page.getByRole("heading", { name: /^Going \(2\)/ })).toBeVisible();
  await expect(host.page.getByText(/^4 of 2 people expected/)).toBeVisible();
  await expect(host.page.getByRole("heading", { name: "Guest list" })).toBeFocused();
  await expect(waitlist.getByRole("listitem")).toHaveText([/^1\.\s*Chen Wei/]);
  await bea.reload();
  await expect(bea.getByText("You’re going!")).toBeVisible();
  expect(await latestMailTo(request, beaEmail)).toContain("A place opened up: you’re going to Ada’s birthday.");
  await chen.reload();
  await expect(waitlisted(chen, 1)).toBeVisible();

  await closeAll(arjun, bea, chen, host.page);
});

test("the host's capacity moves the waitlist: raised, the party at the front is promoted with an email; lowered below the headcount, nobody moves; removed, everyone waiting is promoted", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-host", { ...PARTY, capacity: "2" });
  const manage = host.page.url();
  const [arjun, bea, chen, dev] = [await newGuest(browser), await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  const beaEmail = newHost("capacity-host-bea").email;
  const chenEmail = newHost("capacity-host-chen").email;

  // Arjun's party of two fills both places; Bea's party of two, then Chen and Dev alone, wait.
  await replyGoing(arjun, host.link, "Arjun Rao", 1);
  await expect(arjun.getByText("You’re going!")).toBeVisible();
  await replyGoing(bea, host.link, "Bea Lim", 1, beaEmail);
  await expect(waitlisted(bea, 1)).toBeVisible();
  await replyGoing(chen, host.link, "Chen Wei", 0, chenEmail);
  await expect(waitlisted(chen, 2)).toBeVisible();
  await replyGoing(dev, host.link, "Dev Shah", 0);
  await expect(waitlisted(dev, 3)).toBeVisible();

  // Raised to four: the two places that open go to Bea's party, at the front, who is told; nothing
  // is left for Chen.
  await setCapacity(host.page, manage, "4");
  await bea.reload();
  await expect(bea.getByText("You’re going!")).toBeVisible();
  const mail = await latestMailTo(request, beaEmail);
  expect(mail).toContain("A place opened up: you’re going to Ada’s birthday.");
  expect(new URL(linkIn(mail)).pathname).toBe(new URL(host.link).pathname);
  await chen.reload();
  await expect(waitlisted(chen, 1)).toBeVisible();

  // Lowered to three, below the four expected: nobody is moved, and the list reads over full.
  await setCapacity(host.page, manage, "3");
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByText(/^4 of 3 people expected · 2 going · 0 maybe · 0 can’t go · 2 on the waitlist$/)).toBeVisible();
  await expect(host.page.getByRole("region", { name: /^Waitlist/ }).getByRole("listitem")).toHaveText([/^1\.\s*Chen Wei/, /^2\.\s*Dev Shah/]);
  await bea.reload();
  await expect(bea.getByText("You’re going!")).toBeVisible();

  // Removed: no limit, so everyone waiting is promoted, and the list has no waitlist left.
  await setCapacity(host.page, manage, "");
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByText(/^6 people expected · 4 going · 0 maybe · 0 can’t go$/)).toBeVisible();
  await expect(host.page.getByRole("heading", { name: /^Waitlist/ })).toHaveCount(0);
  await dev.reload();
  await expect(dev.getByText("You’re going!")).toBeVisible();
  expect(await latestMailTo(request, chenEmail)).toContain("A place opened up: you’re going to Ada’s birthday.");

  await closeAll(arjun, bea, chen, dev, host.page);
});

test("a Going guest who can no longer come, and one the host makes a maybe, each open a place for the next guest waiting", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-change", { ...PARTY, capacity: "2" });
  const manage = host.page.url();
  const [arjun, bea, chen, dev] = [await newGuest(browser), await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  const chenEmail = newHost("capacity-change-chen").email;

  await replyGoing(arjun, host.link, "Arjun Rao", 0);
  await expect(arjun.getByText("You’re going!")).toBeVisible();
  await replyGoing(bea, host.link, "Bea Lim", 0);
  await expect(bea.getByText("You’re going!")).toBeVisible();
  await replyGoing(chen, host.link, "Chen Wei", 0, chenEmail);
  await expect(waitlisted(chen, 1)).toBeVisible();
  await replyGoing(dev, host.link, "Dev Shah", 0);
  await expect(waitlisted(dev, 2)).toBeVisible();

  // Arjun can't come after all: his place goes to Chen, first in line, who is told.
  await arjun.getByRole("button", { name: "Change my answer" }).click();
  await arjun.getByRole("button", { name: "Can’t go" }).click();
  await arjun.getByRole("button", { name: "Send RSVP" }).click();
  await expect(arjun.getByText("We’ll miss you.")).toBeVisible();
  await chen.reload();
  await expect(chen.getByText("You’re going!")).toBeVisible();
  expect(await latestMailTo(request, chenEmail)).toContain("A place opened up: you’re going to Ada’s birthday.");
  await dev.reload();
  await expect(waitlisted(dev, 1)).toBeVisible();

  // The host makes Bea a maybe from the guest list: her place goes to Dev.
  await host.page.goto(`${manage}/guests`);
  const going = host.page.getByRole("region", { name: /^Going/ });
  await going.getByRole("listitem").filter({ hasText: "Bea Lim" }).getByRole("button", { name: "Edit", exact: true }).click();
  await host.page.getByLabel("Status").selectOption("maybe");
  await host.page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(host.page.getByRole("heading", { name: /^Maybe \(1\)/ })).toBeVisible();
  await expect(host.page.getByText(/^2 of 2 people expected · 2 going · 1 maybe · 1 can’t go$/)).toBeVisible();
  await expect(going.getByRole("listitem")).toHaveText([/Chen Wei/, /Dev Shah/]);
  await expect(host.page.getByRole("heading", { name: /^Waitlist \(0\)/ })).toBeVisible();
  await dev.reload();
  await expect(dev.getByText("You’re going!")).toBeVisible();

  await closeAll(arjun, bea, chen, dev, host.page);
});

test("a cancelled event promotes nobody: a Going guest who withdraws leaves the next guest waiting, emailed only that the event is off", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-cancel", { ...PARTY, capacity: "1" });
  const manage = host.page.url();
  const [arjun, bea] = [await newGuest(browser), await newGuest(browser)];
  const beaEmail = newHost("capacity-cancel-bea").email;

  await replyGoing(arjun, host.link, "Arjun Rao", 0);
  await expect(arjun.getByText("You’re going!")).toBeVisible();
  await replyGoing(bea, host.link, "Bea Lim", 0, beaEmail);
  await expect(waitlisted(bea, 1)).toBeVisible();

  // The host calls it off, and Bea, who was hoping to come, is told.
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect.poll(() => mailCountTo(request, beaEmail), { timeout: 30_000, message: "the cancellation notice to Bea" }).toBe(1);
  expect(await latestMailTo(request, beaEmail)).toContain("The host has cancelled Ada’s birthday.");

  // Arjun withdraws, as a guest still may. The hosts' notice of it is queued after anything the
  // withdrawal queues for Bea, and mail goes in the order it was queued: once it is in, Bea has
  // still had the notice alone, and her page still has her waiting.
  await arjun.reload();
  await arjun.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(arjun.getByRole("button", { name: "Going", exact: true })).toBeVisible();
  await expect
    .poll(() => latestMailTo(request, host.email), { timeout: 30_000, message: "the hosts told Arjun withdrew" })
    .toContain("Arjun Rao’s RSVP to Ada’s birthday was removed.");
  expect(await mailCountTo(request, beaEmail)).toBe(1);
  await bea.reload();
  await expect(bea.getByText("This event is cancelled")).toBeVisible();
  await expect(waitlisted(bea, 1)).toBeVisible();
  await expect(bea.getByText("You’re going!")).toHaveCount(0);

  // The host may still move her to Going themselves; on an event that is off, she is not told a
  // place opened up.
  await host.page.goto(`${manage}/guests`);
  await host.page.getByRole("region", { name: /^Waitlist/ }).getByRole("button", { name: "Move to Going" }).click();
  await expect(host.page.getByRole("heading", { name: /^Going \(1\)/ })).toBeVisible();
  await expect
    .poll(() => latestMailTo(request, host.email), { timeout: 30_000, message: "the hosts told Bea is now Going" })
    .toContain("Bea Lim’s RSVP to Ada’s birthday is now Going.");
  expect(await mailCountTo(request, beaEmail)).toBe(1);

  await closeAll(arjun, bea, host.page);
});

test("a Going guest who brings more people than there is room for is told how many places are left, and keeps their place", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-raise", { ...PARTY, askEmail: false });
  const [arjun, bea] = [await newGuest(browser), await newGuest(browser)];

  await replyGoing(arjun, host.link, "Arjun Rao", 0);
  await expect(arjun.getByText("You’re going!")).toBeVisible();
  await replyGoing(bea, host.link, "Bea Lim", 0);
  await expect(bea.getByText("You’re going!")).toBeVisible();

  // Two places are left beside Bea; Arjun asks for three.
  await arjun.getByRole("button", { name: "Edit details" }).click();
  await arjun.getByRole("button", { name: "Continue" }).click();
  await arjun.getByRole("radio", { name: "+2" }).click();
  await arjun.getByRole("button", { name: "Send RSVP" }).click();
  await expect(arjun.getByText("Only 2 places left.")).toBeVisible();
  // Back at the step that holds the plus-ones.
  await expect(arjun.getByRole("radio", { name: "+2" })).toBeVisible();

  await arjun.reload();
  await expect(arjun.getByText("You’re going!")).toBeVisible();
  await expect(arjun.getByText("Arjun Rao, just you.")).toBeVisible();

  await closeAll(arjun, bea, host.page);
});

test("the Broadsheet says the event is full on its ballot and confirms a waitlisted reply once", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-broadsheet", {
    layout: "Broadsheet",
    title: "Supper at Mei’s",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    capacity: "1",
  });
  const [priya, mei] = [await newGuest(browser), await newGuest(browser)];

  await priya.goto(host.link);
  await expect(priya.getByText(FULL)).toHaveCount(0);
  await priya.getByRole("radio", { name: "I’ll be there", exact: true }).check();
  await priya.getByLabel("Your name").fill("Priya Nair");
  await priya.getByRole("button", { name: "Post my reply" }).click();
  await expect(priya.getByText("Received", { exact: true })).toBeVisible();

  await mei.goto(host.link);
  await expect(mei.getByText(FULL)).toBeVisible();
  await mei.getByRole("radio", { name: "I’ll be there", exact: true }).check();
  await mei.getByLabel("Your name").fill("Mei Lin");
  await mei.getByRole("button", { name: "Post my reply" }).click();
  await expect(mei.getByText("Waitlisted", { exact: true })).toBeVisible();
  await expect(mei.getByText("You’re on the waitlist, number 1.")).toHaveCount(1);
  await expect(mei.getByText("Received", { exact: true })).toHaveCount(0);
  await expect(mei.getByText(FULL)).toHaveCount(0);

  await closeAll(priya, mei, host.page);
});

test("the Thread says the event is full by the answers, tells a waitlisted guest their place once in its own voice, and asks again how many a guest brings when they do not fit", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "capacity-thread", {
    layout: "Thread",
    title: "Ada’s party",
    start: "2027-03-06T15:00",
    plusOnes: "1",
    capacity: "2",
  });
  const [priya, mei, sam] = [await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  const doneBubble = (page: Page) => page.locator('[data-slot="done"]');

  // A Going reply that brings nobody: the name, then Just me, which sends it.
  async function replyAlone(page: Page, name: string) {
    await page.goto(host.link);
    await page.getByRole("button", { name: "Going", exact: true }).click();
    await page.getByLabel("Your name").fill(name);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("button", { name: "Just me" }).click();
    await expect(doneBubble(page)).toBeVisible({ timeout: 15_000 });
  }

  await replyAlone(priya, "Priya Nair");
  await expect(doneBubble(priya)).toContainText("You’re in, Priya!");
  await replyAlone(mei, "Mei Lin");
  await expect(doneBubble(mei)).toContainText("You’re in, Mei!");

  await sam.goto(host.link);
  await expect(sam.getByText(FULL)).toBeVisible();
  await replyAlone(sam, "Sam Okafor");
  const line = "The party’s full right now, Sam, but you’re number 1 on the waitlist. I’ll let you know if a place opens up.";
  await expect(doneBubble(sam)).toContainText(line);
  await expect(sam.getByText(line)).toHaveCount(1);
  await expect(sam.getByRole("log").getByText("I’m in!", { exact: true })).toBeVisible();
  await expect(sam.getByText(FULL)).toHaveCount(0);
  // Nobody on the waitlist is counted in the replies the page shows.
  await expect(sam.getByText("Invitation · 2 replies", { exact: true })).toBeVisible();

  // Priya asks to bring one more, for which there is no place: she is asked again how many.
  await priya.getByRole("button", { name: "Edit my details" }).click();
  await priya.getByRole("button", { name: "Send", exact: true }).click();
  await priya.getByRole("button", { name: "+1" }).click();
  await expect(priya.getByText("Only 1 place left.")).toBeVisible({ timeout: 15_000 });
  await expect(priya.getByRole("button", { name: "Just me" })).toBeVisible();
  await priya.reload();
  await expect(doneBubble(priya)).toContainText("You’re in, Priya!");

  await closeAll(priya, mei, sam, host.page);
});
