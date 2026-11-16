import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { arrange, createPublished, openArrange, sectionOrder, setGuestList, setSchedule } from "./events";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type Browser, type APIRequestContext, type Locator, type Page } from "./test";

// M8 ticket 25: the host puts the Poster's sections in order in the editor's Arrange sheet, and
// switches off the ones whose switch is the arrangement's own; guests see that order. A page never
// arranged keeps the order it always had. Ticket 26: the Comments, Who's coming, the Album and the
// Letter are switched there too, each its event's column, which the server checks.

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

// A guest of their own, on an address of their own (the upload limit counts per address), who
// answers Going and comes back to the page.
async function guestGoing(browser: Browser, link: string, name: string): Promise<Page> {
  const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await closeReply(page);
  return page;
}

const section = (page: Page, key: string) => page.locator(`[data-section="${key}"]`);

test("Comments off in Arrange", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-comments", { ...EVENT, plusOnes: "0" });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const box = priya.getByLabel("Add a comment");
  await box.fill("See you there!");
  await priya.getByRole("button", { name: "Post", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });

  // The host switches the Comments off; the page Priya has open is refused its next post.
  await arrange(host.page, async (sheet) => {
    const comments = sheet.getByRole("switch", { name: "Comments" });
    await expect(comments).toHaveAccessibleDescription("Off, guests see no comments and can’t post one.");
    await comments.click();
    await expect(comments).not.toBeChecked();
  });
  await box.fill("Can I bring cake?");
  await priya.getByRole("button", { name: "Post", exact: true }).click();
  await expect(priya.getByRole("alert").filter({ hasText: "This event isn’t taking comments." })).toBeVisible({ timeout: 15_000 });
  await priya.reload();
  await expect(section(priya, "details")).toBeVisible();
  await expect(section(priya, "comments")).toHaveCount(0);
  expect(await priya.content()).not.toContain("See you there!");

  // Switched on again, what was said is back, and nothing posted while it was off.
  await arrange(host.page, (sheet) => sheet.getByRole("switch", { name: "Comments" }).click());
  await priya.reload();
  await expect(section(priya, "comments")).toContainText("See you there!");
  await expect(section(priya, "comments")).not.toContainText("Can I bring cake?");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("the Album off refuses uploads and keeps the photos", async ({ browser, request }) => {
  test.slow();
  // An event that has started, so its album is open.
  const host = await createPublished(browser, request, "sections-album", { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const album = section(priya, "album");
  const garden = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#2f6b3a" } }).jpeg().toBuffer();
  await album.getByLabel(/^Add photos/).setInputFiles([{ name: "garden.jpg", mimeType: "image/jpeg", buffer: garden }]);
  await expect(album.getByRole("status")).toContainText("garden.jpg: added", { timeout: 20_000 });
  await expect(album.getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible({ timeout: 15_000 });

  await arrange(host.page, async (sheet) => {
    const switched = sheet.getByRole("switch", { name: "Album" });
    await expect(switched).toHaveAccessibleDescription("Off, guests see no album and can’t add to it. Nothing in it is deleted.");
    await switched.click();
    await expect(switched).not.toBeChecked();
  });
  // The editor no longer previews an album.
  await expect(section(host.page, "album")).toHaveCount(0);

  // The page Priya loaded before the switch still shows its album; what it sends is refused.
  await expect(album).toBeVisible();
  const slug = new URL(host.link).pathname.split("/").pop()!;
  const answer = await priya.evaluate(async (url) => {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: [{ name: "cake.jpg", size: 1000, type: "image/jpeg" }] }) });
    return { status: response.status, body: await response.json() };
  }, `/api/albums/${slug}/uploads`);
  expect(answer).toEqual({ status: 409, body: { error: "closed" } });
  await priya.reload();
  await expect(section(priya, "details")).toBeVisible();
  await expect(section(priya, "album")).toHaveCount(0);

  // Switched on again, the photo is there.
  await arrange(host.page, (sheet) => sheet.getByRole("switch", { name: "Album" }).click());
  await priya.reload();
  await expect(section(priya, "album").getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("Who's coming", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-guests", { ...EVENT, plusOnes: "0" });
  const editor = host.page.url();
  const mei = await guestGoing(browser, host.link, "Mei Lin");
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await expect(section(priya, "guests")).toContainText("Mei Lin");

  // Off: the row has no choice of who sees it, and nobody but the hosts sees the list.
  await setGuestList(host.page, "hidden");
  const sheet = await openArrange(host.page);
  await expect(sheet.getByRole("switch", { name: "Who’s coming" })).not.toBeChecked();
  await expect(sheet.getByRole("button", { name: "Options for Who’s coming" })).toHaveCount(0);
  await expect(sheet.getByRole("radiogroup")).toHaveCount(0);
  await host.page.keyboard.press("Escape");
  await priya.reload();
  await expect(section(priya, "details")).toBeVisible();
  await expect(section(priya, "guests")).toHaveCount(0);
  expect(await priya.content()).not.toContain("Mei Lin");
  await host.page.goto(`${editor}/guests`);
  await expect(host.page.getByText("Priya Nair")).toBeVisible();
  await expect(host.page.getByText("Mei Lin")).toBeVisible();

  // On, for everyone with the link: a visitor who has not replied sees her name, and the editor
  // says who sees it.
  await host.page.goto(editor);
  await setGuestList(host.page, "always");
  await expect(host.page.getByRole("button", { name: "Who’s coming, for everyone with the link." })).toBeVisible();
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(host.link);
  await expect(section(visitor, "guests")).toContainText("Priya Nair");
  await Promise.all([host.context.close(), mei.context().close(), priya.context().close(), visitor.context().close()]);
});

test("the Letter's switch is the Invites page's", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-letter", EVENT);
  const editor = host.page.url();
  await arrange(host.page, async (sheet) => {
    const letter = sheet.getByRole("switch", { name: "Personal letter" });
    await expect(letter).toHaveAccessibleDescription("Guests you invite personally read the letter you write them on the Invites page.");
    await expect(letter).not.toBeChecked();
    await letter.click();
    await expect(letter).toBeChecked();
  });

  // On in Arrange, on on the Invites page; off there, off in Arrange.
  await host.page.goto(`${editor}/invites`);
  const letters = host.page.getByRole("checkbox", { name: "Personal letters" });
  await expect(letters).toBeChecked();
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toBeVisible();
  await letters.click();
  await expect(letters).not.toBeChecked();
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toHaveCount(0, { timeout: 15_000 });
  await host.page.goto(editor);
  await expect((await openArrange(host.page)).getByRole("switch", { name: "Personal letter" })).not.toBeChecked();
  await host.context.close();
});

test("the Arrange sheet with Who's coming open has no serious accessibility problems", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-axe-guests", EVENT);
  const sheet = await openArrange(host.page);
  const options = sheet.getByRole("button", { name: "Options for Who’s coming" });
  await options.click();
  await expect(options).toHaveAttribute("aria-expanded", "true");
  const audience = sheet.getByRole("radiogroup", { name: "Who sees it" });
  await expect(audience).toHaveAccessibleDescription("The hosts always see the whole list.");
  await expect(audience.getByRole("radio", { name: "Guests who have replied" })).toBeChecked();
  await expectNoSeriousViolations(host.page, "the Arrange sheet, Who’s coming open");
  await host.context.close();
});
