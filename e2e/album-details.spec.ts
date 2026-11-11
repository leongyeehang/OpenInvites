import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings } from "./events";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type Browser, type Locator, type Page } from "./test";

// M8 ticket 07: under an open item, its technical line; the two switches a host may turn on for
// when items were taken and with what camera, read as each is added and stored on the item, never
// in its files; the album ordered by when taken; and the location never read, under any setting.
// What a switch that is off would show is left out on the server, which the page's HTML proves.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const EXIF_PHOTO = "e2e/fixtures/photo-exif.jpg";
const H264 = "e2e/fixtures/clip-h264.mp4";
const TAGGED = "e2e/fixtures/clip-tagged.mov";
const KEEP_TAKEN = "Keep when each photo and video was taken";
const KEEP_CAMERA = "Keep the camera and its settings";
const ORDER = "Order of the album";
const CAMERA_LINE = "iPhone 15 Pro · iPhone 15 Pro back camera 6.86mm f/1.78 · f/1.8 · 1/120 s · ISO 80 · 6.9 mm";
// clip-tagged.mov's location tag, a string in the clip. photo-exif.jpg keeps its location as GPS
// rationals, which no page could carry as this string; the unit test that readExif never follows
// the GPS pointer is the photo's guard.
const LOCATION = "35.6895";

// The capture times as instants, which the taken line's <time> carries: photo-exif.jpg's 2026:01:10
// 16:42:05 at +08:00, and clip-tagged.mov's 16:20 at +0800. The words around them are the server's
// Intl's, which the runner's need not match, so only "Taken" and the year are read from the text.
const PHOTO_TAKEN = "2026-01-10T08:42:05.000Z";
const CLIP_TAKEN = "2026-01-10T08:20:00.000Z";
const TAKEN_TEXT = /^Taken .*2026/;

// The taken line's instant, or none.
async function expectTaken(viewer: Locator, instant: string) {
  await expect(details(viewer).locator("time")).toHaveAttribute("datetime", instant);
  await expect(details(viewer).locator("time")).toHaveText(TAKEN_TEXT);
}

async function plainPhoto(name: string, colour: string) {
  return { name, mimeType: "image/jpeg", buffer: await sharp({ create: { width: 1600, height: 1200, channels: 3, background: colour } }).jpeg().toBuffer() };
}

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
const albumGroup = (sheet: Locator) => sheet.getByRole("group", { name: "Album", exact: true });
const details = (viewer: Locator) => viewer.locator('[data-slot="item-details"]');

// A video waits its turn in the queue behind every other upload the specs keep sending.
const VIDEO_MS = 150_000;

// Adds files as one batch and waits for each to be added, or, for a video, to be ready.
async function add(page: Page, files: Parameters<Locator["setInputFiles"]>[0], items: number): Promise<void> {
  await album(page).getByLabel(/^Add photos/).setInputFiles(files);
  const tiles = album(page).locator("li[data-item]");
  await expect(tiles).toHaveCount(items, { timeout: 30_000 });
  await expect(album(page).locator('li[data-state="processing"]')).toHaveCount(0, { timeout: VIDEO_MS });
  await page.reload();
}

// Item `n` of `count` opened in the viewer, by its thumbnail's name.
async function open(page: Page, name: RegExp, n: number, count: number): Promise<Locator> {
  await album(page).getByRole("button", { name }).nth(n - 1).click();
  const viewer = page.getByRole("dialog", { name: new RegExp(`^(Photo|Video) ${n} of ${count}$`) });
  await expect(viewer).toBeVisible();
  return viewer;
}

async function close(page: Page, viewer: Locator) {
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
}

// The page as a guest's browser receives it, before any script runs.
async function html(page: Page, link: string): Promise<string> {
  return (await page.request.get(link)).text();
}

test("an open photo and an open video show their technical line", async ({ browser, request }) => {
  test.setTimeout(2 * VIDEO_MS + 60_000);
  const host = await createPublished(browser, request, "details-line", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await add(priya, [await plainPhoto("garden.jpg", "#2f6b3a")], 1);
  await add(priya, H264, 2);

  let viewer = await open(priya, /^(Photo|Video) \d by Priya Nair/, 1, 2);
  await expect(details(viewer)).toHaveText(/^1600 × 1200 · \d+(\.\d)? MB$/);
  await expectNoSeriousViolations(priya, "the viewer with an item's details");
  await close(priya, viewer);

  viewer = await open(priya, /^(Photo|Video) \d by Priya Nair/, 2, 2);
  await expect(details(viewer)).toHaveText(/^480p · 30 fps · 0:04 · \d+(\.\d)? MB$/);
  await close(priya, viewer);
  // Nothing of it on the tiles.
  await expect(album(priya)).not.toContainText("1600 × 1200");
  await expect(album(priya)).not.toContainText("fps");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("with the switches off, nothing of when, with what or where is shown", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "details-off", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await add(priya, EXIF_PHOTO, 1);
  const viewer = await open(priya, /^Photo 1 by Priya Nair$/, 1, 1);
  await expect(details(viewer)).toHaveText(/^640 × 480 · \d+(\.\d)? MB$/);
  await expect(viewer).not.toContainText("Taken");
  await expect(viewer).not.toContainText("iPhone");
  const sent = await html(priya, host.link);
  expect(sent).not.toContain("iPhone 15 Pro");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("the host keeps both, guests see them, and turning one off hides it without erasing it", async ({ browser, request }) => {
  test.setTimeout(2 * VIDEO_MS + 60_000);
  const host = await createPublished(browser, request, "details-kept", PAST);
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(KEEP_TAKEN).check();
    await albumGroup(sheet).getByLabel(KEEP_CAMERA).check();
  });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await add(priya, EXIF_PHOTO, 1);
  await add(priya, TAGGED, 2);

  let viewer = await open(priya, /^(Photo|Video) \d by Priya Nair/, 1, 2);
  await expect(details(viewer).locator("p")).toHaveText([/^640 × 480 · /, TAKEN_TEXT, CAMERA_LINE]);
  await expectTaken(viewer, PHOTO_TAKEN);
  await expectNoSeriousViolations(priya, "the viewer with the details kept");
  await close(priya, viewer);
  viewer = await open(priya, /^(Photo|Video) \d by Priya Nair/, 2, 2);
  await expect(details(viewer).locator("p")).toHaveText([/^480p · 30 fps · 0:04 · /, TAKEN_TEXT, "iPhone 15 Pro"]);
  await expectTaken(viewer, CLIP_TAKEN);
  await close(priya, viewer);
  expect(await html(priya, host.link)).not.toContain(LOCATION);

  // The camera switched off: its line goes, and no page carries it.
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(KEEP_CAMERA).uncheck();
  });
  await priya.reload();
  viewer = await open(priya, /^(Photo|Video) \d by Priya Nair/, 1, 2);
  await expect(details(viewer).locator("p")).toHaveText([/^640 × 480 · /, TAKEN_TEXT]);
  await expectTaken(viewer, PHOTO_TAKEN);
  await close(priya, viewer);
  expect(await html(priya, host.link)).not.toContain("iPhone 15 Pro");

  // On again: it was never erased.
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(KEEP_CAMERA).check();
  });
  await priya.reload();
  viewer = await open(priya, /^(Photo|Video) \d by Priya Nair/, 1, 2);
  await expect(details(viewer)).toContainText(CAMERA_LINE);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("ordered by when taken", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "details-order", PAST);
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(KEEP_TAKEN).check();
  });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  // A plain photo, then one taken on the day of the party. Two adds rather than one batch, since a
  // batch sends two files at once and either may be added first.
  await add(priya, [await plainPhoto("garden.jpg", "#2f6b3a")], 1);
  await add(priya, EXIF_PHOTO, 2);

  let viewer = await open(priya, /^Photo \d by Priya Nair$/, 1, 2);
  await expect(details(viewer)).not.toContainText("Taken");
  await close(priya, viewer);

  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(ORDER).selectOption({ label: "When taken" });
  });
  await priya.reload();
  viewer = await open(priya, /^Photo \d by Priya Nair$/, 1, 2);
  await expectTaken(viewer, PHOTO_TAKEN);
  await close(priya, viewer);

  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(ORDER).selectOption({ label: "When added" });
  });
  await priya.reload();
  viewer = await open(priya, /^Photo \d by Priya Nair$/, 1, 2);
  await expect(details(viewer)).not.toContainText("Taken");
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Review focus (plan): an item added before the host kept capture times has none, shows none, and
// under "When taken" sits by when it was added; one added after shows its own.
test("capture time switched on after items were added", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "details-later", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  // Taken at 11:11 on 9 January, the day before the party, by its own camera's clock.
  const early = {
    name: "early.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({ create: { width: 800, height: 600, channels: 3, background: "#c0506a" } })
      .jpeg()
      .withExif({ IFD2: { DateTimeOriginal: "2026:01:09 11:11:11", OffsetTimeOriginal: "+08:00" } })
      .toBuffer(),
  };
  const EARLY_TAKEN = "2026-01-09T03:11:11.000Z";
  await add(priya, [early], 1);

  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel(KEEP_TAKEN).check();
    await albumGroup(sheet).getByLabel(ORDER).selectOption({ label: "When taken" });
  });
  await add(priya, EXIF_PHOTO, 2);

  // Under "When taken" the later photo, taken on 10 January, comes first; the earlier one, though
  // its camera says 9 January, has no time kept and sits by when it was added, after it.
  let viewer = await open(priya, /^Photo \d by Priya Nair$/, 1, 2);
  await expect(details(viewer).locator("p")).toHaveText([/^640 × 480 · /, TAKEN_TEXT]);
  await expectTaken(viewer, PHOTO_TAKEN);
  await close(priya, viewer);
  viewer = await open(priya, /^Photo \d by Priya Nair$/, 2, 2);
  await expect(details(viewer).locator("p")).toHaveText([/^800 × 600 · /]);
  await close(priya, viewer);
  const sent = await html(priya, host.link);
  expect(sent).toContain(PHOTO_TAKEN);
  expect(sent).not.toContain(EARLY_TAKEN);
  await Promise.all([host.context.close(), priya.context().close()]);
});
