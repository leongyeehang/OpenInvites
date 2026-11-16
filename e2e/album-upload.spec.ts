import { readFileSync } from "node:fs";
import sharp from "sharp";
import { createPublished, editSettings } from "./events";
import { probeServed, probeServedTags } from "./instances";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// M7 ticket 06: the upload protocol and the processing queue, driven at the API from a guest's
// page (its cookies ride along, and the origin header is sent as a browser sends it). The tiles
// and the player are ticket 07's; here the files a video becomes are what is looked at.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const H264 = readFileSync("e2e/fixtures/clip-h264.mp4");
const HEVC = readFileSync("e2e/fixtures/clip-hevc.mov");
const HEVC_1080 = readFileSync("e2e/fixtures/clip-hevc-1080p.mp4");
const HDR = readFileSync("e2e/fixtures/clip-hdr.mp4");
const LONG = readFileSync("e2e/fixtures/clip-long.mp4");
// clip-hevc-1080p.mp4 and a motion photo's clip with a phone's tags (fixtures/README.md).
const HEVC_TAGGED = readFileSync("e2e/fixtures/clip-hevc-tagged.mov");
const MOTION_TAGGED = readFileSync("e2e/fixtures/motion-photo-tagged.jpg");
const TEST_PART = 65536;

// A guest of their own, on an address of their own (the upload limit counts per address).
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

type Api = { base: string; origin: string; request: APIRequestContext };

function apiOf(page: Page, link: string): Api {
  const url = new URL(link);
  return { base: `${url.origin}/api/albums/${url.pathname.split("/").pop()}/uploads`, origin: url.origin, request: page.request };
}

type AskFile = { name: string; size: number; type: string; durationMs?: number };

async function ask(api: Api, files: AskFile[]) {
  const response = await api.request.post(api.base, { headers: { origin: api.origin }, data: { files } });
  return { status: response.status(), body: (await response.json().catch(() => ({}))) as { uploads?: { ok: boolean; id?: string; partSize?: number; problem?: string }[]; error?: string } };
}

async function sendParts(api: Api, id: string, partSize: number, bytes: Buffer, upTo = Infinity): Promise<number> {
  const parts = Math.max(1, Math.ceil(bytes.length / partSize));
  for (let part = 0; part < Math.min(parts, upTo); part += 1) {
    const response = await api.request.put(`${api.base}/${id}?part=${part}`, { headers: { origin: api.origin, "content-type": "application/octet-stream" }, data: bytes.subarray(part * partSize, (part + 1) * partSize) });
    expect(response.status()).toBe(200);
  }
  return parts;
}

async function finish(api: Api, id: string) {
  const response = await api.request.post(`${api.base}/${id}/finish`, { headers: { origin: api.origin } });
  return { status: response.status(), body: (await response.json().catch(() => ({}))) as { ok?: boolean; item?: { id: string; kind: string; state: string }; problem?: string } };
}

// A file the route serves once processing stored it; processing waits for the queue's turn.
async function servedWithin(request: APIRequestContext, url: string, ms: number): Promise<Buffer> {
  await expect.poll(async () => (await request.get(url)).status(), { timeout: ms, intervals: [2000], message: `${url} served` }).toBe(200);
  return (await request.get(url)).body();
}

async function uploadWhole(api: Api, name: string, type: string, bytes: Buffer, durationMs?: number) {
  const asked = await ask(api, [{ name, size: bytes.length, type, durationMs }]);
  expect(asked.status).toBe(200);
  const [planned] = asked.body.uploads!;
  expect(planned.ok).toBe(true);
  expect(planned.partSize).toBe(TEST_PART);
  const parts = await sendParts(api, planned.id!, planned.partSize!, bytes);
  const done = await finish(api, planned.id!);
  expect(done.status).toBe(200);
  return { parts, item: done.body.item! };
}

test("an H.264 clip goes up in parts, is finished, processed, and served at original quality with no copy", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-api", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);
  const { parts, item } = await uploadWhole(api, "clip-h264.mp4", "video/mp4", H264, 4000);
  expect(parts).toBeGreaterThan(3);
  expect(item).toMatchObject({ kind: "video", state: "processing" });
  const files = `${api.origin}/uploads/${item.id}`;
  const original = await servedWithin(request, `${files}/video.mp4`, 90_000);
  expect(original.length).toBeGreaterThan(100_000);
  expect((await request.get(`${files}/video-poster.webp`)).status()).toBe(200);
  expect((await request.get(`${files}/video-thumb.webp`)).status()).toBe(200);
  // The clip as sent is never served, and an H.264 clip at 640x480 needs no lighter copy.
  expect((await request.get(`${files}/video-sent`)).status()).toBe(404);
  expect((await request.get(`${files}/video-1080p.mp4`)).status()).toBe(404);
  expect((await request.get(`${files}/video-720p.mp4`)).status()).toBe(404);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("an HEVC clip held portrait gets a lighter copy, an upright poster, and loses its location", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-hevc", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);
  expect(HEVC.includes("+35.6895+139.6917")).toBe(true);
  const { item } = await uploadWhole(api, "clip-hevc.mov", "video/quicktime", HEVC);
  const files = `${api.origin}/uploads/${item.id}`;
  const copy = await servedWithin(request, `${files}/video-1080p.mp4`, 120_000);
  expect(copy.length).toBeGreaterThan(10_000);
  const original = await servedWithin(request, `${files}/video.mp4`, 30_000);
  // M8 ticket 03: a 720p copy of a 640x480 clip would be 480 on its short side, as the 1080p one is.
  expect((await request.get(`${files}/video-720p.mp4`)).status()).toBe(404);
  expect(original.includes("+35.6895+139.6917")).toBe(false);
  expect(original.includes("6895")).toBe(false);
  // The poster is made from the stored original, so it is stored after it: waited for, not read
  // at once (M8 ticket 09, a flake of the media pass).
  const poster = await sharp(await servedWithin(request, `${files}/video-poster.webp`, 30_000)).metadata();
  expect(poster.height!).toBeGreaterThan(poster.width!);
  await Promise.all([host.context.close(), priya.context().close()]);
});

// The whole-branch review, finding 4: what guests are told the stored files keep is nothing of the
// phone's. A copy made from the clip as sent, one made from the stored original, the original
// itself, and a live photo's motion carry no tag beyond the container's own: no location, make,
// model or creation time, and no Apple or Android key.
const CONTAINER_TAGS = new Set(["major_brand", "minor_version", "compatible_brands", "encoder", "handler_name", "vendor_id", "language"]);

// Where both tagged fixtures say they were taken, as their own bytes spell it.
const FIXTURE_LOCATION = "+35.6895+139.6917";

function expectNoPhoneTags(bytes: Buffer, file: string) {
  const { format, streams } = probeServedTags(bytes);
  // The probe read the file: every MP4 names its brand.
  expect(format.major_brand, file).toBeTruthy();
  for (const tags of [format, ...streams]) expect(Object.keys(tags).filter((key) => !CONTAINER_TAGS.has(key)), file).toEqual([]);
  // Nor anywhere else in the file, outside any tag the probe reads (the last review, minor 5).
  expect(bytes.includes(FIXTURE_LOCATION), file).toBe(false);
}

test("a video's copies, its original and a live photo's motion keep no tag of the phone's", async ({ browser, request }) => {
  test.setTimeout(360_000);
  expect(HEVC_TAGGED.includes("com.apple.quicktime.model")).toBe(true);
  expect(HEVC_TAGGED.includes(FIXTURE_LOCATION)).toBe(true);
  expect(MOTION_TAGGED.includes("com.android.model")).toBe(true);
  expect(MOTION_TAGGED.includes(FIXTURE_LOCATION)).toBe(true);
  const host = await createPublished(browser, request, "video-tags", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);
  const clip = await uploadWhole(api, "clip-hevc-tagged.mov", "video/quicktime", HEVC_TAGGED, 2000);
  const files = `${api.origin}/uploads/${clip.item.id}`;
  // The 1080p copy is made from the clip as sent, the 720p one after it from the stored original.
  expectNoPhoneTags(await servedWithin(request, `${files}/video-1080p.mp4`, 120_000), "video-1080p.mp4");
  expectNoPhoneTags(await servedWithin(request, `${files}/video.mp4`, 30_000), "video.mp4");
  expectNoPhoneTags(await servedWithin(request, `${files}/video-720p.mp4`, 120_000), "video-720p.mp4");

  const live = await uploadWhole(api, "motion-photo-tagged.jpg", "image/jpeg", MOTION_TAGGED);
  expect(live.item).toMatchObject({ kind: "photo" });
  expectNoPhoneTags(await servedWithin(request, `${api.origin}/uploads/${live.item.id}/motion.mp4`, 150_000), "motion.mp4");
  await Promise.all([host.context.close(), priya.context().close()]);
});

// M8 ticket 03: a video is ready once it plays everywhere, with the one copy an HEVC original
// needs; the event's other sizes follow from the stored original.
test("a 1080p HEVC clip is ready with its 1080p copy, and its 720p copy follows", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-sizes", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);
  const { item } = await uploadWhole(api, "clip-hevc-1080p.mp4", "video/mp4", HEVC_1080, 2000);
  const files = `${api.origin}/uploads/${item.id}`;
  await servedWithin(request, `${files}/video.mp4`, 120_000);
  const large = await request.get(`${files}/video-1080p.mp4`);
  expect(large.status()).toBe(200);
  const small = await servedWithin(request, `${files}/video-720p.mp4`, 120_000);
  expect(probeServed(await large.body())).toMatchObject({ codec_name: "h264", width: 1920, height: 1080 });
  expect(probeServed(small)).toMatchObject({ codec_name: "h264", width: 1280, height: 720 });
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("an event that asks for 720p only gives a 1080p HEVC clip a 720p copy and no 1080p one", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-720", PAST);
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByRole("group", { name: "Video sizes" }).getByLabel("1080p", { exact: true }).uncheck());
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);
  const { item } = await uploadWhole(api, "clip-hevc-1080p.mp4", "video/mp4", HEVC_1080, 2000);
  const files = `${api.origin}/uploads/${item.id}`;
  await servedWithin(request, `${files}/video.mp4`, 120_000);
  expect((await request.get(`${files}/video-720p.mp4`)).status()).toBe(200);
  expect((await request.get(`${files}/video-1080p.mp4`)).status()).toBe(404);
  await Promise.all([host.context.close(), priya.context().close()]);
});

// M8 ticket 05: an HDR original keeps its HDR, and its copies are tone-mapped to standard colour.
test("an HDR clip keeps HLG in its original, and its copies come out in standard colour", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-hdr", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);
  const { item } = await uploadWhole(api, "clip-hdr.mp4", "video/mp4", HDR, 2000);
  const files = `${api.origin}/uploads/${item.id}`;
  const original = await servedWithin(request, `${files}/video.mp4`, 120_000);
  expect(probeServed(original)).toMatchObject({ color_transfer: "arib-std-b67", color_primaries: "bt2020" });
  const standard = { codec_name: "h264", pix_fmt: "yuv420p", color_transfer: "bt709", color_primaries: "bt709" };
  const large = await request.get(`${files}/video-1080p.mp4`);
  expect(large.status()).toBe(200);
  expect(probeServed(await large.body())).toMatchObject(standard);
  expect(probeServed(await servedWithin(request, `${files}/video-720p.mp4`, 120_000))).toMatchObject(standard);
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a finish before every part is refused, a clip over the length cap and a video on an event that takes none are refused at the ask, and a cap lowered after an ask refuses only the next", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-caps", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);

  // Half the parts, then the finish: refused, and the upload stays to be resumed. Which parts
  // arrived is asked with a plain GET, as a browser sends one, with no origin header.
  const asked = await ask(api, [{ name: "clip-h264.mp4", size: H264.length, type: "video/mp4", durationMs: 4000 }]);
  const [planned] = asked.body.uploads!;
  // A part shorter than its share is refused and not counted (review fix M4).
  const short = await api.request.put(`${api.base}/${planned.id}?part=0`, { headers: { origin: api.origin, "content-type": "application/octet-stream" }, data: H264.subarray(0, TEST_PART / 2) });
  expect(short.status()).toBe(400);
  expect(await (await api.request.get(`${api.base}/${planned.id}`)).json()).toEqual({ received: [] });
  await sendParts(api, planned.id!, planned.partSize!, H264, 2);
  const early = await finish(api, planned.id!);
  expect(early).toMatchObject({ status: 400, body: { ok: false, problem: "incomplete" } });
  const received = await api.request.get(`${api.base}/${planned.id}`);
  expect(received.status()).toBe(200);
  expect(await received.json()).toEqual({ received: [0, 1] });

  // Review Focus 1: the host lowers Largest video below the clip while its upload is reserved; the
  // rest of the parts and the finish still go through, and the next ask for the same clip is refused.
  expect(H264.length).toBeGreaterThan(1024 * 1024);
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Largest video (MB)").fill("1"));
  await sendParts(api, planned.id!, planned.partSize!, H264);
  const late = await finish(api, planned.id!);
  expect(late.status).toBe(200);
  const refused = await ask(api, [{ name: "clip-h264.mp4", size: H264.length, type: "video/mp4", durationMs: 4000 }]);
  // The refusal carries the cap the server applied, in bytes, for the page to name (review fix M2).
  expect(refused.body.uploads![0]).toMatchObject({ ok: false, problem: "tooLarge", max: 1024 * 1024 });

  // Over the length cap, judged from the length the browser read. Every ask counts against the
  // upload limit, refused files or not, so a second guest, on an address of their own, asks.
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  const second = apiOf(mei, host.link);
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Longest video (min)").fill("1"));
  const long = await ask(second, [{ name: "clip-long.mp4", size: LONG.length, type: "video/mp4", durationMs: 61_000 }]);
  expect(long.body.uploads![0]).toMatchObject({ ok: false, problem: "tooLong" });

  // An event that takes no videos.
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Allow videos").uncheck());
  const none = await ask(second, [{ name: "clip-h264.mp4", size: 1000, type: "video/mp4", durationMs: 4000 }]);
  expect(none.body.uploads![0]).toMatchObject({ ok: false, problem: "videosNotAllowed" });
  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

test("the ask counts once against the upload limit, whatever the parts", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "video-limit", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const api = apiOf(priya, host.link);
  // The test profile allows three uploads a minute per address: three asks, then "too fast".
  for (let round = 0; round < 3; round += 1) {
    expect((await ask(api, [{ name: `${round}.jpg`, size: 1000, type: "image/jpeg" }])).status).toBe(200);
  }
  const fourth = await ask(api, [{ name: "4.jpg", size: 1000, type: "image/jpeg" }]);
  expect(fourth).toMatchObject({ status: 429, body: { error: "tooFast" } });
  await Promise.all([host.context.close(), priya.context().close()]);
});

// Review Focus 2: a clip whose length the browser could not read is asked for without one, sent
// whole, and judged once probed: over the length cap, it is failed at once, and its tile says why.
test("a clip whose length the browser could not read is failed once probed, and its tile says why", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "video-unread", PAST);
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Longest video (min)").fill("1"));
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const { item } = await uploadWhole(apiOf(priya, host.link), "clip-long.mp4", "video/mp4", LONG);
  expect(item.state).toBe("processing");
  await priya.reload();
  const tile = priya.locator('[data-slot="album"] li[data-item="video"][data-state="failed"]');
  await expect(tile).toBeVisible({ timeout: 90_000 });
  await expect(tile).toContainText("Couldn’t be processed: longer than 1 min");
  await Promise.all([host.context.close(), priya.context().close()]);
});
