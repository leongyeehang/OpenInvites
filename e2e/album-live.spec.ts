import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings } from "./events";
import { closeReply } from "./reply";
import { expectStill } from "./still";
import { clientAddress, expect, test, type Browser, type BrowserContextOptions, type Locator, type Page } from "./test";

// M8 ticket 08: an Android motion photo is added as a live photo: a photo everywhere, which keeps
// a few seconds of its motion, made by the video queue, wears a Live mark, and plays while held or
// once from its mark, never by itself; under reduced motion only from the mark. An iPhone guest is
// told what becomes of a Live Photo.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const MOTION_PHOTO = "e2e/fixtures/motion-photo.jpg";
const APPROVE_PHOTOS = "Approve photos before they’re shown";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const NOTE = "On an iPhone, a Live Photo is added as a photo. To keep its motion, choose Save as Video on it in Photos and add the video.";
const SHORT_NOTE = "On an iPhone, a Live Photo is added as a photo, without its motion.";

// The motion waits its turn in the queue behind every video the other specs keep sending.
const MOTION_MS = 150_000;

async function guestGoing(browser: Browser, link: string, name: string, options: BrowserContextOptions = {}): Promise<Page> {
  const page = await (await browser.newContext({ ...options, extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
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
const motionOf = (viewer: Locator) => viewer.locator('[data-slot="live-motion"]');
const pictureOf = (viewer: Locator) => viewer.locator("[data-hold]");
const playButton = (viewer: Locator) => viewer.getByRole("button", { name: "Play live photo" });

// Adds the motion photo and waits, without a reload, for its tile to wear the Live mark.
async function addLivePhoto(page: Page, status = "motion-photo.jpg: added"): Promise<void> {
  await album(page).getByLabel(/^Add photos/).setInputFiles(MOTION_PHOTO);
  await expect(album(page).getByRole("status")).toHaveText(status, { timeout: 20_000 });
  await expectLiveTile(page);
}

async function expectLiveTile(page: Page): Promise<void> {
  const mark = album(page).locator('li[data-item="photo"] [data-slot="live-mark"]');
  await expect(mark).toHaveText("Live", { timeout: MOTION_MS });
}

async function openPhoto(page: Page): Promise<Locator> {
  await album(page).getByRole("button", { name: /^Photo 1 by Priya Nair/ }).click();
  const viewer = page.getByRole("dialog", { name: "Photo 1 of 1" });
  await expect(viewer).toBeVisible();
  return viewer;
}

// Whether the page holds back the browser's menu for the picture: a cancelable contextmenu event,
// as a right-click or a long press sends, comes back default-prevented.
const menuPrevented = (picture: Locator) =>
  picture.evaluate((element) => {
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    element.querySelector("img")!.dispatchEvent(menu);
    return menu.defaultPrevented;
  });

const paused = (motion: Locator) => motion.evaluate((video: HTMLVideoElement) => video.paused);

test("a motion photo is added as a live photo, wears the Live mark and plays when pressed", async ({ browser, request }) => {
  test.setTimeout(MOTION_MS + 120_000);
  const host = await createPublished(browser, request, "live-photo", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addLivePhoto(priya);
  await expectNoSeriousViolations(priya, "the album with a live photo's tile");

  const viewer = await openPhoto(priya);
  const motion = motionOf(viewer);
  const play = playButton(viewer);
  // Nothing plays when the viewer opens.
  await expect(motion).toBeHidden();
  expect(await paused(motion)).toBe(true);
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expectNoSeriousViolations(priya, "the viewer of a live photo", { except: ["video-caption"] });

  // The mark plays it once, muted, from its own file, and the still is back at its end.
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect(motion).toBeVisible();
  expect(await paused(motion)).toBe(false);
  expect(await motion.evaluate((video: HTMLVideoElement) => video.muted)).toBe(true);
  expect(await motion.evaluate((video: HTMLVideoElement) => video.currentSrc)).toMatch(/\/motion\.mp4$/);
  await expect(play).toHaveAttribute("aria-pressed", "false", { timeout: 15_000 });
  await expect(motion).toBeHidden();

  // By keyboard (M8 ticket 09): Enter plays it, Space stops it, and Space plays it again.
  await play.focus();
  await priya.keyboard.press("Enter");
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect(motion).toBeVisible();
  await priya.keyboard.press("Space");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(motion).toBeHidden();
  await priya.keyboard.press("Space");
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect(play).toHaveAttribute("aria-pressed", "false", { timeout: 15_000 });
  await expect(play).toBeFocused();

  // The picture's menu is the browser's, so a right-click can save it.
  expect(await menuPrevented(pictureOf(viewer))).toBe(false);

  // Held, it plays until let go; during the hold its menu is held back, since Android's long press
  // would open it and end the hold.
  const box = (await pictureOf(viewer).boundingBox())!;
  await priya.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await priya.mouse.down();
  await expect(motion).toBeVisible();
  expect(await paused(motion)).toBe(false);
  expect(await menuPrevented(pictureOf(viewer))).toBe(true);
  await priya.mouse.up();
  await expect(motion).toBeHidden();
  expect(await paused(motion)).toBe(true);
  expect(await menuPrevented(pictureOf(viewer))).toBe(false);

  // A hold whose lifted pointer is never heard ends when the window loses focus, or the page is hidden.
  await priya.mouse.down();
  await expect(motion).toBeVisible();
  await priya.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(motion).toBeHidden();
  expect(await paused(motion)).toBe(true);
  await priya.mouse.up();
  await priya.mouse.down();
  await expect(motion).toBeVisible();
  await priya.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(motion).toBeHidden();
  expect(await paused(motion)).toBe(true);
  await priya.mouse.up();
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a live photo stays a photo", async ({ browser, request }) => {
  test.setTimeout(MOTION_MS + 120_000);
  const host = await createPublished(browser, request, "live-photo-approval", PAST);
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel(APPROVE_PHOTOS).check());
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addLivePhoto(priya, "motion-photo.jpg: added, awaiting approval");

  // Waiting for the host as any photo does, which the host approves as a photo.
  await host.page.goto(host.link);
  await expectLiveTile(host.page);
  const approve = album(host.page).getByRole("button", { name: "Approve photo 1 by Priya Nair", exact: true });
  await expect(approve).toBeVisible();
  await approve.click();
  await expect(approve).toHaveCount(0);

  // Counted as a photo for a visitor.
  const visitor = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await visitor.goto(host.link);
  await expect(album(visitor)).toContainText("1 photo");
  await Promise.all([host.context.close(), priya.context().close(), visitor.context().close()]);
});

test("under reduced motion only the button plays it", async ({ browser, request }) => {
  test.setTimeout(MOTION_MS + 120_000);
  const host = await createPublished(browser, request, "live-photo-still", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair", { reducedMotion: "reduce" });
  await addLivePhoto(priya);
  const viewer = await openPhoto(priya);
  await expect(pictureOf(viewer)).toHaveAttribute("data-hold", "off");
  await expect(motionOf(viewer)).toBeHidden();
  await expectStill(priya, "the viewer of a live photo");
  await playButton(viewer).click();
  await expect(motionOf(viewer)).toBeVisible();
  expect(await paused(motionOf(viewer))).toBe(false);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("an iPhone guest is told what becomes of a Live Photo", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "live-photo-iphone", PAST);
  const iphone = await guestGoing(browser, host.link, "Priya Nair", { userAgent: IPHONE });
  await expect(album(iphone).getByText(NOTE)).toBeVisible();
  await expect(album(iphone).getByLabel(/^Add photos/)).toHaveAccessibleDescription(new RegExp(`${NOTE.replace(/[.]/g, "\\.")}$`));

  // Where the event takes no videos, Save as Video is not suggested.
  await editSettings(host.page, (sheet) => albumGroup(sheet).getByLabel("Allow videos").uncheck());
  await iphone.reload();
  await expect(album(iphone).getByText(SHORT_NOTE)).toBeVisible();
  await expect(album(iphone).getByText(NOTE)).toHaveCount(0);

  const other = await guestGoing(browser, host.link, "Mei Tan");
  await expect(album(other).getByLabel(/^Add photos/)).toBeAttached();
  await expect(album(other).getByText(/Live Photo/)).toHaveCount(0);
  await Promise.all([host.context.close(), iphone.context().close(), other.context().close()]);
});
