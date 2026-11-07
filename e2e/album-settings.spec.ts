import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings } from "./events";
import { closeReply } from "./reply";
import { expect, test, type Browser, type Locator, type Page } from "./test";

// M6 ticket 03: the host chooses who sees the album (every guest who replied, only those Going, or
// only the hosts), and may approve guests' photos before anyone else sees them. Adding stays the
// rule it was: the hosts, and every guest whose reply is approved.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const VISIBILITY = "Who can see the album";
const APPROVE_PHOTOS = "Approve photos before they’re shown";

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

const album = (page: Page) => page.locator('[data-slot="album"]');
const albumGroup = (sheet: Locator) => sheet.getByRole("group", { name: "Album", exact: true });

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
