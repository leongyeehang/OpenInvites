import { readFileSync } from "node:fs";
import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import {
  addSection,
  arrange,
  arrangeSheet,
  chooseLayout,
  closeSheets,
  createPublished,
  openArrange,
  openMore,
  openSettings,
  savedAfter,
  saveStatus,
  sectionOrder,
  setGuestList,
  setSchedule,
  setWhen,
  writeLink,
  writeNote,
} from "./events";
import { tabTo } from "./focus";
import { closeReply, rsvpSheet } from "./reply";
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
    await expect(liveLine(sheet)).toHaveText("Album, 6 of 8");
  });

  // The editor's invitation follows, then a guest's page.
  await expectOrder(host.page, ["details", "schedule", "guests", "announcements", "album", "comments"]);
  await guest.reload();
  await expectOrder(guest, ["details", "schedule", "guests", "album", "comments"]);

  // And the sheet holds the order after a reload.
  await host.page.reload();
  const sheet = await openArrange(host.page);
  expect(await rowNames(sheet)).toEqual(["Personal letter", "Details", "Schedule", "Who’s coming", "Announcements", "Album", "Comments", "Countdown"]);
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
  await expect(liveLine(sheet)).toHaveText("Album, 6 of 8");
  await page.keyboard.press("Enter");
  await expect(up).toBeFocused();
  await expect(liveLine(sheet)).toHaveText("Album, 5 of 8");
  await expect.poll(() => rowNames(sheet)).toEqual(["Personal letter", "Details", "Schedule", "Who’s coming", "Album", "Announcements", "Comments", "Countdown"]);

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

// M8 ticket 27: the Broadsheet and the Thread draw the same placed list as the Poster, each in its
// own way: the Broadsheet's header keeps its facts and its body follows the host's order; the
// Thread keeps its card first and its composer last, its details are three bubbles in a row, and
// its announcements one bubble each, moved together.

const PARTY = { ...EVENT, location: "12 Orchard Road", description: "Bring a jumper for the garden." };

// The host posts an announcement from the event's announcements page, as announcements.spec.ts
// sends one, and comes back to the editor.
async function announce(page: Page, text: string) {
  const editor = page.url();
  await page.goto(`${editor}/announcements`);
  const message = page.getByLabel("Message");
  await message.fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("", { timeout: 15_000 });
  await page.goto(editor);
}

// A published event in a layout, with one item on its schedule.
async function laidOut(browser: Browser, request: APIRequestContext, label: string, layout: "Broadsheet" | "Thread") {
  const host = await createPublished(browser, request, label, { ...PARTY, layout });
  await setSchedule(host.page, [{ start: "20:00", title: "Cake" }]);
  return host;
}

async function visitor(browser: Browser, link: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  return page;
}

test("a Broadsheet never arranged keeps today's order", async ({ browser, request }) => {
  test.slow();
  const host = await laidOut(browser, request, "sections-broadsheet", "Broadsheet");
  await announce(host.page, "The gate code is 1234.");
  const guest = await visitor(browser, host.link);
  await expectOrder(guest, ["details", "schedule", "announcements", "guests", "comments", "album"]);

  // The details are the description, in the paper under the header, which keeps the facts.
  const description = guest.locator('section[data-slot="description"][data-section="details"]');
  await expect(description).toContainText("The details");
  await expect(description).toContainText("Bring a jumper for the garden.");
  await expect(guest.locator('header [data-section="details"]')).toHaveCount(0);
  const header = (await guest.locator("main header").boundingBox())!;
  expect((await description.boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("the Broadsheet follows the host's order", async ({ browser, request }) => {
  test.slow();
  const host = await laidOut(browser, request, "sections-broadsheet-move", "Broadsheet");
  await arrange(host.page, async (sheet) => {
    await sheet.getByRole("button", { name: "Move Album up" }).click();
    await expect(liveLine(sheet)).toHaveText("Album, 6 of 8");
  });
  const guest = await visitor(browser, host.link);
  await expectOrder(guest, ["details", "schedule", "guests", "album", "comments"]);
  // The header still holds When, Where and the Host fact.
  await expect(guest.locator("main header dt")).toHaveText(["When", "Where", "Host", "Countdown"]);
  await expect(guest.locator("main header")).toContainText("12 Orchard Road");
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("a Thread never arranged keeps today's order", async ({ browser, request }) => {
  test.slow();
  const host = await laidOut(browser, request, "sections-thread", "Thread");
  // The host, to whom the comments are open.
  const page = host.page;
  await page.goto(host.link);
  await expectOrder(page, ["details", "schedule", "guests", "comments", "album"]);
  // The card first, then the description, When and Where in a row.
  await expect(page.locator('[data-slot="thread-card"]:first-child + [data-slot="description"][data-section="details"] + [data-section="details"] + [data-section="details"]')).toHaveCount(1);
  await expect(page.locator('[data-section="details"]').nth(1)).toContainText("When");
  await expect(page.locator('[data-section="details"]').nth(2)).toContainText("12 Orchard Road");

  // The comments are folded away, their summary saying how many there are.
  const comments = page.locator('details[data-slot="comments"][data-section="comments"]');
  await expect(comments).not.toHaveAttribute("open");
  await expect(comments.locator("summary h2")).toHaveText("Comments");
  await expect(comments.locator('summary [data-slot="section-count"]')).toHaveText("none yet");

  // The composer is after the last section.
  const after = await page.locator("[data-section]").last().evaluate((last) => {
    const log = document.querySelector('[role="log"]');
    return log !== null && (last.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(after).toBe(true);

  // A visitor who has not replied gets the comments as a plain bubble, with how many and the lock.
  const guest = await visitor(browser, host.link);
  const locked = guest.locator('[data-section="comments"]');
  await expect(locked).toContainText("No comments yet");
  await expect(locked).toContainText("Reply to join the conversation");
  await expect(guest.locator('details[data-slot="comments"]')).toHaveCount(0);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("the Thread moves its announcements as a group", async ({ browser, request }) => {
  test.slow();
  const host = await laidOut(browser, request, "sections-thread-move", "Thread");
  await announce(host.page, "The gate code is 1234.");
  await announce(host.page, "Parking is on Mill Lane.");
  await arrange(host.page, async (sheet) => {
    const up = sheet.getByRole("button", { name: "Move Announcements up" });
    await up.click();
    await expect(liveLine(sheet)).toHaveText("Announcements, 4 of 8");
    await up.click();
    await expect(liveLine(sheet)).toHaveText("Announcements, 3 of 8");
  });
  const guest = await visitor(browser, host.link);
  await expectOrder(guest, ["details", "announcements", "schedule", "guests", "comments", "album"]);
  // Oldest first, one after the other, and both before the schedule.
  const pieces = await guest.locator('[data-slot="announcement"], [data-section="schedule"]').evaluateAll((elements) =>
    elements.map((element) => (element.getAttribute("data-slot") === "announcement" ? element.textContent : "schedule")),
  );
  expect(pieces).toHaveLength(3);
  expect(pieces[0]).toContain("The gate code is 1234.");
  expect(pieces[1]).toContain("Parking is on Mill Lane.");
  expect(pieces[2]).toBe("schedule");
  await expect(guest.locator('[data-slot="announcement"][data-section="announcements"] + [data-slot="announcement"][data-section="announcements"]')).toHaveCount(1);
  await Promise.all([host.context.close(), guest.context().close()]);
});

// Ticket 28's review: a collapsed Announcements reads in the order its layout reads it, oldest
// first in the Thread as its bubbles are, newest first on the Poster.
test("a collapsed Announcements reads oldest first in the Thread and newest first on the Poster", async ({ browser, request }) => {
  test.slow();
  const host = await laidOut(browser, request, "sections-thread-collapsed", "Thread");
  await announce(host.page, "The gate code is 1234.");
  await announce(host.page, "Parking is on Mill Lane.");
  await collapse(host.page, "Announcements");
  const guest = await visitor(browser, host.link);
  const announcements = guest.locator('details[data-slot="announcements"]');
  await announcements.locator("summary").click();
  await expect(announcements.locator("li")).toHaveText([/The gate code is 1234\./, /Parking is on Mill Lane\./]);
  await chooseLayout(host.page, host.link, "Poster");
  await guest.reload();
  await expect(guest.locator("[data-layout]")).toHaveAttribute("data-layout", "poster");
  await expect(announcements.locator("li")).toHaveText([/Parking is on Mill Lane\./, /The gate code is 1234\./]);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("an arrangement made on Poster holds when the layout changes to Thread", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-poster-thread", PARTY);
  await arrange(host.page, (sheet) => sheet.getByRole("button", { name: "Move Album up" }).click());
  await chooseLayout(host.page, host.link, "Thread");
  // The host, to whom the comments are open: the stored arrangement draws them open, not folded
  // away as the Thread does by default, and the album comes before them.
  await host.page.goto(host.link);
  await expect(host.page.locator('[data-slot="thread-card"]')).toBeVisible();
  await expectOrder(host.page, ["details", "guests", "album", "comments"]);
  await expect(host.page.locator('details[data-slot="comments"]')).toHaveCount(0);
  await expect(host.page.getByLabel("Add a comment")).toBeVisible();
  await host.context.close();
});

test("Schedule off leaves the Broadsheet and the Thread too", async ({ browser, request }) => {
  test.slow();
  const host = await laidOut(browser, request, "sections-switch-layouts", "Broadsheet");
  await arrange(host.page, (sheet) => sheet.getByRole("switch", { name: "Schedule" }).click());
  for (const layout of ["Broadsheet", "Thread"] as const) {
    if (layout === "Thread") await chooseLayout(host.page, host.link, "Thread");
    const guest = await visitor(browser, host.link);
    await expect(guest.locator('[data-section="details"]').first()).toBeVisible();
    await expect(guest.locator('[data-section="schedule"]')).toHaveCount(0);
    // Not drawn, nor sent: the page holds nothing of it.
    expect(await (await request.get(host.link)).text()).not.toContain("Cake");
    await guest.context().close();
  }
  await host.context.close();
});

// M8 ticket 28: a row in Arrange opens to its heading and, where the section offers it, Collapsed;
// guests read the host's heading in every layout, and a collapsed section is a native disclosure
// showing its heading and how much it holds. The Countdown joins the sheet, and a placeholder in
// the editor opens Arrange at its own row.

// The open row of a section in Arrange, opened if it is not open yet.
async function openRow(sheet: Locator, name: string) {
  const options = sheet.getByRole("button", { name: `Options for ${name}` });
  if ((await options.getAttribute("aria-expanded")) !== "true") await options.click();
  await expect(options).toHaveAttribute("aria-expanded", "true");
}

// A section collapsed in Arrange, saved, and the sheet closed again.
async function collapse(page: Page, name: string) {
  await arrange(page, async (sheet) => {
    await openRow(sheet, name);
    const collapsed = sheet.getByRole("switch", { name: "Collapsed" });
    await collapsed.click();
    await expect(collapsed).toBeChecked();
  });
}

async function postComment(page: Page, text: string) {
  const box = page.getByLabel("Add a comment");
  await box.fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });
}

test("a renamed section reads the host's heading", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-rename", { ...EVENT, plusOnes: "0" });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await postComment(priya, "See you there!");

  const sheet = await openArrange(host.page);
  await openRow(sheet, "Comments");
  const heading = sheet.getByRole("textbox", { name: "Heading" });
  await expect(heading).toHaveAttribute("placeholder", "Comments");
  await expect(heading).toHaveAccessibleDescription("Leave it empty to keep “Comments”.");
  // Counted by character, as the server counts it: forty emoji fit and are saved, a forty-first
  // is not typed.
  await savedAfter(host.page, () => heading.fill("🎉".repeat(41)));
  await expect(heading).toHaveValue("🎉".repeat(40));
  await savedAfter(host.page, () => heading.fill("Guestbook"));
  // The row is named by the host's heading as it is typed.
  await expect(sheet.getByRole("switch", { name: "Guestbook" })).toBeChecked();
  await host.page.keyboard.press("Escape");
  // The editor's placeholder reads it too.
  await expect(section(host.page, "comments")).toContainText("Guestbook");

  for (const layout of ["Poster", "Broadsheet", "Thread"] as const) {
    if (layout !== "Poster") await chooseLayout(host.page, host.link, layout);
    await priya.reload();
    await expect(priya.locator("[data-layout]")).toHaveAttribute("data-layout", layout.toLowerCase());
    await expect(section(priya, "comments").getByRole("heading", { name: "Guestbook" })).toBeVisible();
  }
  // Once her comment has gone, with its Delete button, the focus is on the host's heading.
  await priya.getByRole("listitem").filter({ hasText: "See you there!" }).getByRole("button", { name: "Delete" }).click();
  await priya.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(priya.getByRole("heading", { name: "Guestbook" })).toBeFocused({ timeout: 15_000 });

  // Emptied, the default is back.
  const again = await openArrange(host.page);
  await openRow(again, "Guestbook");
  await savedAfter(host.page, () => again.getByRole("textbox", { name: "Heading" }).fill(""));
  await host.page.keyboard.press("Escape");
  await priya.reload();
  await expect(section(priya, "comments").getByRole("heading", { name: "Comments" })).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Ticket 28's review: a heading typed and the sheet closed before it is sent is sent as it closes.
test("a heading typed just before the sheet closes is saved", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-rename-close", EVENT);
  const sheet = await openArrange(host.page);
  await openRow(sheet, "Comments");
  await sheet.getByRole("textbox", { name: "Heading" }).fill("Guestbook");
  await host.page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  // The editor's placeholder reads it once it is saved, and so does a guest.
  await expect(section(host.page, "comments")).toContainText("Guestbook", { timeout: 15_000 });
  const guest = await visitor(browser, host.link);
  await expect(section(guest, "comments").getByRole("heading", { name: "Guestbook" })).toBeVisible();
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("a collapsed Album opens with one tap and stays open", async ({ browser, request }) => {
  test.slow();
  // An event that has started, so its album is open.
  const host = await createPublished(browser, request, "sections-collapse", { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const garden = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#2f6b3a" } }).jpeg().toBuffer();
  await section(priya, "album").getByLabel(/^Add photos/).setInputFiles([{ name: "garden.jpg", mimeType: "image/jpeg", buffer: garden }]);
  await expect(section(priya, "album").getByRole("status")).toContainText("garden.jpg: added", { timeout: 20_000 });

  await arrange(host.page, async (sheet) => {
    await openRow(sheet, "Album");
    const collapsed = sheet.getByRole("switch", { name: "Collapsed" });
    await expect(collapsed).toHaveAccessibleDescription("Guests see the heading and how much it holds, and open it with a tap.");
    await collapsed.click();
    await expect(collapsed).toBeChecked();
  });
  await priya.reload();
  const album = priya.locator('details[data-slot="album"][data-section="album"]');
  await expect(album).not.toHaveAttribute("open");
  const summary = album.locator("summary");
  await expect(summary.locator("h2")).toHaveText("Photos");
  await expect(summary.locator('[data-slot="section-count"]')).toHaveText("1 photo or video");
  await summary.focus();
  await priya.keyboard.press("Enter");
  await expect(album).toHaveAttribute("open", "");
  await expect(album.getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible();

  // Her comment refreshes the page, which leaves the album as she opened it.
  await postComment(priya, "What a day!");
  await expect(section(priya, "comments")).toContainText("What a day!");
  await expect(album).toHaveAttribute("open", "");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a section locked to the viewer is drawn open", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-locked", EVENT);
  await collapse(host.page, "Comments");
  // To the host, to whom they are open, the comments are folded away.
  await host.page.goto(host.link);
  await expect(host.page.locator('details[data-slot="comments"]')).not.toHaveAttribute("open");

  const guest = await visitor(browser, host.link);
  const comments = section(guest, "comments");
  await expect(comments).toContainText("No comments yet");
  await expect(comments).toContainText("Reply to join the conversation");
  await expect(guest.locator('details[data-slot="comments"]')).toHaveCount(0);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("Countdown", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-countdown", EVENT);
  const guest = await visitor(browser, host.link);
  // Off, as it starts: the countdown is under When.
  await expect(section(guest, "details")).toContainText("Starts in");
  await expect(section(guest, "countdown")).toHaveCount(0);

  await arrange(host.page, async (sheet) => {
    const countdown = sheet.getByRole("switch", { name: "Countdown" });
    await expect(countdown).not.toBeChecked();
    await expect(countdown).toHaveAccessibleDescription("On, the countdown leaves When and has a place of its own.");
    await countdown.click();
    await expect(countdown).toBeChecked();
    // It moved itself to just after the Details, which the live line says (ticket 28's review).
    await expect(liveLine(sheet)).toHaveText("Countdown, 3 of 8");
  });
  // The editor previews it, just after the details.
  await expect(host.page.getByRole("button", { name: "A countdown to the start, in each guest’s own time." })).toBeVisible();
  await guest.reload();
  await expectOrder(guest, ["details", "countdown", "guests", "comments", "album"]);
  await expect(section(guest, "countdown")).toContainText("days to go");
  await expect(section(guest, "details")).not.toContainText("Starts in");

  // The Broadsheet has no Countdown fact, and the section; the Thread has none under When.
  await chooseLayout(host.page, host.link, "Broadsheet");
  await guest.reload();
  await expect(guest.locator("main header dt")).toHaveText(["When", "Host"]);
  await expect(section(guest, "countdown")).toContainText("days to go");
  await chooseLayout(host.page, host.link, "Thread");
  await guest.reload();
  await expect(guest.locator('[data-slot="thread-card"]')).toBeVisible();
  await expect(section(guest, "countdown")).toContainText("days to go");
  await expect(section(guest, "details")).not.toContainText("Starts in");

  // A cancelled event has nothing to count to.
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
  await guest.reload();
  await expect(section(guest, "details").first()).toBeVisible();
  await expect(section(guest, "countdown")).toHaveCount(0);

  // Nor has a draft with no date yet, until it has one.
  await host.page.goto("/events/new");
  await expect(host.page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await arrange(host.page, (sheet) => sheet.getByRole("switch", { name: "Countdown" }).click());
  await expect(section(host.page, "details")).toBeVisible();
  await expect(section(host.page, "countdown")).toHaveCount(0);
  await setWhen(host.page, { start: "2027-05-08T19:00" });
  await expect(section(host.page, "countdown")).toBeVisible();
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("a placeholder opens its row", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-placeholder", EVENT);
  await host.page.getByRole("button", { name: "Photos and videos from the event, from its start." }).click();
  const sheet = host.page.getByRole("dialog", { name: "Arrange" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Options for Album" })).toHaveAttribute("aria-expanded", "true");
  await expect(sheet.getByRole("switch", { name: "Collapsed" })).toBeVisible();
  // Renamed from there, the placeholder shows the host's heading.
  await savedAfter(host.page, () => sheet.getByRole("textbox", { name: "Heading" }).fill("Our pictures"));
  await host.page.keyboard.press("Escape");
  await expect(section(host.page, "album")).toContainText("Our pictures");
  // Opened again from the toolbar, no row is open.
  await expect((await openArrange(host.page)).getByRole("button", { name: "Options for Our pictures" })).toHaveAttribute("aria-expanded", "false");
  await host.context.close();
});

test("the Arrange sheet with a row open has no serious accessibility problems", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-axe-row", EVENT);
  const sheet = await openArrange(host.page);
  await openRow(sheet, "Album");
  await expect(sheet.getByRole("textbox", { name: "Heading" })).toBeVisible();
  await expectNoSeriousViolations(host.page, "the Arrange sheet, the Album open");
  await host.context.close();
});

// From ticket 27's review: Who's coming collapsed says how many people are expected (Going and
// their plus-ones), the number the page gives elsewhere, not how many replied.
async function replies(browser: Browser, link: string, name: string, status: "Going" | "Maybe" | "Can’t go", plusOne = false) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  await page.getByRole("button", { name: status }).click();
  await page.getByLabel("Your name").fill(name);
  if (status !== "Can’t go") {
    await page.getByRole("button", { name: "Continue" }).click();
    if (plusOne) await page.getByRole("radio", { name: "+1" }).click();
  }
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(rsvpSheet(page).getByRole("heading", { name: { Going: "You’re going!", Maybe: "You’re a maybe.", "Can’t go": "We’ll miss you." }[status] })).toBeVisible({
    timeout: 15_000,
  });
  await closeReply(page);
  return page;
}

test("a collapsed Who's coming counts the people expected", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-guests-count", { ...EVENT, plusOnes: "1" });
  const priya = await replies(browser, host.link, "Priya Nair", "Going", true);
  await (await replies(browser, host.link, "Mei Lin", "Maybe")).context().close();
  await (await replies(browser, host.link, "Ravi Shah", "Can’t go")).context().close();
  await collapse(host.page, "Who’s coming");
  for (const layout of ["Poster", "Broadsheet", "Thread"] as const) {
    if (layout !== "Poster") await chooseLayout(host.page, host.link, layout);
    await priya.reload();
    await expect(priya.locator("[data-layout]")).toHaveAttribute("data-layout", layout.toLowerCase());
    await expect(priya.locator('details[data-slot="guests"] [data-slot="section-count"]')).toHaveText("2 expected");
  }
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Ticket 28's review: a list of only Maybes is still drawn, and its collapsed summary says nobody
// is expected yet.
test("a collapsed Who's coming with only a Maybe reads nobody yet", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-guests-maybe", { ...EVENT, plusOnes: "1" });
  const mei = await replies(browser, host.link, "Mei Lin", "Maybe");
  await collapse(host.page, "Who’s coming");
  await mei.reload();
  const guests = mei.locator('details[data-slot="guests"]');
  await expect(guests.locator('[data-slot="section-count"]')).toHaveText("nobody yet");
  await guests.locator("summary").click();
  await expect(guests).toContainText("Mei Lin");
  await Promise.all([host.context.close(), mei.context().close()]);
});

// M8 ticket 29: Add a section, at the foot of Arrange, adds a Note or Links, plain or headed by a
// suggestion, after the open row or at the end, and opens its own sheet. Guests see them in every
// layout; they belong to the page alone, and a duplicate keeps them.

// A Dress code Note and Links to a Registry, written from Arrange.
const NOTE = { words: "Cocktail attire, ", bold: "velvet welcome" };
const REGISTRY_URL = "https://www.example.com/registry";
async function noteAndLinks(page: Page) {
  await writeNote(page, await addSection(page, "Dress code"), NOTE.words, NOTE.bold);
  await page.keyboard.press("Escape");
  await writeLink(page, await addSection(page, "Registry"), 1, "Our list", REGISTRY_URL);
  await closeSheets(page);
}

const note = (page: Page) => page.locator('[data-slot="note"]');
const links = (page: Page) => page.locator('[data-slot="links"]');

test("a Dress code note", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-note", EVENT);
  // Added with Who's coming's row open, it lands after it.
  const sheet = await openArrange(host.page);
  await openRow(sheet, "Who’s coming");
  const dressCode = await addSection(host.page, "Dress code");
  await expect(dressCode.getByRole("heading", { name: "Dress code" })).toBeFocused();
  await writeNote(host.page, dressCode, "Cocktail attire, ", "sparkly");
  await closeSheets(host.page);

  // The editor draws it in full, after Who's coming, and it opens its sheet.
  const order = await sectionOrder(host.page);
  expect(order[order.indexOf("guests") + 1]).toMatch(/^note:[0-9a-z]{8}$/);
  await expect(note(host.page)).toContainText("Cocktail attire, sparkly");
  await host.page.getByRole("button", { name: "Edit Dress code" }).click();
  await expect(host.page.getByRole("dialog", { name: "Dress code" }).getByRole("textbox", { name: "Note" }).locator("strong")).toHaveText("sparkly");
  await host.page.keyboard.press("Escape");
  await expect(host.page.getByRole("dialog")).toHaveCount(0);

  const guest = await visitor(browser, host.link);
  for (const layout of ["Poster", "Broadsheet", "Thread"] as const) {
    if (layout !== "Poster") await chooseLayout(host.page, host.link, layout);
    await guest.reload();
    await expect(guest.locator("[data-layout]")).toHaveAttribute("data-layout", layout.toLowerCase());
    await expect(note(guest).getByRole("heading", { name: "Dress code" })).toBeVisible();
    await expect(note(guest).locator("strong")).toHaveText("sparkly");
    expect(await sectionOrder(guest)).toContain(order[order.indexOf("guests") + 1]);
  }
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("Links to a registry and a playlist", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-links", EVENT);
  const registry = await addSection(host.page, "Registry");
  await expect(registry.getByText("Each opens in a new tab. Up to 6.")).toBeVisible();
  await writeLink(host.page, registry, 1, "Our list", REGISTRY_URL);
  await writeLink(host.page, registry, 2, "Songs", "example.org/songs");

  const guest = await visitor(browser, host.link);
  const ours = links(guest).getByRole("link", { name: /^Our list/ });
  await expect(ours).toHaveAttribute("href", REGISTRY_URL);
  await expect(ours).toHaveAttribute("target", "_blank");
  for (const word of ["noopener", "noreferrer", "nofollow"]) await expect(ours).toHaveAttribute("rel", new RegExp(`\\b${word}\\b`));
  await expect(ours).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(ours).toContainText("example.com");
  await expect(ours).toHaveAccessibleName(/\(opens in a new tab\)$/);
  await expect(links(guest).getByRole("link", { name: /^Songs/ })).toHaveAttribute("href", "https://example.org/songs");

  // An address a guest may not be sent to is refused, and nothing is saved.
  await registry.getByRole("button", { name: "Add a link" }).click();
  await registry.getByRole("textbox", { name: "Label of link 3", exact: true }).fill("Bad");
  await registry.getByRole("textbox", { name: "Address of link 3", exact: true }).fill("javascript:alert(1)");
  await registry.getByRole("textbox", { name: "Address of link 3", exact: true }).blur();
  await expect(registry.getByRole("alert")).toHaveText("Links start with http:// or https://.");
  await guest.reload();
  await expect(links(guest).getByRole("link")).toHaveCount(2);
  await expect(links(guest)).not.toContainText("Bad");

  // Removed, and Songs moved up, both saved.
  await savedAfter(host.page, () => registry.getByRole("button", { name: "Remove Bad" }).click());
  await expect(registry.getByRole("alert")).toHaveCount(0);
  const up = registry.getByRole("button", { name: "Move Songs up" });
  await savedAfter(host.page, () => up.click());
  await expect(up).toBeFocused();
  await guest.reload();
  await expect(links(guest).getByRole("link")).toHaveText([/^Songs/, /^Our list/]);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("Notes and Links stay on the page", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-private", EVENT);
  await noteAndLinks(host.page);
  const guest = await visitor(browser, host.link);
  await expect(note(guest)).toContainText(NOTE.bold);
  await expect(links(guest).getByRole("link", { name: /^Our list/ })).toBeVisible();

  // Not in the page's metadata, nor its calendar file.
  const metadata = await guest.locator('meta[property^="og:"], meta[name^="twitter:"]').evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content") ?? ""));
  expect(metadata.length).toBeGreaterThan(0);
  const calendar = await (await request.get(`${host.link}/calendar.ics`)).text();
  expect(calendar).toContain("BEGIN:VCALENDAR");
  for (const text of [...metadata, calendar]) {
    expect(text).not.toContain(NOTE.bold);
    expect(text).not.toContain("example.com/registry");
  }

  // Nor on the locked page, once the host turns Invite-only on.
  const settings = await openSettings(host.page);
  await savedAfter(host.page, () =>
    settings.getByRole("group", { name: "Guests", exact: true }).getByLabel("Invite-only: only people on the invite list can open the invitation", { exact: true }).check(),
  );
  const locked = await (await request.get(host.link)).text();
  expect(locked).toContain("A private invitation");
  expect(locked).not.toContain(NOTE.bold);
  expect(locked).not.toContain("example.com/registry");
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("Remove a Note", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-remove", EVENT);
  await writeNote(host.page, await addSection(host.page, "Dress code"), NOTE.words, NOTE.bold);
  // Closing the Note's sheet goes back to Arrange, its row open.
  await host.page.keyboard.press("Escape");
  const sheet = arrangeSheet(host.page);
  await expect(sheet.getByRole("button", { name: "Options for Dress code" })).toHaveAttribute("aria-expanded", "true");
  await sheet.getByRole("button", { name: "Remove", exact: true }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Remove “Dress code”?" });
  await expect(confirm).toContainText("Guests will no longer see it, and what it says is deleted.");
  // Kept, nothing changes.
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(confirm).toBeHidden();
  await expect(sheet.getByRole("switch", { name: "Dress code" })).toBeVisible();
  await sheet.getByRole("button", { name: "Remove", exact: true }).click();
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Remove", exact: true }).click());
  await expect(sheet.getByRole("switch", { name: "Dress code" })).toHaveCount(0);
  await expect(sheet.getByRole("heading", { name: "Arrange" })).toBeFocused();
  await host.page.keyboard.press("Escape");
  await expect(note(host.page)).toHaveCount(0);
  const guest = await visitor(browser, host.link);
  await expect(guest.locator('[data-section="details"]')).toBeVisible();
  await expect(note(guest)).toHaveCount(0);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("a page holds ten notes and links at most", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "sections-ten", EVENT);
  const sheet = await openArrange(host.page);
  for (let added = 1; added <= 10; added++) {
    await addSection(host.page, "Note");
    // A Note added and left empty is in the editor, saying what to tap.
    await expect(host.page.locator('[data-section^="note:"]')).toHaveCount(added);
    await host.page.keyboard.press("Escape");
    await expect(sheet.getByRole("switch", { name: "Note" })).toHaveCount(added);
  }
  await expect(sheet.getByRole("region", { name: "Add a section" })).toContainText("A page holds up to 10 notes and links.");
  await expect(sheet.getByRole("button", { name: "Note", exact: true })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Links", exact: true })).toHaveCount(0);
  await host.page.keyboard.press("Escape");
  await expect(note(host.page).first()).toContainText("Nothing written yet. Tap to write.");
  // Empty, a guest has none of them.
  const guest = await visitor(browser, host.link);
  await expect(guest.locator('[data-section="details"]')).toBeVisible();
  await expect(note(guest)).toHaveCount(0);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("a duplicate keeps its Notes and Links", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-duplicate", EVENT);
  await noteAndLinks(host.page);
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Duplicate" }).click();
  await expect(host.page).toHaveURL(/\/events\/[0-9a-f-]{36}\?from=[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(note(host.page).locator("strong")).toHaveText(NOTE.bold);
  await expect(links(host.page)).toContainText("Our list");
  await expect(links(host.page)).toContainText("example.com");
  await host.context.close();
});

// The plan's review focus: a Note and Links show where the Countdown and the Album do not.
test("Notes and Links where nobody else looks", async ({ browser, request }) => {
  test.setTimeout(240_000);
  // On an undated draft, the host's preview: no Countdown and no Album, which need a date.
  const host = await createPublished(browser, request, "sections-elsewhere", EVENT);
  const published = host.page.url();
  await host.page.goto("/events/new");
  await expect(host.page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await arrange(host.page, (sheet) => sheet.getByRole("switch", { name: "Countdown" }).click());
  await noteAndLinks(host.page);
  await expect(note(host.page)).toContainText(NOTE.bold);
  await expect(links(host.page)).toContainText("Our list");
  await expect(section(host.page, "countdown")).toHaveCount(0);
  await expect(section(host.page, "album")).toHaveCount(0);

  // On a cancelled event, a guest: the Note and the Links, and no Countdown.
  await host.page.goto(published);
  await arrange(host.page, (sheet) => sheet.getByRole("switch", { name: "Countdown" }).click());
  await noteAndLinks(host.page);
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
  const guest = await visitor(browser, host.link);
  await expect(note(guest)).toContainText(NOTE.bold);
  await expect(links(guest).getByRole("link", { name: /^Our list/ })).toBeVisible();
  await expect(section(guest, "countdown")).toHaveCount(0);
  await Promise.all([host.context.close(), guest.context().close()]);
});

test("the Note sheet has no serious accessibility problems", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-axe-note", EVENT);
  await writeNote(host.page, await addSection(host.page, "Dress code"), NOTE.words, NOTE.bold);
  await expectNoSeriousViolations(host.page, "the Note sheet");
  await host.context.close();
});

test("the Links sheet with three rows has no serious accessibility problems", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-axe-links", EVENT);
  const registry = await addSection(host.page, "Registry");
  await writeLink(host.page, registry, 1, "Our list", REGISTRY_URL);
  await writeLink(host.page, registry, 2, "Songs", "example.org/songs");
  await registry.getByRole("button", { name: "Add a link" }).click();
  await expect(registry.getByRole("listitem")).toHaveCount(3);
  await expectNoSeriousViolations(host.page, "the Links sheet, three rows");
  await host.context.close();
});

// M8 ticket 30: a row in Arrange that offers styles opens to them as swatches. The Album is a grid
// (as it always was), a mosaic or a strip; the Comments a list or chat bubbles; Who's coming names
// (each layout's own) or avatars. Every style keeps what an album item carries, and the editor's
// placeholders show the style chosen.

const STARTED = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
// Ticket 08's motion photo, whose motion waits its turn in the queue behind every video the other
// specs keep sending (album-live.spec.ts).
const MOTION_PHOTO = "e2e/fixtures/motion-photo.jpg";
const MOTION_MS = 150_000;

const jpeg = async (name: string, background: string) => ({
  name,
  mimeType: "image/jpeg",
  buffer: await sharp({ create: { width: 1200, height: 900, channels: 3, background } }).jpeg().toBuffer(),
});

const tilesOf = (page: Page) => section(page, "album").locator("li[data-item]");

// Items added in one ask (the test profile takes three a minute per address), until the album
// shows `count` of them.
async function addPhotos(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[], count: number) {
  await section(page, "album").getByLabel(/^Add photos/).setInputFiles(files);
  await expect(tilesOf(page)).toHaveCount(count, { timeout: 20_000 });
}

// A style chosen in a row's open row in Arrange, which is open, and saved.
async function pickStyle(page: Page, sheet: Locator, row: string, style: string) {
  await openRow(sheet, row);
  const swatch = sheet.getByRole("radiogroup", { name: "Style" }).getByRole("radio", { name: style, exact: true });
  await savedAfter(page, () => swatch.click());
  await expect(swatch).toHaveAttribute("aria-checked", "true");
}

// The same, from the editor's toolbar, the sheet closed again.
async function chooseStyle(page: Page, row: string, style: string) {
  const sheet = await openArrange(page);
  await pickStyle(page, sheet, row, style);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
}

// Each tile still carries what its item does: the Live mark on the live photo, the caption on the
// captioned one, and the third opens the viewer on its own picture.
async function expectTilesCarry(page: Page) {
  const tiles = tilesOf(page);
  await expect(tiles).toHaveCount(3);
  await expect(tiles.locator('[data-slot="live-mark"]')).toHaveText("Live");
  await expect(tiles.locator('[data-slot="caption"]')).toHaveText("Sunset over the lake");
  const third = tiles.nth(2).locator('button[id^="album-item-"]');
  const name = (await third.locator("img").getAttribute("alt"))!;
  await third.click();
  const viewer = page.getByRole("dialog", { name: "Photo 3 of 3" });
  await expect(viewer.getByRole("img", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
}

test("the album as a mosaic and a strip", async ({ browser, request }) => {
  test.setTimeout(MOTION_MS + 180_000);
  const host = await createPublished(browser, request, "sections-album-styles", STARTED);
  const mei = await guestGoing(browser, host.link, "Mei Nakamura");
  await addPhotos(mei, [await jpeg("lake.jpg", "#d07a3a"), { name: "motion-photo.jpg", mimeType: "image/jpeg", buffer: readFileSync(MOTION_PHOTO) }, await jpeg("garden.jpg", "#2f6b3a")], 3);
  // A caption given in the viewer, through Add a caption (ticket 09).
  await tilesOf(mei).nth(1).locator('button[id^="album-item-"]').click();
  const viewer = mei.getByRole("dialog", { name: "Photo 2 of 3" });
  await viewer.getByRole("button", { name: "Add a caption" }).click();
  await viewer.getByLabel("Caption", { exact: true }).fill("Sunset over the lake");
  await viewer.getByRole("button", { name: "Save" }).click();
  await expect(viewer.locator('[data-slot="caption"]')).toHaveText("Sunset over the lake");
  await mei.keyboard.press("Escape");
  await expect(tilesOf(mei).locator('[data-slot="live-mark"]')).toHaveText("Live", { timeout: MOTION_MS });

  // A grid, as it always was, draws no caption under its tiles (ticket 09).
  await expect(section(mei, "album").locator('ul[data-style="grid"]')).toBeVisible();
  await expect(tilesOf(mei).locator('[data-slot="caption"]')).toHaveCount(0);

  // A mosaic: the first item two columns wide.
  await chooseStyle(host.page, "Album", "Mosaic");
  await mei.reload();
  await expect(section(mei, "album").locator('ul[data-style="mosaic"]')).toBeVisible();
  const [first, second] = [await tilesOf(mei).nth(0).boundingBox(), await tilesOf(mei).nth(1).boundingBox()];
  expect(first!.width / second!.width).toBeGreaterThan(1.9);
  expect(first!.width / second!.width).toBeLessThan(2.2);
  await expectTilesCarry(mei);

  // A strip: one row, a region of its own that Tab reaches and ArrowRight scrolls.
  await chooseStyle(host.page, "Album", "Strip");
  await mei.reload();
  const strip = section(mei, "album").getByRole("region", { name: "Photos and videos, scrolling sideways" });
  await expect(strip.locator('ul[data-style="strip"]')).toBeVisible();
  const tops = await tilesOf(mei).evaluateAll((tiles) => tiles.map((tile) => Math.round(tile.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await tabTo(mei, strip);
  expect(await strip.evaluate((region) => region.scrollLeft)).toBe(0);
  await mei.keyboard.press("ArrowRight");
  await expect.poll(() => strip.evaluate((region) => region.scrollLeft)).toBeGreaterThan(0);
  await expectTilesCarry(mei);
  await Promise.all([host.context.close(), mei.context().close()]);
});

test("the vote control in every style", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-album-vote", STARTED);
  const block = (await openSettings(host.page)).locator('[data-slot="voting-block"]');
  await savedAfter(host.page, () => block.getByRole("button", { name: "Start voting", exact: true }).click());
  await expect(block).toHaveAttribute("data-state", "open");
  await host.page.keyboard.press("Escape");
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await jpeg("lake.jpg", "#d07a3a"), await jpeg("garden.jpg", "#2f6b3a")], 2);
  const mei = await guestGoing(browser, host.link, "Mei Nakamura");

  for (const style of ["Grid", "Mosaic", "Strip"] as const) {
    if (style !== "Grid") await chooseStyle(host.page, "Album", style);
    await mei.reload();
    await expect(section(mei, "album").locator(`ul[data-style="${style.toLowerCase()}"]`)).toBeVisible();
    for (const tile of await tilesOf(mei).all()) await expect(tile.locator('[data-slot="vote-star"]')).toHaveCount(1);
  }
  // Pressed in the strip, it gives the vote, which a fresh page still shows.
  const star = tilesOf(mei).first().locator('[data-slot="vote-star"]');
  const answered = mei.waitForResponse((response) => response.request().method() === "POST" && response.request().headers()["next-action"] !== undefined);
  await star.click();
  await answered;
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await mei.reload();
  await expect(tilesOf(mei).first().locator('[data-slot="vote-star"]')).toHaveAttribute("aria-pressed", "true");
  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

test("comments as bubbles", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-bubbles", { ...EVENT, plusOnes: "0" });
  const editor = host.page.url();
  await chooseStyle(host.page, "Comments", "Bubbles");
  await host.page.goto(host.link);
  await postComment(host.page, "Welcome, all!");
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await postComment(priya, "See you there!");

  const list = section(priya, "comments").locator('ol[data-style="bubbles"]');
  await expect(list.getByRole("listitem")).toHaveCount(2);
  const bubbleOf = (text: string) => list.getByRole("listitem").filter({ hasText: text }).locator('[data-slot="comment-bubble"]');
  const hosts = (await bubbleOf("Welcome, all!").boundingBox())!;
  const guests = (await bubbleOf("See you there!").boundingBox())!;
  expect(hosts.x).toBeGreaterThan(guests.x);
  expect(hosts.x + hosts.width).toBeGreaterThan(guests.x + guests.width);

  // A reaction still toggles.
  const mine = list.getByRole("listitem").filter({ hasText: "Welcome, all!" });
  await mine.getByRole("button", { name: "Add a reaction" }).click();
  await priya.getByRole("group", { name: "React with" }).getByRole("button", { name: "Party" }).click();
  const party = mine.getByRole("button", { name: /^Party, / });
  await expect(party).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await party.click();
  await expect(mine.getByRole("button", { name: /^Party, / })).toHaveCount(0, { timeout: 15_000 });

  // Delete still asks first.
  await list.getByRole("listitem").filter({ hasText: "See you there!" }).getByRole("button", { name: "Delete" }).click();
  const confirm = priya.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Never mind" }).click();
  await expect(bubbleOf("See you there!")).toBeVisible();
  await host.page.goto(editor);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("Who's coming as avatars", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-avatars", { ...EVENT, plusOnes: "0" });
  const mei = await guestGoing(browser, host.link, "Mei Nakamura");
  await chooseStyle(host.page, "Who’s coming", "Avatars");
  // A visitor under "Guests who have replied" sees the locked pile, as before, and no name.
  const stranger = await visitor(browser, host.link);
  await expect(section(stranger, "guests")).toContainText("RSVP to see who’s coming");
  await expect(section(stranger, "guests").locator('[data-style="avatars"]')).toHaveCount(0);
  expect(await stranger.content()).not.toContain("Nakamura");

  for (const layout of ["Poster", "Broadsheet", "Thread"] as const) {
    if (layout !== "Poster") await chooseLayout(host.page, host.link, layout);
    await mei.reload();
    await expect(mei.locator("[data-layout]")).toHaveAttribute("data-layout", layout.toLowerCase());
    const avatars = mei.locator('[data-section="guests"] [data-style="avatars"]');
    await expect(avatars.locator('[data-slot="avatar"]')).toHaveText("MN");
    await expect(avatars.getByText("Mei", { exact: true })).toBeVisible();
    await expect(avatars).toContainText("Going");
  }
  await Promise.all([host.context.close(), mei.context().close(), stranger.context().close()]);
});

test("the open row's swatches, and the placeholder that shows the style", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-swatches", EVENT);
  const sheet = await openArrange(host.page);
  await openRow(sheet, "Album");
  const styles = sheet.getByRole("radiogroup", { name: "Style" });
  await expect(styles.getByRole("radio")).toHaveText(["Grid", "Mosaic", "Strip"]);
  await expect(styles.getByRole("radio", { name: "Grid" })).toHaveAttribute("aria-checked", "true");
  await expectNoSeriousViolations(host.page, "the Arrange sheet, the Album's styles");
  await pickStyle(host.page, sheet, "Album", "Strip");
  await host.page.keyboard.press("Escape");
  const preview = section(host.page, "album").locator('[data-slot="style-preview"]');
  await expect(preview).toHaveText("Strip");
  await expect(preview.locator('svg[data-glyph="strip"]')).toBeVisible();
  // The other placeholders show theirs, unchanged.
  await expect(section(host.page, "comments").locator('[data-slot="style-preview"]')).toHaveText("List");
  await host.context.close();
});

// A started event whose album holds two photos, with a comment by the host and one by a guest,
// drawn in a mosaic, bubbles and avatars, in a layout; Mei, the guest, is going. She replies on the
// Poster, and the layout is chosen after.
async function everyStyle(browser: Browser, request: APIRequestContext, label: string, layout: "Poster" | "Broadsheet" | "Thread") {
  const host = await createPublished(browser, request, label, STARTED);
  const editor = host.page.url();
  const mei = await guestGoing(browser, host.link, "Mei Nakamura");
  await addPhotos(mei, [await jpeg("lake.jpg", "#d07a3a"), await jpeg("garden.jpg", "#2f6b3a")], 2);
  await postComment(mei, "See you there!");
  await host.page.goto(host.link);
  await postComment(host.page, "Welcome, all!");
  await host.page.goto(editor);
  const sheet = await openArrange(host.page);
  await pickStyle(host.page, sheet, "Album", "Mosaic");
  await pickStyle(host.page, sheet, "Comments", "Bubbles");
  await pickStyle(host.page, sheet, "Who’s coming", "Avatars");
  await host.page.keyboard.press("Escape");
  if (layout !== "Poster") await chooseLayout(host.page, host.link, layout);
  return { host, mei };
}

// The Thread folds its comments away; they are opened to be read.
async function shown(page: Page) {
  await page.reload();
  const folded = page.locator('details[data-slot="comments"]:not([open]) summary');
  if (await folded.count()) await folded.click();
  await expect(page.locator('ol[data-style="bubbles"]')).toBeVisible();
}

for (const layout of ["Poster", "Broadsheet", "Thread"] as const) {
  test(`every style in the ${layout} has no serious accessibility problems`, async ({ browser, request }) => {
    test.setTimeout(180_000);
    const { host, mei } = await everyStyle(browser, request, `sections-axe-styles-${layout.toLowerCase()}`, layout);
    await shown(mei);
    await expect(mei.locator("[data-layout]")).toHaveAttribute("data-layout", layout.toLowerCase());
    await expect(mei.locator('ul[data-style="mosaic"]')).toBeVisible();
    await expect(mei.locator('[data-style="avatars"]')).toBeVisible();
    await expectNoSeriousViolations(mei, `the ${layout}: a mosaic, bubbles and avatars`);
    await chooseStyle(host.page, "Album", "Strip");
    await shown(mei);
    await expect(mei.locator('ul[data-style="strip"]')).toBeVisible();
    await expectNoSeriousViolations(mei, `the ${layout}: a strip`);
    await Promise.all([host.context.close(), mei.context().close()]);
  });
}

// From ticket 29's review: a section just added waits for the server's key before anything else
// is sent about it. Its add is held back by hand; meanwhile its Move up and its switch do nothing.
test("a section just added waits for its add", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sections-pending", EVENT);
  const page = host.page;
  const path = new URL(page.url()).pathname;
  let held = false;
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (route.request().method() === "POST" && route.request().postData()?.includes('"addNote"')) {
        held = true;
        await released;
      }
      await route.continue();
    },
  );
  const sheet = await openArrange(page);
  await sheet.getByRole("button", { name: "Dress code", exact: true }).click();
  await expect.poll(() => held).toBe(true);
  const up = sheet.getByRole("button", { name: "Move Dress code up" });
  await expect(up).toHaveAttribute("aria-disabled", "true");
  await up.focus();
  await page.keyboard.press("Enter");
  const on = sheet.getByRole("switch", { name: "Dress code" });
  await expect(on).toHaveAttribute("aria-disabled", "true");
  await on.focus();
  await page.keyboard.press("Space");
  await expect(on).toBeChecked();
  expect((await rowNames(sheet)).at(-1)).toBe("Dress code");

  release();
  await expect(page.getByRole("dialog", { name: "Dress code" })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("alert")).toHaveCount(0);
  await expect(saveStatus(page)).toHaveAttribute("data-status", "saved");
  expect((await rowNames(sheet)).at(-1)).toBe("Dress code");
  await expect(sheet.getByRole("button", { name: "Move Dress code up" })).not.toHaveAttribute("aria-disabled", "true");
  await expect(sheet.getByRole("switch", { name: "Dress code" })).toBeChecked();
  await host.context.close();
});

// From ticket 29's review: a link's address is sent once its field is left, never half-typed on a
// pause; its label is counted by character, as a heading is.
test("a link's address is sent once its field is left", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "sections-link-address", EVENT);
  const registry = await addSection(host.page, "Registry");
  await registry.getByRole("button", { name: "Add a link" }).click();
  const label = registry.getByRole("textbox", { name: "Label of link 1", exact: true });
  await label.fill("🎉".repeat(41));
  await expect(label).toHaveValue("🎉".repeat(40));
  await label.fill("");
  await writeLink(host.page, registry, 2, "Songs", "example.org/songs");
  await registry.getByRole("button", { name: "Remove Label of link 1" }).click();
  await expect(registry.getByRole("listitem")).toHaveCount(1);

  // Its address half-typed while the label changes: the label is saved, the address is not.
  const address = registry.getByRole("textbox", { name: "Address of link 1", exact: true });
  await savedAfter(host.page, async () => {
    await label.fill("Our songs");
    await address.fill("ht");
  });
  await expect(address).toBeFocused();
  await expect(registry.getByRole("alert")).toHaveCount(0);
  const guest = await visitor(browser, host.link);
  await expect(links(guest).getByRole("link", { name: /^Our songs/ })).toHaveAttribute("href", "https://example.org/songs");
  await expect(links(guest).locator('a[href^="https://ht"]')).toHaveCount(0);

  // Finished and left with Tab, it is.
  await address.fill("https://example.org/playlist");
  await savedAfter(host.page, () => address.press("Tab"));
  await guest.reload();
  await expect(links(guest).getByRole("link", { name: /^Our songs/ })).toHaveAttribute("href", "https://example.org/playlist");
  await Promise.all([host.context.close(), guest.context().close()]);
});
