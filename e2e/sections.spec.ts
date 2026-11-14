import { expectNoSeriousViolations } from "./axe";
import { arrange, createPublished, openArrange, sectionOrder, setSchedule } from "./events";
import { expect, test, type Browser, type APIRequestContext, type Locator, type Page } from "./test";

// M8 ticket 25: the host puts the Poster's sections in order in the editor's Arrange sheet, and
// switches off the ones whose switch is the arrangement's own; guests see that order. A page never
// arranged keeps the order it always had.

const EVENT = { title: "Ada’s birthday", start: "2027-05-08T19:00" };

// A published event with one item on its schedule, and a guest's page of it, not replied.
async function eventWithSchedule(browser: Browser, request: APIRequestContext, label: string) {
  const host = await createPublished(browser, request, label, EVENT);
  await setSchedule(host.page, [{ start: "20:00", title: "Cake" }]);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(host.link);
  return { host, guest, close: () => Promise.all([host.context.close(), guestContext.close()]) };
}

// The rows of the Arrange sheet, by the name each one starts with.
async function rowNames(sheet: Locator) {
  const texts = await sheet.getByRole("list", { name: "Sections" }).getByRole("listitem").allInnerTexts();
  return texts.map((text) => text.split("\n")[0].trim());
}

const liveLine = (sheet: Locator) => sheet.locator('[aria-live="polite"]');

async function expectOrder(page: Page, order: string[]) {
  await expect.poll(() => sectionOrder(page), { message: "the page's sections in order" }).toEqual(order);
}

test("a page never arranged keeps today's Poster order", async ({ browser, request }) => {
  test.slow();
  const { guest, close } = await eventWithSchedule(browser, request, "sections-default");
  await expectOrder(guest, ["details", "schedule", "guests", "comments", "album"]);
  // The guest panel is a section like the rest now, and says so.
  await expect(guest.locator('[data-slot="guests"][data-section="guests"]')).toHaveCount(1);
  await close();
});

test("the host moves the Album above the Comments", async ({ browser, request }) => {
  test.slow();
  const { host, guest, close } = await eventWithSchedule(browser, request, "sections-move");

  // The editor's album placeholder says what guests will see there, and that it opens Arrange.
  const placeholder = host.page.getByRole("button", { name: "Photos and videos from the event, from its start." });
  await expect(placeholder).toHaveAccessibleDescription("Opens the Arrange sheet.");
  await placeholder.click();
  await expect(host.page.getByRole("dialog", { name: "Arrange" })).toBeVisible();
  await host.page.keyboard.press("Escape");
  await expect(host.page.getByRole("dialog", { name: "Arrange" })).toBeHidden();

  await arrange(host.page, async (sheet) => {
    const up = sheet.getByRole("button", { name: "Move Album up" });
    await up.click();
    await expect(up).toBeFocused();
    await expect(liveLine(sheet)).toHaveText("Album, 6 of 7");
  });

  // The editor's invitation follows, then a guest's page.
  await expectOrder(host.page, ["details", "schedule", "guests", "announcements", "album", "comments"]);
  await guest.reload();
  await expectOrder(guest, ["details", "schedule", "guests", "album", "comments"]);

  // And the sheet holds the order after a reload.
  await host.page.reload();
  const sheet = await openArrange(host.page);
  expect(await rowNames(sheet)).toEqual(["Personal letter", "Details", "Schedule", "Who’s coming", "Announcements", "Album", "Comments"]);
  await close();
});

test("Schedule off leaves the guest page, and on brings it back", async ({ browser, request }) => {
  test.slow();
  const { host, guest, close } = await eventWithSchedule(browser, request, "sections-switch");
  await expect(guest.locator('[data-section="schedule"]')).toContainText("Cake");

  await arrange(host.page, async (sheet) => {
    const schedule = sheet.getByRole("switch", { name: "Schedule" });
    await expect(schedule).toBeChecked();
    await schedule.click();
    await expect(schedule).not.toBeChecked();
  });
  await guest.reload();
  await expect(guest.locator('[data-section="details"]')).toBeVisible();
  await expect(guest.locator('[data-section="schedule"]')).toHaveCount(0);

  await arrange(host.page, (sheet) => sheet.getByRole("switch", { name: "Schedule" }).click());
  await guest.reload();
  await expect(guest.locator('[data-section="schedule"]')).toContainText("Cake");
  await close();
});

test("Arrange by keyboard", async ({ browser, request }) => {
  test.slow();
  const { host, close } = await eventWithSchedule(browser, request, "sections-keyboard");
  const page = host.page;
  const sheet = await openArrange(page);
  await expect(sheet.getByRole("heading", { name: "Arrange" })).toBeFocused();

  // Tab from the heading, through the rows above, to the Album's Move up.
  const up = sheet.getByRole("button", { name: "Move Album up" });
  for (let stop = 0; stop < 40 && !(await up.evaluate((button) => button === document.activeElement)); stop++) await page.keyboard.press("Tab");
  await expect(up).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(liveLine(sheet)).toHaveText("Album, 6 of 7");
  await page.keyboard.press("Enter");
  await expect(up).toBeFocused();
  await expect(liveLine(sheet)).toHaveText("Album, 5 of 7");
  await expect.poll(() => rowNames(sheet)).toEqual(["Personal letter", "Details", "Schedule", "Who’s coming", "Album", "Announcements", "Comments"]);

  // Both presses are saved, in order.
  await page.keyboard.press("Escape");
  await expectOrder(page, ["details", "schedule", "guests", "album", "announcements", "comments"]);
  await close();
});

test("the editor with the Arrange sheet open has no serious accessibility problems", async ({ browser, request }) => {
  test.slow();
  const { host, close } = await eventWithSchedule(browser, request, "sections-axe");
  await openArrange(host.page);
  await expectNoSeriousViolations(host.page, "the Arrange sheet");
  await close();
});
