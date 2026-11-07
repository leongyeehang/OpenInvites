import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { chooseLayout, createPublished, editSettings } from "./events";
import { latestMailTo, MAILPIT, mailCountTo } from "./hosts";
import { closeReply } from "./reply";
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "./test";

// M6 ticket 03: the host chooses who sees the album (every guest who replied, only those Going, or
// only the hosts), and may approve guests' photos before anyone else sees them. Adding stays the
// rule it was: the hosts, and every guest whose reply is approved. M6 ticket 04: the hosts are
// emailed when a guest's photos wait for them, read in Mailpit.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const VISIBILITY = "Who can see the album";
const APPROVE_PHOTOS = "Approve photos before they’re shown";
const NOTIFY_PHOTOS = "Email the hosts when photos need approval";

async function photo(name: string, colour: string) {
  return { name, mimeType: "image/jpeg", buffer: await sharp({ create: { width: 1600, height: 1200, channels: 3, background: colour } }).jpeg().toBuffer() };
}

// A guest of their own who answers and comes back to the page.
async function guest(browser: Browser, link: string, name: string, status: "Going" | "Maybe" = "Going"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  await page.getByRole("button", { name: status }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(status === "Going" ? "You’re going!" : "You’re a maybe.")).toBeVisible({ timeout: 15_000 });
  await closeReply(page);
  return page;
}

async function subjectOfLatestMailTo(request: APIRequestContext, email: string): Promise<string | undefined> {
  const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  const { messages } = (await search.json()) as { messages: { Subject: string }[] };
  return messages[0]?.Subject;
}

const album = (page: Page) => page.locator('[data-slot="album"]');
const albumGroup = (sheet: Locator) => sheet.getByRole("group", { name: "Album", exact: true });

// At a phone's width, the host's Approve and Delete under each waiting thumbnail lie inside the
// thumbnail's column, side by side, not over each other.
async function expectControlsInTheirCells(page: Page) {
  if (test.info().project.name !== "mobile") return;
  const cells = album(page).getByRole("listitem").filter({ has: page.getByRole("button", { name: "Approve" }) });
  for (const cell of await cells.all()) {
    const [box, approve, remove] = await Promise.all([
      cell.boundingBox(),
      cell.getByRole("button", { name: "Approve" }).boundingBox(),
      cell.getByRole("button", { name: "Delete" }).boundingBox(),
    ]);
    for (const control of [approve!, remove!]) {
      expect(control.x).toBeGreaterThanOrEqual(box!.x);
      expect(control.x + control.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
    }
    expect(approve!.x + approve!.width).toBeLessThanOrEqual(remove!.x);
  }
}

test("only guests who are going: a Going guest's photo is hidden from a Maybe guest until the host opens the album to everyone who replied", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-going", PAST);
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(VISIBILITY).selectOption({ label: "Guests who are going" });
  });

  const priya = await guest(browser, host.link, "Priya Nair");
  await album(priya).getByLabel("Add photos").setInputFiles([await photo("garden.jpg", "#2f6b3a")]);
  await expect(album(priya).getByRole("status")).toHaveText("garden.jpg: added", { timeout: 20_000 });
  await expect(album(priya).getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible({ timeout: 15_000 });
  await expect(album(priya).getByRole("heading", { name: "Your photos" })).toHaveCount(0);

  // A Maybe guest may add, but sees only their own, and why.
  const mei = await guest(browser, host.link, "Mei Tan", "Maybe");
  await expect(album(mei).getByRole("heading", { name: "Your photos" })).toBeVisible();
  await expect(album(mei)).toContainText("The album is for guests who are going; the hosts see what you add.");
  await expect(album(mei).getByRole("button", { name: /^Photo \d by Priya Nair/ })).toHaveCount(0);
  await expect(album(mei).getByLabel("Add photos")).toBeAttached();

  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(VISIBILITY).selectOption({ label: "Guests who have replied" });
  });
  await mei.reload();
  await expect(album(mei).getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible();
  await expect(album(mei).getByRole("heading", { name: "Your photos" })).toHaveCount(0);

  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

test("only the hosts: a guest sees only their own, a visitor how many and why, and the host every photo", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-hosts", PAST);
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(VISIBILITY).selectOption({ label: "Only the hosts" });
  });

  const priya = await guest(browser, host.link, "Priya Nair");
  await expect(album(priya).getByRole("heading", { name: "Your photos" })).toBeVisible();
  await expect(album(priya)).toContainText("The hosts keep this album; they see what you add.");
  await album(priya).getByLabel("Add photos").setInputFiles([await photo("garden.jpg", "#2f6b3a")]);
  await expect(album(priya).getByRole("status")).toHaveText("garden.jpg: added", { timeout: 20_000 });
  await expect(album(priya).getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible({ timeout: 15_000 });

  // Another guest sees their own, which is none of Priya's.
  const mei = await guest(browser, host.link, "Mei Tan");
  await expect(album(mei).getByRole("heading", { name: "Your photos" })).toBeVisible();
  await expect(album(mei)).toContainText("No photos yet. Add the first.");
  await expect(album(mei).getByRole("img")).toHaveCount(0);

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(host.link);
  await expect(album(visitor)).toContainText("1 photo");
  await expect(album(visitor)).toContainText("The hosts keep this album. Reply to add your photos.");
  await expect(album(visitor).getByRole("img")).toHaveCount(0);

  await host.page.goto(host.link);
  await expect(album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible();
  await expect(album(host.page).getByRole("heading", { name: "Your photos" })).toHaveCount(0);

  await Promise.all([host.context.close(), priya.context().close(), mei.context().close(), visitor.context().close()]);
});

test("with approval on, a guest's photos wait for the host, who approves one in the viewer and removes another; turning approval off shows the rest", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "album-approval", PAST);
  const editor = host.page.url();
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel(APPROVE_PHOTOS).check());

  // Priya's two photos wait, and she sees them marked.
  const priya = await guest(browser, host.link, "Priya Nair");
  await album(priya).getByLabel("Add photos").setInputFiles([await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")]);
  await expect(album(priya).getByRole("status")).toContainText("garden.jpg: added, awaiting approval", { timeout: 20_000 });
  await expect(album(priya).getByRole("status")).toContainText("cake.jpg: added, awaiting approval");
  await expect(album(priya).getByRole("button", { name: /^Photo \d by Priya Nair, awaiting approval$/ })).toHaveCount(2, { timeout: 15_000 });
  await expect(album(priya).getByText("Awaiting approval", { exact: true })).toHaveCount(2);
  await expect(album(priya).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expectNoSeriousViolations(priya, "the album with photos awaiting approval");

  // Mei sees none of them yet.
  const mei = await guest(browser, host.link, "Mei Tan");
  await expect(album(mei)).toContainText("No photos yet. Add the first.");

  // The host sees both marked, with Approve and Delete under each, and approves the first in the
  // viewer, which stays on it.
  await host.page.goto(host.link);
  await expect(album(host.page).getByRole("button", { name: /^Photo \d by Priya Nair, awaiting approval$/ })).toHaveCount(2);
  await expect(album(host.page).getByRole("button", { name: "Approve" })).toHaveCount(2);
  await expect(album(host.page).getByRole("button", { name: "Delete" })).toHaveCount(2);
  await expectControlsInTheirCells(host.page);
  const second = await album(host.page).getByRole("button", { name: "Photo 2 by Priya Nair, awaiting approval" }).locator("img").getAttribute("src");
  await album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair, awaiting approval" }).click();
  const viewer = host.page.getByRole("dialog", { name: "Photo 1 of 2" });
  await expect(viewer).toContainText("Added by Priya Nair · Awaiting approval");
  await expectNoSeriousViolations(host.page, "the photo viewer with Approve");
  await viewer.getByRole("button", { name: "Approve" }).click();
  await expect(viewer.getByRole("button", { name: "Approve" })).toHaveCount(0, { timeout: 15_000 });
  await expect(viewer).toContainText("Added by Priya Nair");
  await expect(viewer).not.toContainText("Awaiting approval");
  await expect(viewer.getByRole("img", { name: "Photo 1 by Priya Nair" })).toBeVisible();
  await host.page.keyboard.press("Escape");
  await expect(album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeFocused();

  await mei.reload();
  await expect(album(mei).getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible();
  await expect(album(mei).getByRole("img")).toHaveCount(1);

  // The host removes the second from under its thumbnail, after the confirmation; its file goes.
  await album(host.page).getByRole("button", { name: "Delete" }).click();
  await host.page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(album(host.page).getByRole("img")).toHaveCount(1, { timeout: 15_000 });
  await expect(host.page.getByRole("heading", { name: "Photos" })).toBeFocused();
  expect((await request.get(second!)).status()).toBe(404);

  // Two more wait; turning approval off shows them both.
  await priya.reload();
  await album(priya).getByLabel("Add photos").setInputFiles([await photo("toast.jpg", "#e0b040"), await photo("lanterns.jpg", "#3050a0")]);
  await expect(album(priya).getByRole("status")).toContainText("lanterns.jpg: added, awaiting approval", { timeout: 20_000 });
  await mei.reload();
  await expect(album(mei).getByRole("img")).toHaveCount(1);
  await host.page.goto(editor);
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel(APPROVE_PHOTOS).uncheck());
  await mei.reload();
  await expect(album(mei).getByRole("button", { name: /^Photo \d by Priya Nair$/ })).toHaveCount(3);
  await priya.reload();
  await expect(album(priya).getByText("Awaiting approval", { exact: true })).toHaveCount(0);

  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

test("with approval on, the hosts are emailed once about a guest's photos waiting, not about their own, and not with the email turned off", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "album-notify", PAST);
  const editor = host.page.url();
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel(APPROVE_PHOTOS).check());

  // Priya's two photos wait, and the host is told of them in one email: who, how many, and the
  // event link, after the verification from signing up and the email about Priya's reply.
  const priya = await guest(browser, host.link, "Priya Nair");
  await album(priya).getByLabel("Add photos").setInputFiles([await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")]);
  await expect(album(priya).getByRole("status")).toContainText("cake.jpg: added, awaiting approval", { timeout: 20_000 });
  await expect
    .poll(() => subjectOfLatestMailTo(request, host.email), { timeout: 30_000, message: `an email to ${host.email} about Priya’s photos` })
    .toBe("Priya Nair added 2 photos to Ada’s garden party for your approval");
  expect(await mailCountTo(request, host.email)).toBe(3);
  const [said, where, footer, ...rest] = (await latestMailTo(request, host.email, 2)).replace(/\r\n/g, "\n").trimEnd().split("\n\n");
  expect(said).toBe("Priya Nair added 2 photos to Ada’s garden party for your approval.");
  expect(where).toBe(`The event page:\n${host.link}`);
  expect(footer).toBe("To stop these emails, untick “Email the hosts when photos need approval” in the event’s settings. That stops them for every host of the event.");
  expect(rest).toEqual([]);

  // The host's own photo is approved at once, and tells nobody.
  await host.page.goto(host.link);
  await album(host.page).getByLabel("Add photos").setInputFiles([await photo("toast.jpg", "#e0b040")]);
  await expect(album(host.page).getByRole("status")).toHaveText("toast.jpg: added", { timeout: 20_000 });

  // With the email turned off, Priya's next photo waits without one.
  await host.page.goto(editor);
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel(NOTIFY_PHOTOS).uncheck());
  await priya.reload();
  await album(priya).getByLabel("Add photos").setInputFiles([await photo("lanterns.jpg", "#3050a0")]);
  await expect(album(priya).getByRole("status")).toHaveText("lanterns.jpg: added, awaiting approval", { timeout: 20_000 });

  // Mail goes out in the order it was queued, so once the email about Mei's reply is in, an email
  // about either upload would be in before it.
  const mei = await guest(browser, host.link, "Mei Tan");
  await expect
    .poll(() => subjectOfLatestMailTo(request, host.email), { timeout: 30_000, message: `an email to ${host.email} about Mei’s reply` })
    .toBe("Mei Tan replied to Ada’s garden party: Going");
  expect(await mailCountTo(request, host.email)).toBe(4);

  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

// The Thread's column is the narrowest, the Broadsheet's set apart; the Poster's is above. The
// reply and the photos are added on the Poster, whose reply the guest helper knows; the host then
// changes the layout, and the album is read in it.
for (const layout of ["Thread", "Broadsheet"] as const) {
  test(`with approval on in the ${layout}, a visitor's count leaves out a photo waiting, the host's own needs none, and the host's controls fit`, async ({
    browser,
    request,
  }) => {
    test.slow();
    const host = await createPublished(browser, request, `album-approval-${layout.toLowerCase()}`, PAST);
    const editor = host.page.url();
    await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel(APPROVE_PHOTOS).check());

    const priya = await guest(browser, host.link, "Priya Nair");
    await album(priya).getByLabel("Add photos").setInputFiles([await photo("garden.jpg", "#2f6b3a")]);
    await expect(album(priya).getByRole("status")).toHaveText("garden.jpg: added, awaiting approval", { timeout: 20_000 });

    // The host's own photo is approved at once.
    await host.page.goto(host.link);
    await album(host.page).getByLabel("Add photos").setInputFiles([await photo("toast.jpg", "#e0b040")]);
    await expect(album(host.page).getByRole("status")).toHaveText("toast.jpg: added", { timeout: 20_000 });
    await expect(album(host.page).getByRole("button", { name: `Photo 2 by ${host.name}` })).toBeVisible({ timeout: 15_000 });

    await host.page.goto(editor);
    await chooseLayout(host.page, host.link, layout);
    await host.page.goto(host.link);
    await expect(album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair, awaiting approval" })).toBeVisible();
    await expect(album(host.page).getByRole("button", { name: "Approve" })).toHaveCount(1);
    await expectControlsInTheirCells(host.page);

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(host.link);
    await expect(album(visitor)).toContainText("1 photo");
    await expect(album(visitor)).not.toContainText("2 photos");

    await Promise.all([host.context.close(), priya.context().close(), visitor.context().close()]);
  });
}

test("the album's own view in Traditional Chinese", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-hosts-zh", PAST);
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(VISIBILITY).selectOption({ label: "Only the hosts" });
  });
  const priya = await guest(browser, host.link, "Priya Nair");
  await priya.getByRole("contentinfo").getByRole("form", { name: "Language" }).getByRole("button", { name: "繁體中文" }).click();
  await expect(priya.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(album(priya).getByRole("heading", { name: "你的照片" })).toBeVisible();
  await expect(album(priya)).toContainText("這個相簿由主辦人保管；他們看得到你新增的照片。");
  await Promise.all([host.context.close(), priya.context().close()]);
});
