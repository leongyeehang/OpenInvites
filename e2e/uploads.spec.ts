import { expect, test, type APIRequestContext, type Page } from "./test";
import sharp from "sharp";
import { createPublished } from "./events";
import { PASSWORD } from "./hosts";

// Ticket 12: a host uploads their own picture as the page's background. The server processes it,
// samples it for the theme, and keeps it behind the storage interface (local disk here).
const EVENT = { title: "Ada’s garden party", start: "2027-05-08T16:00", plusOnes: "0" } as const;
const ALT = "The garden at dusk, strung with fairy lights";

// The camera a phone writes into every photo, beside where it was taken.
const CAMERA = "PhoneCo Pocket";

// A photo as a phone sends it: a ground colour with a few soft shapes, tagged with the camera and
// the place it was taken.
async function photo(ground: string, shapes: string[]) {
  const circles = shapes.map((fill, at) => `<circle cx="${300 + at * 450}" cy="${350 + (at % 2) * 300}" r="180" fill="${fill}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="100%" height="100%" fill="${ground}"/>${circles}</svg>`;
  const buffer = await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: CAMERA, Model: "12" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "1/1 17/1 30/1", GPSLongitudeRef: "E", GPSLongitude: "103/1 51/1 12/1" },
    })
    .toBuffer();
  return { mimeType: "image/jpeg", buffer };
}

// A pale garden in daylight, and the same garden at night.
const lightPhoto = async () => ({ name: "garden-day.jpg", ...(await photo("#f3ead8", ["#e9d8b8", "#f8c9a0", "#e4ecd6"])) });
const darkPhoto = async () => ({ name: "garden-night.jpg", ...(await photo("#1d2340", ["#f5c16c", "#3b5ba5", "#2b1d40"])) });

async function openDrawer(page: Page) {
  await page.getByRole("button", { name: "Design" }).click();
  const drawer = page.getByRole("dialog", { name: "Design" });
  await expect(drawer).toBeVisible();
  return drawer;
}

// What a guest's browser is sent for the page.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

// The picture a guest's page is painted with, if it is the host's upload.
async function uploadedBackground(request: APIRequestContext, link: string) {
  return (await guestHtml(request, link)).match(/url\((\/uploads\/[0-9a-f-]{36}\/background\.webp)\)/)?.[1];
}

// Uploads a picture and waits until the page wears it.
async function upload(page: Page, request: APIRequestContext, link: string, file: { name: string; mimeType: string; buffer: Buffer }, control = "Upload your photo or poster") {
  const before = await uploadedBackground(request, link);
  await page.getByRole("dialog", { name: "Design" }).getByLabel(control).setInputFiles(file);
  await expect.poll(() => uploadedBackground(request, link), { timeout: 20_000 }).not.toBe(before);
  return (await uploadedBackground(request, link))!;
}

test("a light photo turns the text dark by itself, and guests get the picture without its location", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "upload-light", EVENT);
  await host.page.goto(host.link);
  // Golden hour, where every event starts, wears light text.
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "light");

  const drawer = await openDrawer(host.page);
  const sent = await lightPhoto();
  expect(sent.buffer.includes(CAMERA)).toBe(true);
  const src = await upload(host.page, request, host.link, sent);
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  await expect(drawer.getByText("Theme: Custom, started from Birthday")).toBeVisible();

  // Beside the thumbnail: use it as the background, which it now is, or as the poster
  // (poster.spec.ts).
  const useAs = drawer.getByRole("group", { name: "Use it as" });
  await expect(useAs.getByRole("radio", { name: "Background" })).toBeChecked();
  await expect(useAs.getByRole("radio", { name: "Poster" })).toBeEnabled();
  await expect(useAs.getByRole("radio", { name: "Poster" })).not.toBeChecked();

  // Guests see the same page: the picture, with dark text.
  await page.goto(host.link);
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");

  // What a guest can download is the picture alone: nothing of the phone or the place survives.
  const file = await request.get(src);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("image/webp");
  expect(file.headers()["cache-control"]).toContain("immutable");
  const bytes = await file.body();
  expect(bytes.includes(CAMERA)).toBe(false);
  const metadata = await sharp(bytes).metadata();
  expect(metadata.exif).toBeUndefined();
  expect(metadata.xmp).toBeUndefined();

  // The link unfurls as the picture itself: its top corner is the pale garden, not Golden hour.
  const card = await request.get((await page.locator('meta[property="og:image"]').getAttribute("content"))!);
  expect(card.headers()["content-type"]).toBe("image/png");
  const { data } = await sharp(await card.body()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const channel of data.subarray(0, 3)) expect(channel).toBeGreaterThan(200);

  await host.context.close();
});

test("the host describes the picture for screen readers, and can go back to it after another background", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "upload-alt", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  const src = await upload(host.page, request, host.link, await darkPhoto());
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "light");

  await drawer.getByLabel("Describe your picture").fill(ALT);
  await drawer.getByLabel("Describe your picture").press("Enter");
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(ALT);

  // A guest using a screen reader hears it once, with the invitation.
  await page.goto(host.link);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expect(page.locator('[data-slot="poster-card"]').getByRole("img", { name: ALT })).toHaveCount(1);

  // A curated background puts the picture aside, and its description with it.
  await drawer.getByRole("radio", { name: "Dusk" }).check();
  await expect.poll(() => uploadedBackground(request, host.link), { timeout: 15_000 }).toBeUndefined();
  // Put aside, it is the host's alone: a guest's page does not even mention it.
  expect(await guestHtml(request, host.link)).not.toContain(src);
  await page.reload();
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(0);

  // The picture stays in the gallery, and choosing it brings it back as it was.
  const tile = drawer.getByRole("group", { name: "Background" }).getByRole("radio", { name: "Your picture" });
  await expect(tile).not.toBeChecked();
  await tile.check();
  await expect.poll(() => uploadedBackground(request, host.link), { timeout: 15_000 }).toBe(src);
  await page.reload();
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expect(drawer.getByRole("group", { name: "Use it as" }).getByRole("radio", { name: "Background" })).toBeChecked();

  await host.context.close();
});

test("a picture over the size limit, or a file that is not a picture, is refused with a clear message", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "upload-refused", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  const control = drawer.getByLabel("Upload your photo or poster");

  // The instance takes pictures up to 10 MB unless its operator says otherwise.
  await control.setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect(drawer.getByRole("alert")).toHaveText("That picture is larger than 10 MB, the largest that can be uploaded here. Choose a smaller one.");

  // Named and typed as a JPEG, but it is not one: the server reads the file itself.
  await control.setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("These are the directions to the garden, not a photo.") });
  await expect(drawer.getByRole("alert")).toHaveText("That file isn’t a picture that can be used here. Choose a JPEG, PNG, WebP or AVIF picture.");

  // Nothing changed on the page.
  expect(await uploadedBackground(request, host.link)).toBeUndefined();
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "light");

  await host.context.close();
});

test("replacing a picture removes the old one's files, and deleting the event removes the new one's", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "upload-replace", EVENT);
  const manage = host.page.url();
  await host.page.goto(host.link);
  await openDrawer(host.page);

  const first = await upload(host.page, request, host.link, await darkPhoto());
  expect((await request.get(first)).status()).toBe(200);
  const second = await upload(host.page, request, host.link, await lightPhoto(), "Replace");
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  expect((await request.get(first)).status()).toBe(404);
  expect((await request.get(second)).status()).toBe(200);

  await host.page.goto(manage);
  await host.page.getByRole("button", { name: "Delete event" }).click();
  await host.page.getByRole("button", { name: "Delete it" }).click();
  await expect(host.page).toHaveURL(/\/dashboard$/);
  expect((await request.get(second)).status()).toBe(404);

  await host.context.close();
});

test("deleting an account removes the pictures on its events", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "upload-account", EVENT);
  await host.page.goto(host.link);
  await openDrawer(host.page);
  const src = await upload(host.page, request, host.link, await darkPhoto());
  expect((await request.get(src)).status()).toBe(200);

  await host.page.goto("/account");
  await host.page.getByRole("button", { name: "Delete account" }).click();
  await host.page.getByRole("alertdialog").getByLabel("Password").fill(PASSWORD);
  await host.page.getByRole("button", { name: "Delete my account" }).click();
  // Deleting checks the password first, which is slow on purpose.
  await expect(host.page).toHaveURL(/\/sign-in/, { timeout: 15_000 });

  expect((await request.get(src)).status()).toBe(404);
  await host.context.close();
});
