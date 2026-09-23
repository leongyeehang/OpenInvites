import { expect, test, type APIRequestContext, type Locator, type Page } from "./test";
import sharp from "sharp";
import { createPublished } from "./events";

// Ticket 13: the host's upload as the invitation itself. The poster is shown at its own
// proportions with a blurred copy of it behind the page, and the title goes on it or below it.
const EVENT = { title: "Summer fair", start: "2027-07-10T11:00", location: "The village green", plusOnes: "0" } as const;
const ALT = "The fair’s poster: a golden sun over a red band, on night blue";

// A poster made in another tool: a night-blue ground, a sun, and a band of colour at its foot.
async function poster(name: string, width: number, height: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#1d2340"/>
    <circle cx="${width / 2}" cy="${height / 3}" r="${Math.min(width, height) / 4}" fill="#f5c16c"/>
    <rect y="${height * 0.8}" width="100%" height="${height * 0.2}" fill="#c0392b"/>
  </svg>`;
  return { name, mimeType: "image/jpeg", buffer: await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer() };
}

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

// The host's upload a guest's page shows, as the background or the poster, if any.
async function shownUpload(request: APIRequestContext, link: string) {
  return (await guestHtml(request, link)).match(/\/uploads\/([0-9a-f-]{36})\//)?.[1];
}

// What a guest's page is painted with behind the invitation, when it is the host's upload.
async function uploadedBackground(request: APIRequestContext, link: string) {
  return (await guestHtml(request, link)).match(/url\((\/uploads\/[0-9a-f-]{36}\/background\.webp)\)/)?.[1];
}

// Uploads a picture and waits until the page shows it.
async function upload(page: Page, request: APIRequestContext, link: string, file: Awaited<ReturnType<typeof poster>>, control = "Upload your photo or poster") {
  const before = await shownUpload(request, link);
  await page.getByRole("dialog", { name: "Design" }).getByLabel(control).setInputFiles(file);
  await expect.poll(() => shownUpload(request, link), { timeout: 20_000 }).not.toBe(before);
  return (await shownUpload(request, link))!;
}

// Markers only a guest's page in poster mode carries: the poster's blurred copy behind the page,
// and the scrim of a title set on the poster.
const posterCopy = (id: string) => `url(/uploads/${id}/poster.webp)`;
const TITLE_ON_POSTER = "--theme-title-scrim";

async function describePicture(drawer: Locator, request: APIRequestContext, link: string) {
  await drawer.getByLabel("Describe your picture").fill(ALT);
  await drawer.getByLabel("Describe your picture").press("Enter");
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain(ALT);
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, "on screen").not.toBeNull();
  return found!;
}

// The poster on the page, drawn at the picture's own proportions.
async function expectProportions(picture: Locator, width: number, height: number) {
  const { width: drawnWidth, height: drawnHeight } = await box(picture);
  expect(drawnWidth / drawnHeight).toBeCloseTo(width / height, 2);
}

test("a host makes their picture the poster, with the title below it or on it, and guests see it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "poster", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  const id = await upload(host.page, request, host.link, await poster("fair-poster.jpg", 900, 1350));
  await describePicture(drawer, request, host.link);

  // As the background, there is no title to place.
  await drawer.getByRole("button", { name: "Details" }).click();
  await expect(drawer.getByRole("group", { name: "Title placement" })).toHaveCount(0);

  const useAs = drawer.getByRole("group", { name: "Use it as" });
  await useAs.getByRole("radio", { name: "Poster" }).check();
  await expect(useAs.getByRole("radio", { name: "Poster" })).toBeChecked();
  await expect(drawer.getByText("Theme: Custom, started from Birthday")).toBeVisible();
  const placement = drawer.getByRole("group", { name: "Title placement" });
  await expect(placement.getByRole("radio", { name: "Below the poster" })).toBeChecked();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(posterCopy(id));

  // A guest sees the poster at its own proportions, described once, with the title below it,
  // and the page behind it is the poster's blurred copy rather than the picture as a background.
  await page.goto(host.link);
  const picture = page.locator('[data-slot="poster-card"] img');
  await expect(picture).toHaveAttribute("src", `/uploads/${id}/poster.webp`);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expect(page.getByRole("img", { name: ALT })).toHaveAttribute("src", `/uploads/${id}/poster.webp`);
  await expectProportions(picture, 900, 1350);
  expect(await uploadedBackground(request, host.link)).toBeUndefined();
  const title = page.getByRole("heading", { level: 1, name: EVENT.title });
  expect((await box(title)).y).toBeGreaterThanOrEqual((await box(picture)).y + (await box(picture)).height);

  // The poster itself is made for the card: the picture's own size here, never enlarged.
  const file = await request.get(`/uploads/${id}/poster.webp`);
  expect(file.headers()["content-type"]).toBe("image/webp");
  expect(await sharp(await file.body()).metadata()).toMatchObject({ width: 900, height: 1350 });

  // On the poster, the title sits across its foot.
  await placement.getByRole("radio", { name: "On the poster" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(TITLE_ON_POSTER);
  await page.reload();
  const [onPoster, under] = [await box(title), await box(picture)];
  expect(onPoster.y).toBeGreaterThan(under.y + under.height / 2);
  expect(onPoster.y + onPoster.height).toBeLessThanOrEqual(under.y + under.height);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);

  // Back below it, as saved.
  await placement.getByRole("radio", { name: "Below the poster" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).not.toContain(TITLE_ON_POSTER);
  await page.reload();
  expect((await box(title)).y).toBeGreaterThanOrEqual((await box(picture)).y + (await box(picture)).height);

  await host.context.close();
});

test("switching back to the background keeps the same picture, its description and the rest of the theme", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "poster-back", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  const id = await upload(host.page, request, host.link, await poster("fair-banner.jpg", 1600, 900));
  const background = await uploadedBackground(request, host.link);
  expect(background).toBe(`/uploads/${id}/background.webp`);
  await describePicture(drawer, request, host.link);
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Dark" }).check();
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");

  // A wide poster keeps its proportions too.
  const useAs = drawer.getByRole("group", { name: "Use it as" });
  await useAs.getByRole("radio", { name: "Poster" }).check();
  await expect(drawer.getByRole("group", { name: "Title placement" })).toBeVisible();
  await expectProportions(host.page.locator('[data-slot="poster-card"] img'), 1600, 900);
  // Saved before switching back: until then a guest's page still shows the background, and the
  // wait for the background below would be over before either change had reached the server.
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(posterCopy(id));

  // Back to the background: the same picture, still described, still with dark text.
  await useAs.getByRole("radio", { name: "Background" }).check();
  await expect(useAs.getByRole("radio", { name: "Background" })).toBeChecked();
  await expect(drawer.getByRole("group", { name: "Title placement" })).toHaveCount(0);
  await expect(drawer.getByText("Theme: Custom, started from Birthday")).toBeVisible();
  await expect(drawer.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(drawer.getByRole("group", { name: "Background" }).getByRole("radio", { name: "Your picture" })).toBeChecked();
  await expect.poll(() => uploadedBackground(request, host.link), { timeout: 15_000 }).toBe(background);

  await page.goto(host.link);
  await expect(page.locator('[data-slot="poster-card"] img')).toHaveCount(0);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");

  await host.context.close();
});

test("a replaced poster stays the poster, and the old one's files go", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "poster-replace", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  const first = await upload(host.page, request, host.link, await poster("fair-poster.jpg", 900, 1350));
  await drawer.getByRole("group", { name: "Use it as" }).getByRole("radio", { name: "Poster" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(posterCopy(first));

  const second = await upload(host.page, request, host.link, await poster("fair-poster-final.jpg", 1000, 1400), "Replace");
  await expect(drawer.getByRole("group", { name: "Use it as" }).getByRole("radio", { name: "Poster" })).toBeChecked();
  await expect(host.page.locator('[data-slot="poster-card"] img')).toHaveAttribute("src", `/uploads/${second}/poster.webp`);
  expect((await request.get(`/uploads/${first}/poster.webp`)).status()).toBe(404);
  expect((await request.get(`/uploads/${second}/poster.webp`)).status()).toBe(200);

  await host.context.close();
});
