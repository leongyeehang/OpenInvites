import { expect, test, type APIRequestContext, type Browser, type Page } from "./test";
import { createDraft } from "./events";
import { MAILPIT, newHost, signUp, signUpVerified, verifyEmail } from "./hosts";
import { recreate } from "./instances";

// Ticket 10: retention. Runs against `app-fresh` (with mail) and `app-no-mail` after the limits
// spec (the `retention-instance` project), and recreates both, so each starts empty and keeps
// events a year, as a new instance does. On each, the first host makes an event that ended two
// years ago and shares it with a co-host; then both app containers are restarted, as an upgrade
// restarts them, so the clock's first minute after the start sweeps with the events there (spec,
// "Retention"; Review Focus 2): they are marked and not deleted, and with mail every host is
// warned. `app-no-mail` runs with no floor on the mark's age (compose.yaml, test only), so a second
// restart's sweep deletes its event; `app-fresh` keeps the real 30 days. The scenarios run in
// order, each leaving the instances as the next expects them.
test.describe.configure({ mode: "serial" });

const DAY = 24 * 60 * 60 * 1000;
const NO_MAIL = "http://localhost:3003";
const TITLE = "Ada’s garden party";
const REDATED = "Ada’s picnic";
const ANCIENT = "Ada’s school reunion";
const POLICY = "Events on this instance are deleted 365 days after they end.";
const MARKED = /^This event will be deleted on /;
const DELETED = "This event has been deleted.";
const CUSTOM = `garden-party-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let started: number;
let operator: Page;
let operatorEmail: string;
let coHost: Page;
let coHostEmail: string;
let party: string;
let picnic: string;
let reunion: string;
let noMailHost: Page;
let noMailCoHost: Page;
let noMailParty: string;
let noMailLink: string;

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh", "db-no-mail", "app-no-mail");
});

test.afterAll(async () => {
  for (const page of [operator, coHost, noMailHost, noMailCoHost]) await page?.context().close();
});

// A start `days` days before now at today's time of day, as typed into the event form for an event
// in Singapore; negative days are ahead.
function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

// The day `days` days after `time`, as the pages give it for an event in Singapore.
function dayAfter(time: number, days: number): string {
  return new Intl.DateTimeFormat("en", { timeZone: "Asia/Singapore", dateStyle: "long" }).format(new Date(time + days * DAY));
}

// "This event will be deleted on" one of these days, the line and nothing else.
function markedOn(days: string[]): RegExp {
  return new RegExp(`^This event will be deleted on (${days.join("|")})\\.$`);
}

// The first host opens registration, so that a second can sign up and become a co-host.
async function openRegistration(page: Page) {
  await page.goto("/instance");
  await page.getByLabel("Open", { exact: true }).check();
  await page.locator("form").filter({ has: page.getByLabel("Open", { exact: true }) }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

// On the event's manage page: its owner makes a co-host link, and a second host, signed up in a
// browser of their own, accepts it.
async function addCoHost(browser: Browser, ownerPage: Page, baseURL: string, signUpHost: (page: Page) => Promise<string>) {
  await ownerPage.getByRole("link", { name: "Hosts", exact: true }).click();
  await ownerPage.getByRole("button", { name: "Make a co-host link" }).click();
  const link = await ownerPage.getByRole("textbox", { name: "Co-host link" }).inputValue();
  const page = await (await browser.newContext({ baseURL })).newPage();
  const email = await signUpHost(page);
  await page.goto(link);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return { page, email };
}

// The event's dates moved on its manage page.
async function redate(page: Page, manage: string, start: string) {
  await page.goto(manage);
  await page.getByLabel("Starts").fill(start);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. Guests who open the link see the change straight away.")).toBeVisible();
}

// The warning about this event that reached this address, found by its subject among whatever
// else the address has had, so it does not matter which sweep sent it.
async function warningTo(request: APIRequestContext, email: string, title: string): Promise<string> {
  let id = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
        const { messages } = (await response.json()) as { messages: { ID: string; Subject: string }[] };
        id = messages.find(({ Subject }) => Subject.startsWith(`${title} will be deleted on `))?.ID ?? "";
        return id;
      },
      { timeout: 15_000, message: `the warning about ${title} to ${email}` },
    )
    .not.toBe("");
  return ((await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string }).Text;
}

test("the first host of each instance shares an event with a co-host and dates it two years ago, beside other old events", async ({
  browser,
  request,
}) => {
  test.setTimeout(300_000);
  started = Date.now();
  operator = await (await browser.newContext()).newPage();
  const host = newHost("retention");
  operatorEmail = host.email;
  await signUp(operator, host);
  await verifyEmail(operator, request, host.email);
  await openRegistration(operator);
  // Dated ahead until the co-host has joined, so that no sweep marks it before they are a host.
  await createDraft(operator, { title: TITLE, start: daysAgo(-365) });
  party = operator.url();
  ({ page: coHost, email: coHostEmail } = await addCoHost(browser, operator, "http://localhost:3002", async (page) => {
    return (await signUpVerified(page, request, "retention-co-host")).email;
  }));
  await redate(operator, party, daysAgo(730));
  await createDraft(operator, { title: REDATED, start: daysAgo(730) });
  picnic = operator.url();
  await createDraft(operator, { title: ANCIENT, start: daysAgo(4000) });
  reunion = operator.url();

  // Without mail no email is verified: the hosts make and join events at once.
  noMailHost = await (await browser.newContext({ baseURL: NO_MAIL })).newPage();
  await signUp(noMailHost, newHost("retention-no-mail"));
  await openRegistration(noMailHost);
  // An event that ended long ago, which the first minute after this instance started marks. Once
  // its mark shows, nothing sweeps here until the restart, so the party, dated back only then, is
  // marked by the restart's sweep and, with no floor here, deleted by the next.
  await createDraft(noMailHost, { title: "Ada’s old notes", start: daysAgo(1000) });
  const notes = noMailHost.url();
  noMailLink = await createDraft(noMailHost, { title: TITLE, start: daysAgo(-365) });
  noMailParty = noMailHost.url();
  await noMailHost.goto(`${noMailParty}/share`);
  await noMailHost.getByRole("textbox", { name: "Custom link" }).fill(CUSTOM);
  await noMailHost.getByRole("button", { name: "Save", exact: true }).click();
  await expect(noMailHost.getByText(new RegExp(`/e/${CUSTOM}$`))).toBeVisible({ timeout: 15_000 });
  await noMailHost.goto(noMailParty);
  ({ page: noMailCoHost } = await addCoHost(browser, noMailHost, NO_MAIL, async (page) => {
    const coHostAccount = newHost("retention-no-mail-co-host");
    await signUp(page, coHostAccount);
    return coHostAccount.email;
  }));
  await expect(async () => {
    await noMailHost.goto(notes);
    await expect(noMailHost.getByText(MARKED)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 150_000, intervals: [5_000] });
  await redate(noMailHost, noMailParty, daysAgo(730));
});

test("the first sweep after a restart marks the old events and deletes nothing: their hosts see the day, and with mail every host is emailed", async ({
  request,
}) => {
  test.setTimeout(300_000);
  recreate("app-fresh", "app-no-mail");

  // The clock's first minute after the start: the manage page is read until the mark shows.
  for (const [page, manage] of [
    [operator, party],
    [noMailHost, noMailParty],
  ] as const) {
    await page.goto(manage);
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(MARKED)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 150_000, intervals: [5_000] });
  }
  // Marked at some moment since the first scenario began, which is one day or, across midnight in
  // Singapore, one of two: 30 days on with mail, and that day itself with no floor.
  const thirtyDaysOn = [...new Set([dayAfter(started, 30), dayAfter(Date.now(), 30)])];
  const today = [...new Set([dayAfter(started, 0), dayAfter(Date.now(), 0)])];

  await expect(operator.getByText(markedOn(thirtyDaysOn))).toBeVisible();
  await expect(operator.getByText(POLICY)).toBeVisible();
  await operator.goto("/dashboard");
  const card = operator.getByRole("region", { name: "Past" }).getByRole("link", { name: new RegExp(TITLE) });
  await expect(card.getByText(new RegExp(`^Will be deleted on (${thirtyDaysOn.join("|")})$`))).toBeVisible();
  await expect(noMailHost.getByText(markedOn(today))).toBeVisible();
  await expect(noMailHost.getByText(POLICY)).toBeVisible();

  // Every host of the event, the co-host too, has the warning.
  for (const email of [operatorEmail, coHostEmail]) {
    const warning = await warningTo(request, email, TITLE);
    expect(thirtyDaysOn.some((day) => warning.includes(`${TITLE} will be deleted on ${day}`))).toBe(true);
    expect(warning).toContain("Events on this instance are kept 365 days after they end");
    expect(warning).toContain("Duplicate");
    expect(warning).toContain(new URL(party).pathname);
  }
});

test("new dates, a longer period and Keep forever take off the marks they no longer bear out, and the pages show no day for them", async () => {
  test.slow();
  // The host moves one marked event to next year: its mark goes with its old dates.
  await operator.goto(picnic);
  await expect(operator.getByText(MARKED)).toBeVisible();
  await redate(operator, picnic, daysAgo(-365));
  await operator.reload();
  await expect(operator.getByText(POLICY)).toBeVisible();
  await expect(operator.getByText(MARKED)).toHaveCount(0);

  await operator.goto("/instance");
  const limits = operator.locator("form").filter({ has: operator.getByLabel("Events per host") });
  await expect(operator.getByLabel("Keep events for")).toHaveValue("365");
  // The browser's own check would stop this; the server's answer is what is under test.
  await limits.evaluate((form) => form.setAttribute("novalidate", ""));
  await operator.getByLabel("Keep events for").fill("29");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Enter a whole number of days from 30 to 3,650 to keep events for, or tick Keep forever.")).toBeVisible();

  // Ten years: the party, two years old, is out of its last 30 days again; the reunion, eleven, is not.
  await operator.getByLabel("Keep events for").fill("3650");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();
  await operator.goto(party);
  await expect(operator.getByText("Events on this instance are deleted 3,650 days after they end.")).toBeVisible();
  await expect(operator.getByText(MARKED)).toHaveCount(0);
  await operator.goto(reunion);
  await expect(operator.getByText(MARKED)).toBeVisible();

  // Keep forever, then a year again: the reunion's mark was taken off, not hidden.
  await operator.goto("/instance");
  await operator.getByLabel("Keep forever").check();
  await expect(operator.getByLabel("Keep events for")).toBeDisabled();
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();
  await operator.reload();
  await expect(operator.getByLabel("Keep forever")).toBeChecked();
  await operator.goto("/dashboard");
  await expect(operator.getByText(/^Will be deleted on /)).toHaveCount(0);
  await operator.goto(reunion);
  await expect(operator.getByRole("heading", { name: ANCIENT, level: 1 })).toBeVisible();
  await expect(operator.getByText(/^Events on this instance are deleted /)).toHaveCount(0);
  await expect(operator.getByText(MARKED)).toHaveCount(0);

  await operator.goto("/instance");
  await operator.getByLabel("Keep forever").uncheck();
  await operator.getByLabel("Keep events for").fill("365");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();
  for (const manage of [reunion, party]) {
    await operator.goto(manage);
    await expect(operator.getByText(POLICY)).toBeVisible();
    await expect(operator.getByText(MARKED)).toHaveCount(0);
  }
});

test("on the instance with no floor, the next sweep deletes the marked event: its links say so, its hosts no longer have it, and no other event takes its custom link", async ({
  page,
}) => {
  test.setTimeout(300_000);
  recreate("app-no-mail");

  // The first minute after this start: the custom link is read until it says the event is gone.
  await expect(async () => {
    await page.goto(`${NO_MAIL}/e/${CUSTOM}`);
    await expect(page.getByText(DELETED)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 150_000, intervals: [5_000] });
  await expect(page.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
  await page.goto(noMailLink);
  await expect(page.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
  await expect(page.getByText(DELETED)).toBeVisible();

  for (const host of [noMailHost, noMailCoHost]) {
    await host.goto("/dashboard");
    await expect(host.getByText("You have no events yet. Create one and share its link.")).toBeVisible();
  }
  await createDraft(noMailCoHost, { title: "Mei’s picnic", start: "2027-05-01T12:00" });
  await noMailCoHost.goto(`${noMailCoHost.url()}/share`);
  await noMailCoHost.getByRole("textbox", { name: "Custom link" }).fill(CUSTOM);
  await noMailCoHost.getByRole("button", { name: "Save", exact: true }).click();
  await expect(noMailCoHost.getByText("That link is taken.")).toBeVisible({ timeout: 15_000 });
});

test("on an instance upgraded with the default, a new event's manage page gives the period of a year", async ({ browser, request }) => {
  const page = await (await browser.newContext({ baseURL: "http://localhost:3000" })).newPage();
  await signUpVerified(page, request, "retention-app");
  await createDraft(page, { title: "Mei’s picnic", start: "2027-05-01T12:00" });
  await expect(page.getByText(POLICY)).toBeVisible();
  await expect(page.getByText(MARKED)).toHaveCount(0);
  await page.context().close();
});
