import { expectNoSeriousViolations } from "./axe";
import { createDraft, editSettings, publishInEditor, toEditor } from "./events";
import { dismissOperatorWelcome, newHost, signUp, verifyEmail } from "./hosts";
import { probeServed, recreate } from "./instances";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "./test";

// M8 ticket 04: the operator's side of the sizes. With the Storage card's 4K switch on, a 4K clip
// that is not H.264 also gets a 4K H.264 copy, made once the item is ready; and Make missing sizes
// gives a ready video a size its event asks for since it was processed, while it stays in the
// album. Runs against `app-fresh`, which queues each clip, and `worker-fresh`, which processes it
// at its next minute (M7 ticket 08), all recreated first, so the first account here is the
// operator's, who is also the host.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const FOUR_K = "Also make a 4K copy that plays everywhere";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh", "worker-fresh");
});

// The operator, signed up in the first scenario, who hosts the events of both.
let operator: Page;

test.afterAll(async () => {
  await operator?.context().close();
});

const album = (page: Page) => page.locator('[data-slot="album"]');
const readyVideo = (page: Page) => album(page).locator('li[data-item="video"][data-state="ready"]');

// A guest of their own, on an address of their own (the upload limit counts per address), Going.
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

// Where a ready tile's files are served, read from its thumbnail.
async function filesOf(tile: Locator): Promise<string> {
  const thumb = await tile.locator("img").getAttribute("src");
  expect(thumb).toMatch(/^\/uploads\/[0-9a-f-]{36}\/video-thumb\.webp$/);
  return thumb!.replace(/\/video-thumb\.webp$/, "");
}

// A file the route serves once the worker has stored it.
async function servedWithin(request: APIRequestContext, url: string, ms: number): Promise<Buffer> {
  await expect.poll(async () => (await request.get(url)).status(), { timeout: ms, intervals: [2000], message: `${url} served` }).toBe(200);
  return (await request.get(url)).body();
}

// The event's Video sizes, in the host's Settings sheet.
const videoSize = (sheet: Locator, size: "1080p" | "720p") => sheet.getByRole("group", { name: "Album", exact: true }).getByRole("group", { name: "Video sizes" }).getByLabel(size, { exact: true });

test("with the 4K switch on, a 4K HEVC clip gets a 4K copy that plays everywhere once it is ready", async ({ browser, request }) => {
  // The worker takes the clip at its next minute, then makes its sizes one at a time.
  test.setTimeout(480_000);
  operator = await (await browser.newContext()).newPage();
  const host = newHost("video-sizes");
  await signUp(operator, host);
  await dismissOperatorWelcome(operator);
  await verifyEmail(operator, request, host.email);

  await operator.goto("/instance");
  const card = operator.locator("#storage");
  const form = card.locator("form").filter({ hasText: FOUR_K });
  await expect(card.getByLabel(FOUR_K)).not.toBeChecked();
  await card.getByLabel(FOUR_K).check();
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved.")).toBeVisible();

  const link = await createDraft(operator, PAST);
  await publishInEditor(operator);
  const priya = await guestGoing(browser, link, "Priya Nair");
  await album(priya).getByLabel("Add photos and videos").setInputFiles("e2e/fixtures/clip-hevc-4k.mp4");
  const tile = readyVideo(priya);
  await expect(tile).toBeVisible({ timeout: 150_000 });
  // Ready with the 1080p copy it needs to play; the 4K copy is never made before that one.
  const files = await filesOf(tile);
  expect((await request.get(`${files}/video-1080p.mp4`)).status()).toBe(200);
  await servedWithin(request, `${files}/video-720p.mp4`, 240_000);
  const fourK = await servedWithin(request, `${files}/video-2160p.mp4`, 240_000);
  expect(probeServed(fourK, "app-fresh")).toMatchObject({ codec_name: "h264", width: 3840, height: 2160 });
  await priya.context().close();
});

test("Make missing sizes gives a video the size its event now asks for, and it stays in the album meanwhile", async ({ browser, request }) => {
  test.setTimeout(480_000);
  const link = await createDraft(operator, { ...PAST, title: "Ada’s picnic" });
  await editSettings(operator, (sheet) => videoSize(sheet, "720p").uncheck());
  await publishInEditor(operator);

  const mei = await guestGoing(browser, link, "Mei Tan");
  await album(mei).getByLabel("Add photos and videos").setInputFiles("e2e/fixtures/clip-hevc-1080p.mp4");
  const tile = readyVideo(mei);
  await expect(tile).toBeVisible({ timeout: 150_000 });
  const files = await filesOf(tile);
  expect((await request.get(`${files}/video-1080p.mp4`)).status()).toBe(200);
  expect((await request.get(`${files}/video-720p.mp4`)).status()).toBe(404);

  // The host asks for 720p again: only what is processed afterwards would get it, until the
  // operator makes the missing sizes.
  await toEditor(operator);
  await editSettings(operator, (sheet) => videoSize(sheet, "720p").check());
  await operator.goto("/instance");
  const card = operator.locator("#storage");
  await expect(card.getByText("1 video lacks a size its event asks for.")).toBeVisible();
  const make = card.getByRole("button", { name: "Make missing sizes" });
  await expect(make).toBeVisible();
  await expectNoSeriousViolations(operator, "Site settings with Make missing sizes");
  await make.click();
  await expect(card.getByRole("status").filter({ hasText: "1 video queued." })).toBeVisible();

  await mei.reload();
  await expect(readyVideo(mei)).toBeVisible();
  await servedWithin(request, `${files}/video-720p.mp4`, 150_000);
  await expect.poll(
    async () => {
      await operator.reload();
      return card.getByText("Every video has the sizes its event asks for.").isVisible();
    },
    { timeout: 30_000, intervals: [2000], message: "the card counts no video lacking a size" },
  ).toBe(true);
  await mei.context().close();
});
