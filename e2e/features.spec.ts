import { readFileSync } from "node:fs";
import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createDraft, editSettings, openSettings, publishInEditor, savedAfter, toEditor } from "./events";
import { dismissOperatorWelcome, newHost, signUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "./test";

// M8 ticket 01: the operator's feature switches on Site settings' Features card. A feature that
// is off is not shown to hosts or guests and its actions refuse; nothing is deleted, and switching
// it back on brings back what it held. Runs against `app-fresh`, with `worker-fresh` processing
// its videos (M7 ticket 08), all recreated first, so the first account here is the operator's,
// who is also the host. Ticket 10 adds Voting's scenario, and ticket 12 votes given while Voting is
// switched off and on.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const H264 = "e2e/fixtures/clip-h264.mp4";
const APPROVE_PHOTOS = "Approve photos before they’re shown";
const PHOTO_TYPES = "image/jpeg,image/png,image/webp,image/avif";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh", "worker-fresh");
});

// The operator, signed up in the first scenario, and the event the videos scenario makes, which
// the last one adds to.
let operator: Page;
let videoEvent: string;

const album = (page: Page) => page.locator('[data-slot="album"]');
const albumGroup = (sheet: Locator) => sheet.getByRole("group", { name: "Album", exact: true });

async function photo(name: string, colour: string) {
  return { name, mimeType: "image/jpeg", buffer: await sharp({ create: { width: 1600, height: 1200, channels: 3, background: colour } }).jpeg().toBuffer() };
}

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

// The album's upload protocol, from a guest's page, as album-upload.spec.ts drives it.
type Api = { base: string; origin: string; request: APIRequestContext };

function apiOf(page: Page, link: string): Api {
  const url = new URL(link, "http://localhost:3002");
  return { base: `${url.origin}/api/albums/${url.pathname.split("/").pop()}/uploads`, origin: url.origin, request: page.request };
}

async function ask(api: Api, files: { name: string; size: number; type: string; durationMs?: number }[]) {
  const response = await api.request.post(api.base, { headers: { origin: api.origin }, data: { files } });
  return { status: response.status(), body: (await response.json().catch(() => ({}))) as { uploads?: { ok: boolean; id?: string; partSize?: number; problem?: string }[]; error?: string } };
}

async function sendPart(api: Api, id: string, part: number, bytes: Buffer) {
  const response = await api.request.put(`${api.base}/${id}?part=${part}`, { headers: { origin: api.origin, "content-type": "application/octet-stream" }, data: bytes });
  return { status: response.status(), body: (await response.json().catch(() => ({}))) as { error?: string } };
}

async function finish(api: Api, id: string) {
  const response = await api.request.post(`${api.base}/${id}/finish`, { headers: { origin: api.origin } });
  return { status: response.status(), body: (await response.json().catch(() => ({}))) as { error?: string } };
}

// Site settings' Features card: one switch set, then saved.
async function switchFeature(page: Page, feature: "Album" | "Videos" | "Voting", on: boolean) {
  await page.goto("/instance");
  const card = page.locator("#features");
  await expect(card.getByRole("heading", { name: "Features" })).toBeVisible();
  await card.getByRole("checkbox", { name: feature, exact: true }).setChecked(on);
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Saved.")).toBeVisible();
}

test("the operator switches the album off: hosts and guests are not shown it, an upload is refused, and switching it on brings back every photo", async ({ browser, request }) => {
  test.slow();
  operator = await (await browser.newContext()).newPage();
  const host = newHost("features");
  await signUp(operator, host);
  await dismissOperatorWelcome(operator);
  await verifyEmail(operator, request, host.email);
  const link = await createDraft(operator, PAST);
  await editSettings(operator, (sheet) => albumGroup(sheet).getByLabel(APPROVE_PHOTOS).check());
  await publishInEditor(operator);

  const priya = await guestGoing(browser, link, "Priya Nair");
  await album(priya).getByLabel(/^Add photos/).setInputFiles([await photo("garden.jpg", "#2f6b3a")]);
  await expect(album(priya).getByRole("status")).toContainText("garden.jpg: added, awaiting approval", { timeout: 20_000 });
  const tile = album(priya).getByRole("button", { name: "Photo 1 by Priya Nair, awaiting approval" });
  await expect(tile).toBeVisible({ timeout: 15_000 });
  const thumb = (await tile.locator("img").getAttribute("src"))!;
  expect(thumb).toMatch(/^\/uploads\/[0-9a-f-]{36}\/photo-thumb\.webp$/);

  await switchFeature(operator, "Album", false);
  await expectNoSeriousViolations(operator, "Site settings with the Features card");

  // Neither the guest nor the host is shown the album, and the guest's next upload is refused.
  await priya.reload();
  await expect(priya.getByRole("heading", { level: 1, name: PAST.title })).toBeVisible();
  await expect(album(priya)).toHaveCount(0);
  await operator.goto(link);
  await expect(operator.getByRole("heading", { level: 1, name: PAST.title })).toBeVisible();
  await expect(album(operator)).toHaveCount(0);
  const refused = await ask(apiOf(priya, link), [{ name: "cake.jpg", size: 1000, type: "image/jpeg" }]);
  expect(refused).toEqual({ status: 409, body: { error: "closed" } });
  // The photo is kept.
  expect((await request.get(thumb)).status()).toBe(200);

  // The host's Settings sheet leaves out the Album group, and the rest still saves.
  await toEditor(operator);
  await editSettings(operator, async (sheet) => {
    await expect(sheet.getByRole("group", { name: "Guests", exact: true })).toBeVisible();
    await expect(albumGroup(sheet)).toHaveCount(0);
    await sheet.getByLabel("Plus-ones per guest").selectOption("2");
  });

  // Switched on again, the photo is back, still waiting, and so is the event's approval.
  await switchFeature(operator, "Album", true);
  await priya.reload();
  await expect(album(priya).getByRole("button", { name: "Photo 1 by Priya Nair, awaiting approval" })).toBeVisible();
  await toEditor(operator);
  const sheet = await openSettings(operator);
  await expect(albumGroup(sheet).getByLabel(APPROVE_PHOTOS)).toBeChecked();
  await expect(sheet.getByLabel("Plus-ones per guest")).toHaveValue("2");
  await priya.context().close();
});

test("with videos off, an album takes photos only, a video is refused, and a video already added still plays", async ({ browser }) => {
  // The worker takes the clip at its next minute, on top of the upload.
  test.setTimeout(240_000);
  videoEvent = await createDraft(operator, { ...PAST, title: "Ada’s picnic" });
  await publishInEditor(operator);

  const priya = await guestGoing(browser, videoEvent, "Priya Nair");
  await album(priya).getByLabel("Add photos and videos").setInputFiles(H264);
  const ready = album(priya).locator('li[data-item="video"][data-state="ready"]');
  await expect(ready).toBeVisible({ timeout: 90_000 });

  await switchFeature(operator, "Videos", false);

  // The album takes photos only, and a video asked for anyway is refused.
  await priya.reload();
  const picker = album(priya).getByLabel("Add photos", { exact: true });
  await expect(picker).toBeAttached();
  await expect(picker).toHaveAttribute("accept", PHOTO_TYPES);
  await expect(album(priya).getByLabel("Add photos and videos")).toHaveCount(0);
  const clip = readFileSync(H264);
  const refused = await ask(apiOf(priya, videoEvent), [{ name: "clip-h264.mp4", size: clip.length, type: "video/mp4", durationMs: 4000 }]);
  expect(refused.status).toBe(200);
  expect(refused.body.uploads).toEqual([expect.objectContaining({ ok: false, problem: "videosNotAllowed" })]);

  // The video already added still plays.
  await ready.getByRole("button", { name: "Video 1 by Priya Nair" }).click();
  const viewer = priya.getByRole("dialog", { name: "Video 1 of 1" });
  await expect(viewer).toBeVisible();
  await expect.poll(() => viewer.locator("video").evaluate((video: HTMLVideoElement) => video.currentSrc)).toMatch(/\/video\.mp4$/);
  await priya.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // The host's sheet keeps the album's group but leaves out the videos'.
  await toEditor(operator);
  const sheet = await openSettings(operator);
  await expect(albumGroup(sheet).getByLabel(APPROVE_PHOTOS)).toBeVisible();
  await expect(sheet.getByLabel("Allow videos")).toHaveCount(0);

  await switchFeature(operator, "Videos", true);
  await priya.reload();
  await expect(album(priya).getByLabel("Add photos and videos")).toBeAttached();
  await priya.context().close();
});

// Review Focus 1: the Album switched off between two parts of a guest's upload.
test("the Album switched off while an upload is half sent: the next part and the finish are refused, nothing in the album is deleted, and with it on again a new upload is accepted", async ({ browser, request }) => {
  test.slow();
  const mei = await guestGoing(browser, videoEvent, "Mei Tan");
  const api = apiOf(mei, videoEvent);
  const kept = await mei.locator('li[data-item="video"][data-state="ready"] img').first().getAttribute("src");
  // A photo of two parts, as the site's 5 MB parts cut it; the bytes are never looked at, since
  // the finish that would judge them is refused.
  const size = 6 * 1024 * 1024;
  const asked = await ask(api, [{ name: "big.jpg", size, type: "image/jpeg" }]);
  expect(asked.status).toBe(200);
  const [planned] = asked.body.uploads!;
  expect(planned.ok).toBe(true);
  const partSize = planned.partSize!;
  expect(partSize).toBeLessThan(size);
  expect((await sendPart(api, planned.id!, 0, Buffer.alloc(partSize, 7))).status).toBe(200);

  await switchFeature(operator, "Album", false);
  expect(await sendPart(api, planned.id!, 1, Buffer.alloc(size - partSize, 7))).toEqual({ status: 409, body: { error: "closed" } });
  expect(await finish(api, planned.id!)).toEqual({ status: 409, body: { error: "closed" } });

  await switchFeature(operator, "Album", true);
  await mei.reload();
  await expect(album(mei).locator('li[data-item="video"][data-state="ready"]')).toBeVisible();
  expect((await request.get(kept!)).status()).toBe(200);
  const again = await ask(api, [{ name: "cake.jpg", size: 1000, type: "image/jpeg" }]);
  expect(again.status).toBe(200);
  expect(again.body.uploads).toEqual([expect.objectContaining({ ok: true })]);
  await mei.context().close();
});

// M8 ticket 10: the album vote's block in the editor's Settings follows the Voting switch, and the
// Album's, which Voting needs; a vote started is still open when they are back on.
test("with Voting off, no event shows the Voting block; with the Album off, neither; switched back on, the block returns with its vote still open", async () => {
  const block = (sheet: Locator) => sheet.locator('[data-slot="voting-block"]');
  await toEditor(operator);
  let sheet = await openSettings(operator);
  await savedAfter(operator, () => block(sheet).getByRole("button", { name: "Start voting" }).click());
  await expect(block(sheet)).toHaveAttribute("data-state", "open");

  await switchFeature(operator, "Voting", false);
  await toEditor(operator);
  sheet = await openSettings(operator);
  await expect(albumGroup(sheet)).toBeVisible();
  await expect(block(sheet)).toHaveCount(0);

  await switchFeature(operator, "Voting", true);
  await switchFeature(operator, "Album", false);
  await toEditor(operator);
  sheet = await openSettings(operator);
  await expect(sheet.getByRole("group", { name: "Guests", exact: true })).toBeVisible();
  await expect(block(sheet)).toHaveCount(0);

  await switchFeature(operator, "Album", true);
  await toEditor(operator);
  sheet = await openSettings(operator);
  await expect(block(sheet)).toHaveAttribute("data-state", "open");
  await expect(block(sheet)).toContainText("Voting is open");
});

// M8 ticket 12, and Review Focus 6: Voting switched off during an open vote set to Never. The
// vote is the one the scenario above left open on the videos scenario's event, whose one item is
// Priya's video.
test("Voting switched off during an open vote: a page left open has its vote refused, the album shows no star and names as before 0.8; switched on again, the vote is open with its vote, and names are hidden again", async ({ browser }) => {
  test.slow();
  const block = (sheet: Locator) => sheet.locator('[data-slot="voting-block"]');
  await operator.reload();
  const names = (await openSettings(operator)).getByRole("group", { name: "Who added each item" });
  await savedAfter(operator, () => names.getByLabel("Never shown to guests").check());

  const ana = await guestGoing(browser, videoEvent, "Ana Ruiz");
  // A video's thumbnail is named with its length after its label ("Video 1 0:04"); its star by the
  // label alone.
  const star = album(ana).getByRole("button", { name: "Vote for Video 1", exact: true });
  const unnamed = album(ana).getByRole("button", { name: /^Video 1 \d/ });
  const answered = () => ana.waitForResponse((response) => response.request().method() === "POST" && response.request().headers()["next-action"] !== undefined);
  let answer = answered();
  await star.click();
  await answer;
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await expect(unnamed).toBeVisible();

  await switchFeature(operator, "Voting", false);
  // The page left open: taking the vote back is refused, and the vote stays as it was.
  answer = answered();
  await star.click();
  await answer;
  await expect(album(ana).locator('[data-slot="album-voting"]').getByRole("alert")).toHaveText("Voting has closed.");
  await expect(star).toHaveAttribute("aria-pressed", "true");
  // Reloaded: no vote at all, and the name shows, as before 0.8.
  await ana.reload();
  await expect(album(ana).getByRole("button", { name: /^Video 1 by Priya Nair/ })).toBeVisible();
  await expect(album(ana).locator('[data-slot="album-voting"]')).toHaveCount(0);
  await expect(album(ana).locator('[data-slot="vote-star"]')).toHaveCount(0);

  await switchFeature(operator, "Voting", true);
  await ana.reload();
  await expect(album(ana).locator('[data-slot="album-voting"]')).toContainText("Voting is open");
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await expect(unnamed).toBeVisible();
  await toEditor(operator);
  await expect(block(await openSettings(operator))).toHaveAttribute("data-state", "open");
  await ana.context().close();
  await operator.context().close();
});
