import { createDraft, publishInEditor } from "./events";
import { dismissOperatorWelcome, newHost, signUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";
import { closeReply } from "./reply";
import { clientAddress, expect, test } from "./test";

// M7 ticket 08: the album's video processing moved to a worker container. Runs against `app-fresh`,
// which the test profile starts with VIDEO_PROCESSING=worker, so the app only queues each clip, and
// `worker-fresh`, the same image in the worker role on the same database and uploads. All three
// containers are recreated first, so the first account here is the operator's.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh", "worker-fresh");
});

test("a video added through the picker is processed by the worker, and the Storage card says when it was last seen", async ({ browser, request }) => {
  // The worker takes a clip at its next minute, on top of the sign-up and the upload.
  test.setTimeout(240_000);
  const operator = await (await browser.newContext()).newPage();
  const host = newHost("worker");
  await signUp(operator, host);
  await dismissOperatorWelcome(operator);
  await verifyEmail(operator, request, host.email);
  const link = await createDraft(operator, PAST);
  await publishInEditor(operator);

  const guest = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await guest.goto(link);
  await guest.getByRole("button", { name: "Going" }).click();
  await guest.getByLabel("Your name").fill("Priya Nair");
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await closeReply(guest);
  const album = guest.locator('[data-slot="album"]');
  await album.getByLabel("Add photos and videos").setInputFiles("e2e/fixtures/clip-h264.mp4");
  await expect(album.getByRole("status").last()).toContainText("clip-h264.mp4: uploaded, processing", { timeout: 30_000 });
  // The app's kick does nothing here; the worker takes the clip at its next minute.
  const tile = album.locator('li[data-item="video"][data-state="ready"]');
  await expect(tile).toBeVisible({ timeout: 90_000 });
  await expect(tile).toContainText("0:04");

  await operator.goto("/instance");
  await expect(operator.getByRole("heading", { level: 1, name: "Site settings" })).toBeVisible();
  const storage = operator.locator("#storage");
  await expect(storage.getByText(/^Videos are processed by the worker container, last seen .+\.$/)).toBeVisible();
  await Promise.all([operator.context().close(), guest.context().close()]);
});
