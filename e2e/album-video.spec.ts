import { readFileSync } from "node:fs";
import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings } from "./events";
import { tabUntil } from "./keys";
import { closeReply } from "./reply";
import { expectStill } from "./still";
import { clientAddress, expect, test, type Browser, type BrowserContextOptions, type Locator, type Page } from "./test";

// M7 ticket 07: videos in the album as a guest meets them: the picker, the check before sending,
// the resume after a dropped part, the Processing tile turning into a video tile, the player, and
// Download at original quality. M8 ticket 06: the player's sizes, Auto, the remembered pick and
// stepping down.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const H264 = "e2e/fixtures/clip-h264.mp4";
const HEVC_1080 = "e2e/fixtures/clip-hevc-1080p.mp4";
const HDR = "e2e/fixtures/clip-hdr.mp4";
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

// The album's videos with every size made: an HEVC clip is ready with its 1080p copy, and its
// 720p copy follows (M8 ticket 03), which the page shows once it is drawn again. The 720p copies
// wait behind every new upload, which the other specs keep sending, so their wait is long; the
// test's timeout stays above the two waits together.
const SIZES_MS = 480_000;
async function allSizesMade(page: Page, count = 1): Promise<void> {
  const tiles = album(page).locator('li[data-item="video"][data-state="ready"]');
  await expect(tiles).toHaveCount(count, { timeout: 150_000 });
  const thumbs = await tiles.locator("img").evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  const copies = thumbs.map((thumb) => thumb.replace(/video-thumb\.webp$/, "video-720p.mp4"));
  const served = async () => Promise.all(copies.map(async (copy) => (await page.request.get(copy)).status()));
  await expect.poll(served, { timeout: 300_000, intervals: [2000], message: "every 720p copy served" }).toEqual(copies.map(() => 200));
  await page.reload();
}

async function addVideo(page: Page, file: string): Promise<void> {
  await album(page).getByLabel("Add photos and videos").setInputFiles(file);
  await allSizesMade(page);
}

async function openVideo(page: Page, n = 1, count = 1): Promise<Locator> {
  await album(page).getByRole("button", { name: `Video ${n} by Priya Nair` }).click();
  const viewer = page.getByRole("dialog", { name: `Video ${n} of ${count}` });
  await expect(viewer).toBeVisible();
  return viewer;
}

const sizes = (viewer: Locator) => viewer.getByRole("radiogroup", { name: "Size" });
const size = (viewer: Locator, name: string) => sizes(viewer).getByRole("radio", { name, exact: true });
const playing = (viewer: Locator) => () => viewer.locator("video").evaluate((video: HTMLVideoElement) => video.currentSrc);
const storedPick = (page: Page) => page.evaluate(() => localStorage.getItem("openinvites.videoSize"));

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
  await expect(sizes(viewer)).toHaveCount(0);
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

// M8 ticket 06: Playwright's screen is the viewport, 1280x800 or 390x844 at a pixel ratio of 1,
// so Auto plays 720p on both widths: the smallest size that covers 0.9 of 800 or of 390 pixels.
test("a video offers Auto, its original by its size and the copies, and Auto picks for the screen", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-menu", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addVideo(priya, HEVC_1080);
  const viewer = await openVideo(priya);
  await expect(sizes(viewer).getByRole("radio")).toHaveText(["Auto · 720p", "1080p · Original", "1080p", "720p"]);
  await expect(size(viewer, "Auto · 720p")).toHaveAttribute("aria-checked", "true");
  // Headless Chrome has no HEVC decoder: the original is offered but not playable, and says why.
  await expect(size(viewer, "1080p · Original")).toBeDisabled();
  await expect(size(viewer, "1080p · Original")).toHaveAccessibleDescription("Original: not playable in this browser.");
  await expect.poll(playing(viewer)).toMatch(/\/video-720p\.mp4$/);
  await expect(viewer.getByRole("link", { name: "Download" })).toHaveAttribute("href", /\/video\.mp4$/);
  await expectNoSeriousViolations(priya, "the player with its sizes", { except: ["video-caption"] });
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a size the guest picks is remembered on the device", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-kept", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addVideo(priya, HEVC_1080);
  let viewer = await openVideo(priya);
  await size(viewer, "1080p").click();
  await expect(size(viewer, "1080p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(viewer)).toMatch(/\/video-1080p\.mp4$/);
  expect(await storedPick(priya)).toBe("1080");
  await priya.reload();
  viewer = await openVideo(priya);
  await expect(size(viewer, "1080p")).toHaveAttribute("aria-checked", "true");
  await expect(size(viewer, "Auto · 720p")).toHaveAttribute("aria-checked", "false");
  await expect.poll(playing(viewer)).toMatch(/\/video-1080p\.mp4$/);
  await Promise.all([host.context.close(), priya.context().close()]);
});

// At a pixel ratio of 3 the screen is 1170 or 2400 pixels on its short side, so Auto plays 1080p.
test("Auto steps down after three stalls and does not remember it", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-stall", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { deviceScaleFactor: 3 });
  await addVideo(priya, HEVC_1080);
  const viewer = await openVideo(priya);
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(viewer)).toMatch(/\/video-1080p\.mp4$/);
  const before = await storedPick(priya);
  await viewer.locator("video").evaluate(async (video: HTMLVideoElement) => {
    video.muted = true;
    await video.play();
    video.currentTime = 1;
    await new Promise((seeked) => video.addEventListener("seeked", seeked, { once: true }));
    for (let stall = 0; stall < 3; stall += 1) video.dispatchEvent(new Event("waiting"));
  });
  await expect(size(viewer, "Auto · 720p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(viewer)).toMatch(/\/video-720p\.mp4$/);
  await expect.poll(() => viewer.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(1);
  expect(await storedPick(priya)).toBe(before);
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Ticket 06's review, carried in ticket 07: the six-second check, on Playwright's clock. One wait
// that lasts six seconds steps Auto down; one the guest ends by pausing does not, while a wait
// begun after it still does. Nothing waits in real time.
const settled = (page: Page) =>
  page.evaluate(async () => {
    // Two turns of the task queue, where React draws a state changed by a timer.
    for (let turn = 0; turn < 2; turn += 1) {
      await new Promise<void>((done) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => done();
        channel.port2.postMessage(undefined);
      });
    }
  });

test("a wait of six seconds steps Auto down", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-long-wait", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { deviceScaleFactor: 3 });
  await addVideo(priya, HEVC_1080);
  await priya.clock.install();
  await priya.reload();
  const viewer = await openVideo(priya);
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(viewer)).toMatch(/\/video-1080p\.mp4$/);
  await viewer.locator("video").evaluate((video: HTMLVideoElement) => video.dispatchEvent(new Event("waiting")));
  await priya.clock.fastForward(5000);
  await settled(priya);
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await priya.clock.fastForward(1000);
  await expect(size(viewer, "Auto · 720p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(viewer)).toMatch(/\/video-720p\.mp4$/);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a pause during a stall does not step Auto down", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-paused", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { deviceScaleFactor: 3 });
  await addVideo(priya, HEVC_1080);
  await priya.clock.install();
  await priya.reload();
  const viewer = await openVideo(priya);
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await viewer.locator("video").evaluate(async (video: HTMLVideoElement) => {
    video.muted = true;
    await video.play();
    video.dispatchEvent(new Event("waiting"));
    const paused = new Promise((done) => video.addEventListener("pause", done, { once: true }));
    video.pause();
    await paused;
  });
  await priya.clock.fastForward(6000);
  await settled(priya);
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(viewer)).toMatch(/\/video-1080p\.mp4$/);
  // The check is still wired: a wait begun now, while paused, with no pause to end it, steps down.
  await viewer.locator("video").evaluate((video: HTMLVideoElement) => video.dispatchEvent(new Event("waiting")));
  await priya.clock.fastForward(6000);
  await expect(size(viewer, "Auto · 720p")).toHaveAttribute("aria-checked", "true");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("scrubbing does not step Auto down", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-scrub", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { deviceScaleFactor: 3 });
  await addVideo(priya, HEVC_1080);
  const viewer = await openVideo(priya);
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  // A wait for data that a seek causes is no stall; the page is drawn again before it is looked at.
  await viewer.locator("video").evaluate(async (video: HTMLVideoElement) => {
    for (let seek = 0; seek < 3; seek += 1) {
      video.dispatchEvent(new Event("seeking"));
      video.dispatchEvent(new Event("waiting"));
    }
    await new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn)));
  });
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(viewer)).toMatch(/\/video-1080p\.mp4$/);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("M7's remembered choice is read once", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-old", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addVideo(priya, HEVC_1080);
  // M7's lighter copy is Auto now.
  await priya.evaluate(() => localStorage.setItem("openinvites.videoQuality", "copy"));
  await priya.reload();
  let viewer = await openVideo(priya);
  await expect(size(viewer, "Auto · 720p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => storedPick(priya)).toBe("auto");
  expect(await priya.evaluate(() => localStorage.getItem("openinvites.videoQuality"))).toBeNull();

  // M7's original quality stays the original, on a browser told that it decodes HEVC.
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  await context.addInitScript(() => {
    HTMLMediaElement.prototype.canPlayType = () => "probably";
  });
  const mei = await replyGoing(await context.newPage(), host.link, "Mei Lin");
  await mei.evaluate(() => localStorage.setItem("openinvites.videoQuality", "original"));
  await mei.reload();
  viewer = await openVideo(mei);
  await expect(size(viewer, "1080p · Original")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => storedPick(mei)).toBe("original");
  await Promise.all([host.context.close(), priya.context().close(), context.close()]);
});

test("data saver plays the smallest", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-saver", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { deviceScaleFactor: 3 });
  await addVideo(priya, HEVC_1080);
  const viewer = await openVideo(priya);
  await expect(size(viewer, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await priya.context().addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
  });
  await priya.reload();
  await expect(size(await openVideo(priya), "Auto · 720p")).toHaveAttribute("aria-checked", "true");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("an HDR video's original wears the HDR badge", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-hdr", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addVideo(priya, HDR);
  const viewer = await openVideo(priya);
  await expect(sizes(viewer).getByRole("radio")).toHaveText(["Auto · 720p", "1080p · HDR · Original", "1080p", "720p"]);
  await expect(size(viewer, "1080p · HDR · Original").getByText("HDR", { exact: true })).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a browser that refuses storage still plays and keeps the pick for the page", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-sizes-nostore", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { deviceScaleFactor: 3 });
  const clip = readFileSync(HEVC_1080);
  await album(priya).getByLabel("Add photos and videos").setInputFiles([
    { name: "first.mp4", mimeType: "video/mp4", buffer: clip },
    { name: "second.mp4", mimeType: "video/mp4", buffer: clip },
  ]);
  await allSizesMade(priya, 2);
  await priya.context().addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("refused", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("refused", "SecurityError");
    };
  });
  await priya.reload();
  const first = await openVideo(priya, 1, 2);
  await expect(size(first, "Auto · 1080p")).toHaveAttribute("aria-checked", "true");
  await size(first, "720p").click();
  await expect.poll(playing(first)).toMatch(/\/video-720p\.mp4$/);
  await first.getByRole("button", { name: "Next" }).click();
  const second = priya.getByRole("dialog", { name: "Video 2 of 2" });
  await expect(size(second, "720p")).toHaveAttribute("aria-checked", "true");
  await expect.poll(playing(second)).toMatch(/\/video-720p\.mp4$/);
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

// Ticket 11: the size control by keyboard. Headless Chrome cannot play HEVC, which would pass the
// original over; told that it can, every size is offered, and switching needs no decoding.
test("the size control is reached from the player and worked by keyboard", async ({ browser, request }) => {
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-keyboard", PAST);
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  await context.addInitScript(() => {
    HTMLMediaElement.prototype.canPlayType = () => "probably";
  });
  const priya = await replyGoing(await context.newPage(), host.link, "Priya Nair");
  await addVideo(priya, HEVC_1080);
  const viewer = await openVideo(priya);
  const auto = size(viewer, "Auto · 720p");
  await expect(auto).toHaveAttribute("aria-checked", "true");
  await expect(size(viewer, "1080p · Original")).toBeEnabled();
  await expect.poll(playing(viewer)).toMatch(/\/video-720p\.mp4$/);
  await viewer.locator("video").focus();
  await tabUntil(priya, auto);
  for (const [name, file] of [
    ["1080p · Original", /\/video\.mp4$/],
    ["1080p", /\/video-1080p\.mp4$/],
    ["720p", /\/video-720p\.mp4$/],
  ] as const) {
    await priya.keyboard.press("ArrowDown");
    await expect(size(viewer, name)).toHaveAttribute("aria-checked", "true");
    await expect(size(viewer, name)).toBeFocused();
    await expect.poll(playing(viewer)).toMatch(file);
  }
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
  test.setTimeout(SIZES_MS);
  const host = await createPublished(browser, request, "video-zh", PAST);
  const page = await (await browser.newContext({ locale: "zh-TW", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await page.goto(host.link);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await page.getByRole("button", { name: "參加", exact: true }).click();
  await page.getByLabel("你的名字").fill("Priya Nair");
  await page.getByRole("button", { name: "送出回覆" }).click();
  await expect(page.getByText("期待你的到來！")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("dialog", { name: "你的回覆" }).getByRole("button", { name: "關閉" }).click();
  await album(page).getByLabel("新增照片和影片").setInputFiles(HEVC_1080);
  await expect(album(page).getByRole("status").last()).toContainText("clip-hevc-1080p.mp4：已上傳，處理中", { timeout: 30_000 });
  await expect(album(page).locator('li[data-state="processing"]')).toContainText("處理中");
  await allSizesMade(page);
  await album(page).getByRole("button", { name: "Priya Nair 的第 1 段影片" }).click();
  const viewer = page.getByRole("dialog", { name: "第 1 段影片，共 1 項" });
  await expect(viewer.getByRole("link", { name: "下載" })).toBeVisible();
  // The sizes in Traditional Chinese; their names are the same in every language.
  const group = viewer.getByRole("radiogroup", { name: "尺寸" });
  await expect(group.getByRole("radio")).toHaveText(["自動 · 720p", "1080p · 原片", "1080p", "720p"]);
  await expect(group.getByRole("radio", { name: "1080p · 原片" })).toHaveAccessibleDescription("原片：此瀏覽器無法播放。");
  await Promise.all([host.context.close(), page.context().close()]);
});


// Review fix (I4): a reload mid-upload, then the same file picked again: the upload resumes from
// the parts the server has, sending only the rest, not every part again.
test("after a reload, a clip picked again resumes from the parts received", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-resume", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  // Every part from the third fails until the page is reloaded; the browser gives up and keeps the upload's id.
  let blocking = true;
  await priya.route(/\/api\/albums\/[^/]+\/uploads\/[^/?]+\?part=\d+$/, async (route) => {
    const part = Number(new URL(route.request().url()).searchParams.get("part"));
    if (blocking && part >= 2) return route.abort();
    return route.continue();
  });
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  await expect(album(priya).getByRole("status").last()).toContainText("clip-h264.mp4: not fully uploaded", { timeout: 30_000 });
  blocking = false;
  const sent: number[] = [];
  priya.on("request", (request) => {
    const part = new URL(request.url()).searchParams.get("part");
    if (request.method() === "PUT" && part !== null) sent.push(Number(part));
  });
  await priya.reload();
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  await readyTile(priya);
  expect(Math.min(...sent)).toBe(2);
  expect(new Set(sent).size).toBe(sent.length);
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Review fix (M2): a clip the server refuses for its size, the host having lowered the cap under
// what the page knew, names the cap the server applied, not the photos'.
test("a clip refused at the ask for its size names the video cap", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "video-cap-late", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel("Largest video (MB)").fill("1"));
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  await expect(album(priya).getByRole("status").last()).toContainText("clip-h264.mp4: larger than 1 MB: it is 1.3 MB");
  await Promise.all([host.context.close(), priya.context().close()]);
});
