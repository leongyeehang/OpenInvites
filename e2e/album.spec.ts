import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, openMore } from "./events";
import { closeReply } from "./reply";
import { expect, test, type Browser, type Page } from "./test";

// M4 ticket 11: from the event's start, guests whose replies are approved and the hosts add photos
// to the event's album, shown on the page with a full-screen viewer; hosts delete any, guests their
// own; the photos go with the event.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const AHEAD = { title: "Ada’s garden party", start: "2027-05-08T16:00", plusOnes: "0" };

async function photo(name: string, colour: string) {
  return { name, mimeType: "image/jpeg", buffer: await sharp({ create: { width: 1600, height: 1200, channels: 3, background: colour } }).jpeg().toBuffer() };
}

// A guest of their own who answers Going and comes back to the page.
async function guestGoing(browser: Browser, link: string, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await closeReply(page);
  return page;
}

const album = (page: Page) => page.locator('[data-slot="album"]');

test("before the start the album says when it opens, and takes nothing", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-ahead", AHEAD);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await expect(album(priya)).toContainText("The album opens on");
  await expect(album(priya).getByLabel("Add photos")).toHaveCount(0);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a guest adds photos after the start, another sees them in the viewer, each deletes what they may, and the photos go with the event", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album", PAST);
  const editor = host.page.url();

  // Priya adds two photos; each says it was added.
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await expect(album(priya)).toContainText("No photos yet. Add the first.");
  await album(priya).getByLabel("Add photos").setInputFiles([await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")]);
  await expect(album(priya).getByRole("status")).toContainText("garden.jpg: added", { timeout: 20_000 });
  await expect(album(priya).getByRole("status")).toContainText("cake.jpg: added");
  const thumbnails = album(priya).getByRole("button", { name: /^Photo \d by Priya Nair$/ });
  await expect(thumbnails).toHaveCount(2, { timeout: 15_000 });
  await expectNoSeriousViolations(priya, "the album with photos");

  // Someone who has not replied sees only how many there are.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(host.link);
  await expect(album(visitor)).toContainText("2 photos");
  await expect(album(visitor).getByRole("img")).toHaveCount(0);

  // Mei sees them in the viewer: the arrow keys move, who added it is said, Download is there and
  // Delete is not, and Escape gives the focus back to the thumbnail.
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  const meiThumbs = album(mei).getByRole("button", { name: /^Photo \d by Priya Nair$/ });
  await meiThumbs.first().click();
  const viewer = mei.getByRole("dialog", { name: "Photo 1 of 2" });
  await expect(viewer).toBeVisible();
  await expect(viewer).toContainText("Added by Priya Nair");
  await expect(viewer.getByRole("link", { name: "Download" })).toHaveAttribute("href", /\/uploads\/[0-9a-f-]{36}\/photo\.webp$/);
  await expect(viewer.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expectNoSeriousViolations(mei, "the photo viewer");
  await mei.keyboard.press("ArrowRight");
  await expect(mei.getByRole("dialog", { name: "Photo 2 of 2" })).toBeVisible();
  await mei.keyboard.press("Escape");
  await expect(mei.getByRole("dialog")).toHaveCount(0);
  await expect(meiThumbs.nth(1)).toBeFocused();
  const firstThumb = await mei.getByRole("button", { name: "Photo 1 by Priya Nair" }).locator("img").getAttribute("src");

  // Priya deletes her own, after a confirmation; the focus goes to the album's heading.
  await priya.reload();
  await thumbnails.first().click();
  await priya.getByRole("dialog", { name: "Photo 1 of 2" }).getByRole("button", { name: "Delete" }).click();
  await priya.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(thumbnails).toHaveCount(1, { timeout: 15_000 });
  await expect(priya.getByRole("heading", { name: "Photos" })).toBeFocused();
  expect((await request.get(firstThumb!)).status()).toBe(404);

  // The host deletes the other.
  await host.page.goto(host.link);
  const remaining = await album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair" }).locator("img").getAttribute("src");
  await album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair" }).click();
  await host.page.getByRole("dialog", { name: "Photo 1 of 1" }).getByRole("button", { name: "Delete" }).click();
  await host.page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(album(host.page)).toContainText("No photos yet. Add the first.", { timeout: 15_000 });
  expect((await request.get(remaining!)).status()).toBe(404);

  // A photo the host adds goes with the event.
  await album(host.page).getByLabel("Add photos").setInputFiles([await photo("toast.jpg", "#e0b040")]);
  await expect(album(host.page).getByRole("button", { name: /^Photo 1 by / })).toBeVisible({ timeout: 20_000 });
  const toast = await album(host.page).getByRole("img").first().getAttribute("src");
  expect((await request.get(toast!)).status()).toBe(200);
  await host.page.goto(editor);
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Delete event" }).click();
  await host.page.getByRole("button", { name: "Delete it" }).click();
  await expect(host.page).toHaveURL(/\/dashboard$/);
  expect((await request.get(toast!)).status()).toBe(404);

  await Promise.all([host.context.close(), priya.context().close(), mei.context().close(), visitor.context().close()]);
});

test("the album in Traditional Chinese", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-zh", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await priya.getByRole("contentinfo").getByRole("form", { name: "Language" }).getByRole("button", { name: "繁體中文" }).click();
  await expect(priya.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(album(priya)).toContainText("還沒有照片，來新增第一張吧。");
  await expect(album(priya).getByLabel("新增照片")).toBeAttached();
  await Promise.all([host.context.close(), priya.context().close()]);
});
