import { expectNoSeriousViolations } from "./axe";
import { createDraft, createPublished, HOUR, itemFromNow, pickDesign, saveStatus, setSchedule, utcFromNow } from "./events";
import { signUpVerified } from "./hosts";
import { expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// M6 ticket 01: the host lists the day's timed items in the editor's Schedule sheet, opened from
// the details list. They are saved as a whole and kept in day-and-time order, whatever order they
// were typed in; a refusal names the row and keeps the sheet open.

async function openSchedule(page: Page) {
  await page.getByRole("button", { name: /^Schedule:/ }).click();
  const sheet = page.getByRole("dialog", { name: "Schedule" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("the host lists the schedule out of order, it is kept in order, and a mistake is refused by its row", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "schedule-host");
  await createDraft(page, { title: "Ada’s wedding", start: "2027-05-08T15:00", end: "2027-05-09T13:00" });
  await expect(page.getByRole("button", { name: /^Schedule:/ })).toHaveAccessibleName("Schedule: Add a schedule");

  // Three items, typed out of order: the next morning's brunch first, then the cake before the
  // dinner. The two on the event's day keep the day a new row starts on.
  await setSchedule(
    page,
    [
      { day: "2027-05-09", start: "10:00", title: "Brunch", place: "The terrace" },
      { start: "21:00", title: "Cake" },
      { start: "19:00", end: "21:00", title: "Dinner", place: "The garden", note: "Jackets for the evening" },
    ],
    "reload",
  );
  await expect(page.getByRole("button", { name: /^Schedule:/ })).toHaveAccessibleName("Schedule: 3 items");

  // Reopened, the items are in day-and-time order, each as typed, with the freshness chosen.
  const sheet = await openSchedule(page);
  await expect(sheet.locator("ol > li")).toHaveCount(3);
  for (const [index, title] of ["Dinner", "Cake", "Brunch"].entries()) {
    await expect(sheet.getByLabel(`Title ${index + 1}`, { exact: true })).toHaveValue(title);
  }
  await expect(sheet.getByLabel("Day 1", { exact: true })).toHaveValue("2027-05-08");
  await expect(sheet.getByLabel("Day 2", { exact: true })).toHaveValue("2027-05-08");
  await expect(sheet.getByLabel("Day 3", { exact: true })).toHaveValue("2027-05-09");
  await expect(sheet.getByLabel("Start time 1", { exact: true })).toHaveValue("19:00");
  await expect(sheet.getByLabel("End time 1 (optional)")).toHaveValue("21:00");
  await expect(sheet.getByLabel("Place 1 (optional)")).toHaveValue("The garden");
  await expect(sheet.getByLabel("Note 1 (optional)")).toHaveValue("Jackets for the evening");
  await expect(sheet.getByLabel("End time 2 (optional)")).toHaveValue("");
  await expect(sheet.getByRole("radio", { name: "Only when the page is opened" })).toBeChecked();
  await expect(sheet.getByRole("radio", { name: "Refresh every minute while the event is on" })).not.toBeChecked();
  await expectNoSeriousViolations(page, "the schedule's sheet");

  // The cake ending before it starts is refused, naming its row, and the sheet stays open.
  await sheet.getByLabel("End time 2 (optional)").fill("20:30");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Item 2 needs its end time to be later than its start.");
  await expect(saveStatus(page)).toHaveAttribute("data-status", "failed");
  await expect(sheet).toBeVisible();

  // So is the brunch without its title.
  await sheet.getByLabel("End time 2 (optional)").fill("");
  await sheet.getByLabel("Title 3", { exact: true }).fill("");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Item 3 needs a title.");
  await expect(sheet).toBeVisible();

  // Closed without saving, the schedule is as it was.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: /^Schedule:/ })).toHaveAccessibleName("Schedule: 3 items");
  await openSchedule(page);
  await expect(sheet.getByLabel("Title 3", { exact: true })).toHaveValue("Brunch");
});

// M6 ticket 02: the event page shows the schedule in every layout, in the event's zone, each item
// past, now or upcoming by the guest's clock, and under `minute` re-reads itself while the event is
// on. The states are by the real clock: the event and its items are dated from now, in UTC, since
// the server draws the first states and the browser must agree with it; `page.clock` only runs the
// minute forward. The guests' devices are in Singapore, so the page names the event's zone, which
// it can only do once the browser has taken the page over: the sign that the clock is running.
test.use({ timezoneId: "Asia/Singapore" });

const MINUTE = 60_000;

// A published event that started three hours ago and ends in six, in UTC, with three items typed
// out of order: one in two hours, one that started half an hour ago with no end, and one from two
// hours ago to one hour ago.
async function liveEvent(browser: Browser, request: APIRequestContext, label: string, refresh: "minute" | "reload") {
  const host = await createPublished(browser, request, label, { title: "Ada’s open house", start: utcFromNow(-3 * HOUR), end: utcFromNow(6 * HOUR), timeZone: "UTC" });
  await setSchedule(
    host.page,
    [itemFromNow("Garden games", 2 * HOUR), itemFromNow("Lunch", -30 * MINUTE), itemFromNow("Welcome drinks", -2 * HOUR, -HOUR)],
    refresh,
  );
  return host;
}

// The schedule on the guest's page, once the browser has taken it over.
async function guestSchedule(page: Page, link: string) {
  await page.goto(link);
  const schedule = page.locator('[data-slot="schedule"]');
  await expect(schedule.getByText("Times are in UTC.")).toBeVisible({ timeout: 15_000 });
  return schedule;
}

// What a guest's page sends when it re-reads itself: a request for the page's server components,
// which a link's prefetch also is, marked as such.
const isRefresh = (headers: Record<string, string>) => headers["rsc"] === "1" && !headers["next-router-prefetch"];

// What React says when the server's page and the browser's first drawing disagree, in a
// production build by its error's number.
const HYDRATION = /hydrat|#418|#423|#425/i;

async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

test("a live schedule is in order and follows the clock, past, now and upcoming, in each layout", async ({ page, browser, request }) => {
  test.slow();
  const complaints: string[] = [];
  page.on("console", (message) => message.type() === "error" && complaints.push(message.text()));
  page.on("pageerror", (error) => complaints.push(error.message));
  const host = await liveEvent(browser, request, "schedule-live", "reload");

  for (const layout of ["poster", "broadsheet", "thread"] as const) {
    if (layout !== "poster") {
      await pickDesign(host.page, "Theme", "Layout", layout === "broadsheet" ? /^Broadsheet/ : /^Thread/);
      await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(`data-layout="${layout}"`);
    }
    const schedule = await guestSchedule(page, host.link);
    await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", layout);
    // The Thread's bubble is named by its heading.
    if (layout === "thread") await expect(page.getByRole("region", { name: "Schedule", exact: true })).toBeVisible();

    // In day-and-time order, whatever order they were typed in, on one day with no day heading
    // (unless the run is so near midnight that they span two).
    const items = schedule.getByRole("listitem");
    await expect(items).toHaveCount(3);
    for (const [index, title] of ["Welcome drinks", "Lunch", "Garden games"].entries()) await expect(items.nth(index)).toContainText(title);

    // The drinks have ended, said to a screen reader; lunch is on now, marked; the games are to come.
    await expect(items.nth(0)).toHaveAttribute("data-state", "past");
    await expect(items.nth(0).locator(".sr-only")).toHaveText("Ended");
    await expect(items.nth(0)).not.toHaveAttribute("aria-current");
    await expect(items.nth(1)).toHaveAttribute("data-state", "now");
    await expect(items.nth(1)).toHaveAttribute("aria-current", "true");
    await expect(items.nth(1).getByText("Now", { exact: true })).toBeVisible();
    await expect(items.nth(2)).toHaveAttribute("data-state", "upcoming");
    await expect(items.nth(2)).not.toHaveAttribute("aria-current");
    await expect(schedule.locator("[aria-current]")).toHaveCount(1);
    await expectNoSeriousViolations(page, `a live schedule on the ${layout}`);
  }

  expect(complaints.filter((complaint) => HYDRATION.test(complaint)), "hydration errors").toEqual([]);
  await host.context.close();
});

test("tomorrow’s schedule over two days is under two day headings, and nothing in it is now", async ({ page, browser, request }) => {
  test.slow();
  const [tomorrow, after] = [utcFromNow(24 * HOUR).slice(0, 10), utcFromNow(48 * HOUR).slice(0, 10)];
  const host = await createPublished(browser, request, "schedule-days", { title: "Ada’s wedding", start: `${tomorrow}T09:00`, end: `${after}T13:00`, timeZone: "UTC" });
  await setSchedule(host.page, [
    { day: after, start: "11:00", title: "Brunch" },
    { day: tomorrow, start: "15:00", end: "16:00", title: "Ceremony" },
    { day: tomorrow, start: "19:00", title: "Dinner" },
  ]);

  const schedule = await guestSchedule(page, host.link);
  const heading = (day: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T00:00Z`));
  await expect(schedule.getByRole("heading", { level: 3 })).toHaveText([heading(tomorrow), heading(after)]);
  await expect(schedule.getByRole("list")).toHaveCount(2);
  await expect(schedule.getByRole("list").nth(0).getByRole("listitem")).toHaveCount(2);
  await expect(schedule.getByRole("list").nth(1).getByRole("listitem")).toContainText("Brunch");
  await expect(schedule.locator('[data-state="upcoming"]')).toHaveCount(3);
  await expect(schedule.locator("[aria-current]")).toHaveCount(0);
  await host.context.close();
});

test("under “every minute”, the host’s change reaches an open page within a minute, without a reload", async ({ page, browser, request }) => {
  test.slow();
  const host = await liveEvent(browser, request, "schedule-minute", "minute");
  await page.clock.install();
  const schedule = await guestSchedule(page, host.link);
  const items = schedule.getByRole("listitem");
  await expect(items).toHaveCount(3);
  // Marked, so a reload would show: a fresh page would not have it.
  await page.evaluate(() => Object.assign(window, { stillTheSamePage: true }));

  await setSchedule(host.page, [itemFromNow("Fireworks", 4 * HOUR)]);
  const refreshed = page.waitForResponse((response) => isRefresh(response.request().headers()));
  await page.clock.runFor(61_000);
  await refreshed;
  await expect(items).toHaveCount(4);
  await expect(items.nth(3)).toContainText("Fireworks");
  expect(await page.evaluate(() => "stillTheSamePage" in window)).toBe(true);
  await host.context.close();
});

test("under “only when the page is opened”, an open page never re-reads itself, and a reload shows the change", async ({ page, browser, request }) => {
  test.slow();
  const host = await liveEvent(browser, request, "schedule-reload", "reload");
  await page.clock.install();
  const schedule = await guestSchedule(page, host.link);
  const items = schedule.getByRole("listitem");
  await expect(items).toHaveCount(3);

  await setSchedule(host.page, [itemFromNow("Fireworks", 4 * HOUR)]);
  const refreshes: string[] = [];
  page.on("request", (sent) => isRefresh(sent.headers()) && refreshes.push(sent.url()));
  await page.clock.runFor(61_000);
  // Nothing is coming, so there is nothing to wait for but a moment of real time for it not to.
  await page.waitForTimeout(2_000);
  expect(refreshes).toEqual([]);
  await expect(items).toHaveCount(3);

  await page.reload();
  await expect(items).toHaveCount(4);
  await expect(items.nth(3)).toContainText("Fireworks");
  await host.context.close();
});
