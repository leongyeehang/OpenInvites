import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, openMore } from "./events";
import { holdMotionPending } from "./instances";
import { tabUntil } from "./keys";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type Browser, type Locator, type Page } from "./test";

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
  const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
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
  await expect(album(priya).getByLabel(/^Add photos/)).toHaveCount(0);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a guest adds photos after the start, another sees them in the viewer, each deletes what they may, and the photos go with the event", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album", PAST);
  const editor = host.page.url();

  // Priya adds two photos; each says it was added.
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await expect(album(priya)).toContainText("No photos yet. Add the first.");
  await album(priya).getByLabel(/^Add photos/).setInputFiles([await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")]);
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
  await album(host.page).getByLabel(/^Add photos/).setInputFiles([await photo("toast.jpg", "#e0b040")]);
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

// M8 ticket 09: a caption, written by whoever added the item or a host, while adding or afterwards;
// shown under the item in the viewer and in its name, never under the tiles; plain text.
const caption = (viewer: Locator) => viewer.locator('[data-slot="caption"]');
const captionField = (viewer: Locator) => viewer.getByLabel("Caption", { exact: true });

test("whoever adds an item captions it, a host changes it, and another guest cannot", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-caption", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");

  // Priya captions her photo from its line, as it is added.
  await album(priya).getByLabel(/^Add photos/).setInputFiles([await photo("lake.jpg", "#d07a3a")]);
  await expect(album(priya).getByRole("status")).toHaveText("lake.jpg: added", { timeout: 20_000 });
  await album(priya).getByLabel("Caption for lake.jpg").fill("Sunset over the lake");
  await album(priya).getByRole("button", { name: "Save" }).click();
  await expect(album(priya).getByRole("status")).toHaveText("lake.jpg: caption saved");
  await expect(album(priya).getByLabel("Caption for lake.jpg")).toHaveCount(0);

  // Mei reads it under the picture and in the photo's name, never under the tile, and may not
  // change it.
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  const meiTile = album(mei).getByRole("button", { name: "Photo 1 by Priya Nair: Sunset over the lake" });
  await expect(meiTile).toBeVisible();
  await expect(album(mei).locator("li[data-item]")).not.toContainText("Sunset");
  await meiTile.click();
  let viewer = mei.getByRole("dialog", { name: "Photo 1 of 1" });
  await expect(caption(viewer)).toHaveText("Sunset over the lake");
  await expect(viewer.getByRole("img", { name: "Photo 1 by Priya Nair: Sunset over the lake" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: /caption/i })).toHaveCount(0);
  await mei.keyboard.press("Escape");

  // Priya changes it in the viewer by keyboard alone.
  await priya.reload();
  await album(priya).getByRole("button", { name: "Photo 1 by Priya Nair: Sunset over the lake" }).focus();
  await priya.keyboard.press("Enter");
  viewer = priya.getByRole("dialog", { name: "Photo 1 of 1" });
  const edit = viewer.getByRole("button", { name: "Edit caption" });
  await tabUntil(priya, edit);
  await priya.keyboard.press("Enter");
  await expect(captionField(viewer)).toBeFocused();
  await expect(captionField(viewer)).toHaveValue("Sunset over the lake");
  await expect(viewer).toContainText("20/140");
  await expectNoSeriousViolations(priya, "the photo viewer, a caption being written");
  await priya.keyboard.press("End");
  await priya.keyboard.type(" at dusk");
  await priya.keyboard.press("Enter");
  await expect(caption(viewer)).toHaveText("Sunset over the lake at dusk");
  await expect(edit).toBeFocused();
  // Escape while writing again leaves the field, not the viewer, and the caption as it was.
  await priya.keyboard.press("Enter");
  await expect(captionField(viewer)).toBeFocused();
  await priya.keyboard.type(" and more");
  await priya.keyboard.press("Escape");
  await expect(captionField(viewer)).toHaveCount(0);
  await expect(viewer).toBeVisible();
  await expect(caption(viewer)).toHaveText("Sunset over the lake at dusk");
  await expect(edit).toBeFocused();
  await priya.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // A host changes it; it is written as typed, never as markup.
  await host.page.goto(host.link);
  await album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair: Sunset over the lake at dusk" }).click();
  const hostViewer = host.page.getByRole("dialog", { name: "Photo 1 of 1" });
  await hostViewer.getByRole("button", { name: "Edit caption" }).click();
  await captionField(hostViewer).fill("<b>Ada’s</b> lake");
  await hostViewer.getByRole("button", { name: "Save" }).click();
  await expect(caption(hostViewer)).toHaveText("<b>Ada’s</b> lake");
  await expect(caption(hostViewer).locator("b")).toHaveCount(0);

  // Mei sees the host's, and still has no way to write one.
  await mei.reload();
  await album(mei).getByRole("button", { name: "Photo 1 by Priya Nair: <b>Ada’s</b> lake" }).click();
  viewer = mei.getByRole("dialog", { name: "Photo 1 of 1" });
  await expect(caption(viewer)).toHaveText("<b>Ada’s</b> lake");
  await expect(viewer.getByRole("button", { name: /caption/i })).toHaveCount(0);
  await mei.keyboard.press("Escape");

  // An empty save removes it: the name is the photo's alone again, and Mei has no Add a caption.
  await hostViewer.getByRole("button", { name: "Edit caption" }).click();
  await captionField(hostViewer).fill("");
  await hostViewer.getByRole("button", { name: "Save" }).click();
  await expect(caption(hostViewer)).toHaveCount(0);
  await expect(hostViewer.getByRole("button", { name: "Add a caption" })).toBeVisible();
  await host.page.keyboard.press("Escape");
  await expect(album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true })).toBeVisible();
  await mei.reload();
  await album(mei).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true }).click();
  viewer = mei.getByRole("dialog", { name: "Photo 1 of 1" });
  await expect(caption(viewer)).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Add a caption" })).toHaveCount(0);
  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

test("a caption over 140 characters is refused", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-caption-long", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await album(priya).getByLabel(/^Add photos/).setInputFiles([await photo("lake.jpg", "#d07a3a")]);
  await album(priya).getByRole("button", { name: "Photo 1 by Priya Nair" }).click({ timeout: 20_000 });
  const viewer = priya.getByRole("dialog", { name: "Photo 1 of 1" });
  await viewer.getByRole("button", { name: "Add a caption" }).click();
  // Typed past the field's own limit, as a page that is not this one could post it.
  await captionField(viewer).evaluate((field: HTMLInputElement, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }, "a".repeat(141));
  await expect(viewer).toContainText("141/140");
  await viewer.getByRole("button", { name: "Save" }).click();
  await expect(viewer.getByRole("alert")).toHaveText("Captions can be up to 140 characters.");
  await expect(captionField(viewer)).toHaveAccessibleDescription(/Captions can be up to 140 characters\./);
  await expectNoSeriousViolations(priya, "the photo viewer, a caption refused");
  // 140 are taken.
  await captionField(viewer).fill("a".repeat(140));
  await viewer.getByRole("button", { name: "Save" }).click();
  await expect(caption(viewer)).toHaveText("a".repeat(140));
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a video's caption, written while it is processing, shows once it is ready", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-caption-video", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await album(priya).getByLabel("Add photos and videos").setInputFiles("e2e/fixtures/clip-h264.mp4");
  const lines = album(priya).getByRole("status").last();
  await expect(lines).toHaveText("clip-h264.mp4: uploaded, processing", { timeout: 30_000 });
  await album(priya).getByLabel("Caption for clip-h264.mp4").fill("The first dance");
  await album(priya).getByRole("button", { name: "Save" }).click();
  await expect(lines).toHaveText("clip-h264.mp4: caption saved");
  const tile = album(priya).locator('li[data-item="video"][data-state="ready"]');
  await expect(tile).toBeVisible({ timeout: 150_000 });
  await tile.getByRole("button", { name: /^Video 1 by Priya Nair: The first dance/ }).click();
  const viewer = priya.getByRole("dialog", { name: "Video 1 of 1" });
  await expect(caption(viewer)).toHaveText("The first dance");
  await expect(viewer.locator("video")).toHaveAccessibleName("Video 1 by Priya Nair: The first dance");
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Media part review: the viewer follows its item, not a place in the list, and a caption being
// written is left whenever the viewer closes or turns. A page refreshes while a photo's motion is
// made only for its uploader and the hosts.

// An item's id, read from its tile's thumbnail.
async function idOf(tile: Locator): Promise<string> {
  const thumb = await tile.locator("img").getAttribute("src");
  expect(thumb).toMatch(/^\/uploads\/[0-9a-f-]{36}\/photo-thumb\.webp$/);
  return thumb!.split("/")[2];
}

// One photo added on its own, so the album's order of adding is fixed.
async function addOne(page: Page, name: string, colour: string): Promise<void> {
  await album(page).getByLabel(/^Add photos/).setInputFiles([await photo(name, colour)]);
  await expect(album(page).getByRole("status")).toHaveText(`${name}: added`, { timeout: 20_000 });
}

// Whether the page as its browser receives it, before any script runs, refreshes itself.
async function refreshes(page: Page, link: string): Promise<boolean> {
  return (await (await page.request.get(link)).text()).includes('data-slot="refresh-while-processing"');
}

test("the viewer stays on its item while the album changes around it, and closes once it is deleted elsewhere", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-follow", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addOne(priya, "garden.jpg", "#2f6b3a");
  await addOne(priya, "cake.jpg", "#c0506a");
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  await addOne(mei, "lake.jpg", "#d07a3a");

  // Mei's photo's motion is being made, so the host's page refreshes itself.
  const release = holdMotionPending(await idOf(album(mei).getByRole("button", { name: "Photo 3 by Mei Tan" })));
  try {
    await host.page.goto(host.link);
    const cake = await album(host.page).getByRole("button", { name: "Photo 2 by Priya Nair" }).locator("img").getAttribute("src");
    await album(host.page).getByRole("button", { name: "Photo 2 by Priya Nair" }).click();
    await expect(host.page.getByRole("dialog", { name: "Photo 2 of 3" })).toBeVisible();

    // Priya deletes the photo before it: the host's viewer is drawn again on the same photo.
    await priya.reload();
    await album(priya).getByRole("button", { name: "Photo 1 by Priya Nair" }).click();
    await priya.getByRole("dialog", { name: "Photo 1 of 3" }).getByRole("button", { name: "Delete" }).click();
    await priya.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
    const viewer = host.page.getByRole("dialog", { name: "Photo 1 of 2" });
    await expect(viewer).toBeVisible({ timeout: 30_000 });
    await expect(viewer.getByRole("img", { name: "Photo 1 by Priya Nair" })).toHaveAttribute("src", cake!.replace("photo-thumb", "photo"));
    await expect(viewer).toContainText("Added by Priya Nair");

    // Priya deletes the open photo itself: the host's viewer closes, and the album stays.
    await album(priya).getByRole("button", { name: "Photo 1 by Priya Nair" }).click();
    await priya.getByRole("dialog", { name: "Photo 1 of 2" }).getByRole("button", { name: "Delete" }).click();
    await priya.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
    await expect(host.page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(album(host.page).getByRole("button", { name: "Photo 1 by Mei Tan" })).toBeVisible();
    await expect(host.page.getByRole("heading", { name: "Photos" })).toBeFocused();
  } finally {
    release();
  }
  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

test("only the uploader's and the hosts' pages refresh while a photo's motion is made", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-motion-pending", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addOne(priya, "garden.jpg", "#2f6b3a");
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  const id = await idOf(album(mei).getByRole("button", { name: "Photo 1 by Priya Nair" }));
  expect(await refreshes(mei, host.link)).toBe(false);

  const release = holdMotionPending(id);
  try {
    expect(await refreshes(priya, host.link)).toBe(true);
    expect(await refreshes(host.page, host.link)).toBe(true);
    // Mei sees the photo, and her page never refreshes for its motion.
    const sent = await (await mei.request.get(host.link)).text();
    expect(sent).toContain(id);
    expect(sent).not.toContain('data-slot="refresh-while-processing"');
  } finally {
    release();
  }
  expect(await refreshes(priya, host.link)).toBe(false);
  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

test("a caption being written is left when the viewer closes or turns, and comes back as it was", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-caption-left", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addOne(priya, "lake.jpg", "#d07a3a");
  await album(priya).getByLabel("Caption for lake.jpg").fill("Sunset over the lake");
  await album(priya).getByRole("button", { name: "Save" }).click();
  await expect(album(priya).getByRole("status")).toHaveText("lake.jpg: caption saved");
  await addOne(priya, "cake.jpg", "#c0506a");
  await priya.reload();
  const tile = album(priya).getByRole("button", { name: "Photo 1 by Priya Nair: Sunset over the lake" });

  // Closed while writing: opened again, the caption is as it was and the field is closed.
  await tile.click();
  let viewer = priya.getByRole("dialog", { name: "Photo 1 of 2" });
  await viewer.getByRole("button", { name: "Edit caption" }).click();
  await expect(captionField(viewer)).toHaveValue("Sunset over the lake");
  await captionField(viewer).fill("");
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(viewer).toBeHidden();
  await tile.click();
  viewer = priya.getByRole("dialog", { name: "Photo 1 of 2" });
  await expect(caption(viewer)).toHaveText("Sunset over the lake");
  await expect(captionField(viewer)).toHaveCount(0);
  // Opened again, the field starts from the caption as it is.
  await viewer.getByRole("button", { name: "Edit caption" }).click();
  await expect(captionField(viewer)).toHaveValue("Sunset over the lake");

  // Turned while writing: back again, the same.
  await captionField(viewer).fill("");
  await viewer.getByRole("button", { name: "Next photo" }).click();
  await expect(priya.getByRole("dialog", { name: "Photo 2 of 2" })).toBeVisible();
  await priya.getByRole("dialog", { name: "Photo 2 of 2" }).getByRole("button", { name: "Previous photo" }).click();
  viewer = priya.getByRole("dialog", { name: "Photo 1 of 2" });
  await expect(caption(viewer)).toHaveText("Sunset over the lake");
  await expect(captionField(viewer)).toHaveCount(0);
  await priya.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // Nothing was saved: the page drawn again still has it.
  await priya.reload();
  await expect(tile).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close()]);
});
