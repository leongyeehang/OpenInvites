import { expect, test, type Page } from "./test";
import { createDraft } from "./events";
import { latestMailTo, mailCountTo, newHost, signUp, signUpVerified, verifyEmail } from "./hosts";
import { recreate } from "./instances";

// Ticket 10: retention. Runs against `app-fresh` (with mail) and `app-no-mail` after the limits
// spec (the `retention-instance` project), and recreates both, so each starts empty and keeps
// events a year, as a new instance does. The first host on each makes an event that ended two
// years ago; then both app containers are restarted, as an upgrade restarts them, so the clock's
// first minute after the start sweeps with the event there (spec, "Retention"; Review Focus 2):
// it is marked, to be deleted 30 days on, and not deleted. The scenarios run in order, each
// leaving the instances as the next expects them.
test.describe.configure({ mode: "serial" });

const DAY = 24 * 60 * 60 * 1000;
const NO_MAIL = "http://localhost:3003";
const TITLE = "Ada’s garden party";
const POLICY = "Events on this instance are deleted 365 days after they end.";
const MARKED = /^This event will be deleted on /;

let operator: Page;
let operatorEmail: string;
let noMailHost: Page;

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh", "db-no-mail", "app-no-mail");
});

test.afterAll(async () => {
  await operator?.context().close();
  await noMailHost?.context().close();
});

// Today's time of day two years ago, as typed into the event form for an event in Singapore.
function twoYearsAgo(): string {
  return new Date(Date.now() - 730 * DAY + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

// The day 30 days after `time`, as the pages give it for an event in Singapore.
function thirtyDaysAfter(time: number): string {
  return new Intl.DateTimeFormat("en", { timeZone: "Asia/Singapore", dateStyle: "long" }).format(new Date(time + 30 * DAY));
}

test("the first host of each instance makes an event that ended two years ago, not yet marked", async ({ browser, request }) => {
  test.slow();
  operator = await (await browser.newContext()).newPage();
  const host = newHost("retention");
  operatorEmail = host.email;
  await signUp(operator, host);
  await verifyEmail(operator, request, host.email);
  await createDraft(operator, { title: TITLE, start: twoYearsAgo() });
  await expect(operator.getByText(MARKED)).toHaveCount(0);

  // Without mail no email is verified: the host makes events at once.
  noMailHost = await (await browser.newContext({ baseURL: NO_MAIL })).newPage();
  await signUp(noMailHost, newHost("retention-no-mail"));
  await createDraft(noMailHost, { title: TITLE, start: twoYearsAgo() });
  await expect(noMailHost.getByText(MARKED)).toHaveCount(0);
});

test("the first sweep after a restart marks the old event and deletes nothing: its hosts see the day, 30 days on, and with mail are emailed", async ({
  request,
}) => {
  test.setTimeout(300_000);
  const mails = await mailCountTo(request, operatorEmail);
  const restarted = Date.now();
  recreate("app-fresh", "app-no-mail");

  // The clock's first minute after the start: the manage page is read until the mark shows.
  for (const page of [operator, noMailHost]) {
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(MARKED)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 150_000, intervals: [5_000] });
  }
  // Marked at some moment between the restart and now, which is one day or, across midnight in
  // Singapore, one of two.
  const days = [...new Set([thirtyDaysAfter(restarted), thirtyDaysAfter(Date.now())])];
  const day = (page: Page) => page.getByText(new RegExp(`^This event will be deleted on (${days.join("|")})\\.$`));

  for (const page of [operator, noMailHost]) {
    await expect(day(page)).toBeVisible();
    await expect(page.getByText(POLICY)).toBeVisible();
    const manage = new URL(page.url()).pathname;
    await page.goto("/dashboard");
    const card = page.getByRole("region", { name: "Past" }).getByRole("link", { name: new RegExp(TITLE) });
    await expect(card.getByText(new RegExp(`^Deleted on (${days.join("|")})$`))).toBeVisible();
    await page.goto(manage);
  }

  const warning = await latestMailTo(request, operatorEmail, mails);
  expect(warning).toContain(`${TITLE} will be deleted on`);
  expect(days.some((one) => warning.includes(`will be deleted on ${one}`))).toBe(true);
  expect(warning).toContain("Events on this instance are kept 365 days after they end");
  expect(warning).toContain("Duplicate");
  expect(warning).toContain(new URL(operator.url()).pathname);
});

test("the operator keeps events forever, and the period and the day leave the pages", async () => {
  await operator.goto("/instance");
  const limits = operator.locator("form").filter({ has: operator.getByLabel("Events per host") });
  await expect(operator.getByLabel("Keep events for")).toHaveValue("365");

  // The browser's own check would stop this; the server's answer is what is under test.
  await limits.evaluate((form) => form.setAttribute("novalidate", ""));
  await operator.getByLabel("Keep events for").fill("29");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Enter a whole number of days from 30 to 3,650 to keep events for, or tick Keep forever.")).toBeVisible();

  await operator.getByLabel("Keep forever").check();
  await expect(operator.getByLabel("Keep events for")).toBeDisabled();
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();
  await operator.reload();
  await expect(operator.getByLabel("Keep forever")).toBeChecked();

  await operator.goto("/dashboard");
  await expect(operator.getByText(/^Deleted on /)).toHaveCount(0);
  await operator.getByRole("link", { name: new RegExp(TITLE) }).click();
  await expect(operator.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
  await expect(operator.getByText(POLICY)).toHaveCount(0);
  await expect(operator.getByText(MARKED)).toHaveCount(0);
});

test("on an instance upgraded with the default, a new event's manage page gives the period of a year", async ({ browser, request }) => {
  const page = await (await browser.newContext({ baseURL: "http://localhost:3000" })).newPage();
  await signUpVerified(page, request, "retention-app");
  await createDraft(page, { title: "Mei’s picnic", start: "2027-05-01T12:00" });
  await expect(page.getByText(POLICY)).toBeVisible();
  await expect(page.getByText(MARKED)).toHaveCount(0);
  await page.context().close();
});
