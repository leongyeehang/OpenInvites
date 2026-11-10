import { readFileSync } from "node:fs";
import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings } from "./events";
import { tabUntil } from "./keys";
import { closeReply } from "./reply";
import { expectStill } from "./still";
import { clientAddress, expect, test, type Browser, type BrowserContextOptions, type Locator, type Page } from "./test";

// M7 ticket 07: videos in the album as a guest meets them: the picker, the check before sending,
// the resume after a dropped part, the Processing tile turning into a video tile, the player with
// its two qualities, and Download at original quality.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const H264 = "e2e/fixtures/clip-h264.mp4";
const HEVC = "e2e/fixtures/clip-hevc.mov";
const LONG = "e2e/fixtures/clip-long.mp4";

async function guestGoing(browser: Browser, link: string, name: string, options: BrowserContextOptions = {}): Promise<Page> {
  const page = await (await browser.newContext({ ...options, extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  return replyGoing(page, link, name);
}

async function replyGoing(page: Page, link: string, name: string): Promise<Page> {
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

// The video tile, once processing is done.
async function readyTile(page: Page, ms = 90_000): Promise<Locator> {
  const tile = album(page).locator('li[data-item="video"][data-state="ready"]');
  await expect(tile).toBeVisible({ timeout: ms });
  return tile;
}

test("a guest adds a video, which processes into a tile with its length, plays in the viewer, and downloads at original quality", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-tile", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  await expect(album(priya).getByRole("status").last()).toContainText("clip-h264.mp4: uploaded, processing", { timeout: 30_000 });
  // The tile says it is processing, with a live status, until the page learns it is ready.
  await expect(album(priya).locator('li[data-state="processing"]')).toBeVisible();
  await expectNoSeriousViolations(priya, "the album, a clip processing");
  const tile = await readyTile(priya);
  await expect(tile).toContainText("0:04");
  await expectNoSeriousViolations(priya, "the album with a video");

  await tile.getByRole("button", { name: "Video 1 by Priya Nair" }).click();
  const viewer = priya.getByRole("dialog", { name: "Video 1 of 1" });
  await expect(viewer).toBeVisible();
  const player = viewer.locator("video");
  await expect(player).toHaveAttribute("controls", "");
  await expect(player).toHaveAttribute("poster", /\/video-poster\.webp$/);
  await expect(viewer.getByRole("radiogroup")).toHaveCount(0);
  await expect(viewer.getByRole("link", { name: "Download" })).toHaveAttribute("href", /\/uploads\/[0-9a-f-]{36}\/video\.mp4$/);
  // A guest's clip has no captions track, and no page can make one: that rule alone is set aside.
  await expectNoSeriousViolations(priya, "the viewer with the player", { except: ["video-caption"] });
  await priya.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // The host sees it too.
  await host.page.goto(host.link);
  await expect(album(host.page).getByRole("button", { name: "Video 1 by Priya Nair" })).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("an HEVC clip gets the lighter copy, which plays where the original cannot, and the choice is offered", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-hevc", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await album(priya).getByLabel("Add photos and videos").setInputFiles(HEVC);
  const tile = await readyTile(priya, 120_000);
  await tile.getByRole("button", { name: "Video 1 by Priya Nair" }).click();
  const viewer = priya.getByRole("dialog", { name: "Video 1 of 1" });
  await expect(viewer.getByRole("radiogroup", { name: "Quality" })).toBeVisible();
  // Headless Chrome has no HEVC decoder: the original is offered but not playable, the copy plays.
  await expect(viewer.getByRole("radio", { name: "Original quality" })).toBeDisabled();
  await expect(viewer.getByRole("radio", { name: "Lighter copy" })).toHaveAttribute("aria-checked", "true");
  await expect(viewer.getByText("Original quality: not playable in this browser.")).toBeVisible();
  await expect.poll(() => viewer.locator("video").evaluate((video: HTMLVideoElement) => video.currentSrc)).toMatch(/\/video-1080p\.mp4$/);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a clip over the event's caps is refused before anything is sent", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "video-caps", PAST);
  await editSettings(host.page, async (sheet) => {
    await albumGroup(sheet).getByLabel("Longest video (min)").fill("1");
    await albumGroup(sheet).getByLabel("Largest video (MB)").fill("1");
  });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  let requests = 0;
  await priya.route("**/api/albums/**", (route) => {
    requests += 1;
    return route.continue();
  });
  await album(priya).getByLabel("Add photos and videos").setInputFiles(LONG);
  await expect(album(priya).getByRole("status").last()).toContainText("clip-long.mp4: longer than 1 min: it is 1:01");
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  await expect(album(priya).getByRole("status").last()).toContainText("clip-h264.mp4: larger than 1 MB: it is 1.3 MB");
  expect(requests).toBe(0);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a dropped part is sent again, and the clip still becomes ready", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-drop", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  let dropped = false;
  await priya.route(/\/api\/albums\/[^/]+\/uploads\/[^/?]+\?part=1$/, async (route) => {
    if (dropped) return route.continue();
    dropped = true;
    await route.abort();
  });
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  await readyTile(priya);
  expect(dropped).toBe(true);
  await priya.unrouteAll({ behavior: "ignoreErrors" });
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("with videos not allowed, the picker takes photos only", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "video-off", PAST);
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel("Allow videos").uncheck());
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const picker = album(priya).getByLabel("Add photos", { exact: true });
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("accept", "image/jpeg,image/png,image/webp,image/avif");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("the player's keys stay with the player, and a photo and a video sit side by side", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-keys", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const photo = { name: "garden.jpg", mimeType: "image/jpeg", buffer: await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#2f6b3a" } }).jpeg().toBuffer() };
  const clip = { name: "clip-h264.mp4", mimeType: "video/mp4", buffer: readFileSync(H264) };
  await album(priya).getByLabel("Add photos and videos").setInputFiles([photo, clip]);
  await expect(album(priya).getByRole("status").last()).toContainText("garden.jpg: added", { timeout: 30_000 });
  await readyTile(priya);
  await album(priya).getByRole("button", { name: "Video 2 by Priya Nair" }).click();
  const viewer = priya.getByRole("dialog", { name: "Video 2 of 2" });
  await expect(viewer).toBeVisible();
  await viewer.locator("video").focus();
  await priya.keyboard.press("ArrowLeft");
  await expect(viewer).toBeVisible();
  await expect(priya.getByRole("dialog", { name: "Photo 1 of 2" })).toHaveCount(0);
  // From the page's own control, the arrow turns to the photo.
  await viewer.getByRole("button", { name: "Previous" }).focus();
  await priya.keyboard.press("ArrowLeft");
  await expect(priya.getByRole("dialog", { name: "Photo 1 of 2" })).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Ticket 11: the quality control by keyboard. Headless Chrome cannot play HEVC, which would leave
// one choice; told that it can, both are offered, and switching needs no decoding.
test("the quality control is reached from the player and worked by keyboard", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-keyboard", PAST);
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  await context.addInitScript(() => {
    HTMLMediaElement.prototype.canPlayType = () => "probably";
  });
  const priya = await replyGoing(await context.newPage(), host.link, "Priya Nair");
  await album(priya).getByLabel("Add photos and videos").setInputFiles(HEVC);
  const tile = await readyTile(priya, 120_000);
  await tile.getByRole("button", { name: "Video 1 by Priya Nair" }).click();
  const viewer = priya.getByRole("dialog", { name: "Video 1 of 1" });
  const original = viewer.getByRole("radio", { name: "Original quality" });
  const copy = viewer.getByRole("radio", { name: "Lighter copy" });
  await expect(copy).toHaveAttribute("aria-checked", "true");
  await expect(original).toBeEnabled();
  const playing = () => viewer.locator("video").evaluate((video: HTMLVideoElement) => video.currentSrc);
  await expect.poll(playing).toMatch(/\/video-1080p\.mp4$/);
  await viewer.locator("video").focus();
  await tabUntil(priya, copy);
  await priya.keyboard.press("ArrowRight");
  await expect(original).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing).toMatch(/\/video\.mp4$/);
  await priya.keyboard.press("ArrowLeft");
  await expect(copy).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing).toMatch(/\/video-1080p\.mp4$/);
  await Promise.all([host.context.close(), context.close()]);
});

test("under reduced motion the processing tile and the player hold still", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-still", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { reducedMotion: "reduce" });
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  await expect(album(priya).locator('li[data-state="processing"]')).toBeVisible();
  await expectStill(priya, "the album, a clip processing");
  const tile = await readyTile(priya);
  await tile.getByRole("button", { name: "Video 1 by Priya Nair" }).click();
  await expect(priya.getByRole("dialog", { name: "Video 1 of 1" }).locator("video")).toBeVisible();
  await expectStill(priya, "the viewer with the player");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a guest whose browser asks for zh-TW adds a video and opens it in Traditional Chinese", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-zh", PAST);
  const page = await (await browser.newContext({ locale: "zh-TW", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await page.goto(host.link);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await page.getByRole("button", { name: "參加", exact: true }).click();
  await page.getByLabel("你的名字").fill("Priya Nair");
  await page.getByRole("button", { name: "送出回覆" }).click();
  await expect(page.getByText("期待你的到來！")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("dialog", { name: "你的回覆" }).getByRole("button", { name: "關閉" }).click();
  await album(page).getByLabel("新增照片和影片").setInputFiles(H264);
  await expect(album(page).getByRole("status").last()).toContainText("clip-h264.mp4：已上傳，處理中", { timeout: 30_000 });
  await expect(album(page).locator('li[data-state="processing"]')).toContainText("處理中");
  const tile = await readyTile(page);
  await tile.getByRole("button", { name: "Priya Nair 的第 1 段影片" }).click();
  const viewer = page.getByRole("dialog", { name: "第 1 段影片，共 1 項" });
  await expect(viewer.getByRole("link", { name: "下載" })).toBeVisible();
  await Promise.all([host.context.close(), page.context().close()]);
});

