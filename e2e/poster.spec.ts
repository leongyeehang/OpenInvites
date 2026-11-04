import { expect, test, type APIRequestContext, type Locator, type Page } from "./test";
import sharp from "sharp";
import { closeDesign, createPublished, openDesign, pickDesign, savedAfter, toEditor } from "./events";

// Ticket 13: the host's upload as the invitation itself, which since M4 ticket 01 it always is. The poster is shown at its own
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

// The Poster sheet's Upload tab, in the host's editor (M4 ticket 06).
async function openDrawer(page: Page) {
  await toEditor(page);
  return openDesign(page, "Poster", "Upload");
}

// Where the title goes, from the Title sheet, saved.
async function placeTitle(page: Page, where: "On the poster" | "Below the poster") {
  await pickDesign(page, "Title", "Title placement", where);
}

// What a guest's browser is sent for the page.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

// The host's upload a guest's page shows, if any.
async function shownUpload(request: APIRequestContext, link: string) {
  return (await guestHtml(request, link)).match(/\/uploads\/([0-9a-f-]{36})\//)?.[1];
}

// Uploads a picture and waits until the page shows it.
async function upload(page: Page, request: APIRequestContext, link: string, file: Awaited<ReturnType<typeof poster>>, control = "Upload your photo or poster") {
  const before = await shownUpload(request, link);
  await page.getByRole("dialog", { name: "Poster" }).getByLabel(control).setInputFiles(file);
  await expect.poll(() => shownUpload(request, link), { timeout: 20_000 }).not.toBe(before);
  return (await shownUpload(request, link))!;
}

// Markers only a guest's page in poster mode carries: the poster's blurred copy behind the page,
// and the scrim of a title set on the poster.
const posterCopy = (id: string) => `url(/uploads/${id}/poster-copy.webp)`;
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

test("a host's picture is the poster, with the title below it or on it, and guests see it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "poster", EVENT);
  const drawer = await openDrawer(host.page);
  const id = await upload(host.page, request, host.link, await poster("fair-poster.jpg", 900, 1350));
  await describePicture(drawer, request, host.link);

  // The picture is the poster as soon as it arrives, the title below it.
  await closeDesign(host.page, "Poster");
  const title = await openDesign(host.page, "Title");
  await expect(title.getByRole("group", { name: "Title placement" }).getByRole("radio", { name: "Below the poster" })).toBeChecked();
  await closeDesign(host.page, "Title");
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(posterCopy(id));

  // A guest sees the poster at its own proportions, described once, with the title below it,
  // and the page behind it is the poster's blurred copy, never the picture's background rendition.
  await page.goto(host.link);
  const picture = page.locator('[data-slot="poster-card"] img');
  await expect(picture).toHaveAttribute("src", `/uploads/${id}/poster.webp`);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expect(page.getByRole("img", { name: ALT })).toHaveAttribute("src", `/uploads/${id}/poster.webp`);
  await expectProportions(picture, 900, 1350);
  expect(await guestHtml(request, host.link)).not.toContain(`/uploads/${id}/background.webp`);
  // The title sits under the poster, rising into the faded last fifth of it at most.
  const heading = page.getByRole("heading", { level: 1, name: EVENT.title });
  const shown = await box(picture);
  expect((await box(heading)).y).toBeGreaterThanOrEqual(shown.y + shown.height * 0.8);

  // The poster itself is made for the card: the picture's own size here, never enlarged, and
  // 720 pixels wide for a screen that needs no more. The copy behind the page is a small wash.
  const file = await request.get(`/uploads/${id}/poster.webp`);
  expect(file.headers()["content-type"]).toBe("image/webp");
  expect(await sharp(await file.body()).metadata()).toMatchObject({ width: 900, height: 1350 });
  expect(await sharp(await (await request.get(`/uploads/${id}/poster-720.webp`)).body()).metadata()).toMatchObject({ width: 720, height: 1080 });
  expect(await sharp(await (await request.get(`/uploads/${id}/poster-copy.webp`)).body()).metadata()).toMatchObject({ width: 128, height: 192 });

  // On the poster, the title sits across its foot.
  await placeTitle(host.page, "On the poster");
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(TITLE_ON_POSTER);
  await page.reload();
  const [onPoster, under] = [await box(heading), await box(picture)];
  expect(onPoster.y).toBeGreaterThan(under.y + under.height / 2);
  expect(onPoster.y + onPoster.height).toBeLessThanOrEqual(under.y + under.height);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);

  // Back below it, as saved.
  await placeTitle(host.page, "Below the poster");
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).not.toContain(TITLE_ON_POSTER);
  await page.reload();
  const below = await box(picture);
  expect((await box(heading)).y).toBeGreaterThanOrEqual(below.y + below.height * 0.8);

  await host.context.close();
});

test("a guest's browser takes the poster at the width its screen needs, first", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "poster-widths", EVENT);
  const drawer = await openDrawer(host.page);
  const id = await upload(host.page, request, host.link, await poster("fair-poster.jpg", 1600, 2400));
  await expect(drawer).toBeVisible();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(posterCopy(id));
  await host.context.close();

  // The poster this screen shows, once it has arrived, and every file of the picture it fetched.
  const shown = async (guest: Page) => {
    const picture = guest.locator('[data-slot="poster-card"] img');
    await expect(picture).toHaveJSProperty("complete", true);
    return new URL(await picture.evaluate((element: HTMLImageElement) => element.currentSrc)).pathname;
  };
  const fetched = (guest: Page) =>
    guest.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => new URL(entry.name).pathname)
        .filter((path) => path.startsWith("/uploads/"))
        .sort(),
    );

  // This project's screen, at one pixel per point, wants no more than 720 pixels of poster: a
  // phone's card is 358 wide, a desktop's 544. The copy behind the page is fetched too, small.
  await page.goto(host.link);
  await expect(page.locator('[data-slot="poster-card"] img')).toHaveAttribute("fetchpriority", "high");
  expect(await shown(page)).toBe(`/uploads/${id}/poster-720.webp`);
  await expect.poll(() => fetched(page)).toEqual([`/uploads/${id}/poster-720.webp`, `/uploads/${id}/poster-copy.webp`]);

  // A phone at three pixels a point wants 1074 of them: the poster as it was made, 1200 wide.
  const sharp3x = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const phone = await sharp3x.newPage();
  await phone.goto(host.link);
  expect(await shown(phone)).toBe(`/uploads/${id}/poster.webp`);
  await expect.poll(() => fetched(phone)).toEqual([`/uploads/${id}/poster-copy.webp`, `/uploads/${id}/poster.webp`]);
  await sharp3x.close();
});

test("a curated poster puts the picture aside, and choosing it again brings back the same picture, its description and the rest of the theme", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "poster-back", EVENT);
  const drawer = await openDrawer(host.page);
  const id = await upload(host.page, request, host.link, await poster("fair-banner.jpg", 1600, 900));
  await describePicture(drawer, request, host.link);
  await closeDesign(host.page, "Poster");
  await pickDesign(host.page, "Theme", "Page", "Light");
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");

  // A wide poster keeps its proportions too.
  const titleSheet = async () => {
    const opened = await openDesign(host.page, "Title");
    const count = await opened.getByRole("group", { name: "Title placement" }).count();
    await closeDesign(host.page, "Title");
    return count;
  };
  expect(await titleSheet()).toBe(1);
  await expectProportions(host.page.locator('[data-slot="poster-card"] img'), 1600, 900);

  // A colour puts the picture aside: no title to place, nothing of it on a guest's page.
  await pickDesign(host.page, "Poster", "Colours", "Dusk", "Colour");
  expect(await titleSheet()).toBe(0);
  await expect.poll(() => shownUpload(request, host.link), { timeout: 15_000 }).toBeUndefined();

  // Shown again: the same picture, still described, still with dark text.
  const again = await openDesign(host.page, "Poster", "Upload");
  await savedAfter(host.page, () => again.getByRole("button", { name: "Show your picture" }).click());
  await expect(again.getByRole("button", { name: "Show your picture" })).toHaveCount(0);
  await closeDesign(host.page, "Poster");
  expect(await titleSheet()).toBe(1);
  const theme = await openDesign(host.page, "Theme");
  await expect(theme.getByRole("group", { name: "Page", exact: true }).getByRole("radio", { name: "Light" })).toBeChecked();
  await closeDesign(host.page, "Theme");
  await expect.poll(() => shownUpload(request, host.link), { timeout: 15_000 }).toBe(id);

  await page.goto(host.link);
  await expect(page.locator('[data-slot="poster-card"] img')).toHaveAttribute("src", `/uploads/${id}/poster.webp`);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");

  await host.context.close();
});

test("a replaced poster stays the poster, and the old one's files go", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "poster-replace", EVENT);
  const drawer = await openDrawer(host.page);
  const first = await upload(host.page, request, host.link, await poster("fair-poster.jpg", 900, 1350));
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(posterCopy(first));

  const second = await upload(host.page, request, host.link, await poster("fair-poster-final.jpg", 1000, 1400), "Replace");
  // The new picture is the poster: there is nothing to show again.
  await expect(drawer.getByRole("button", { name: "Show your picture" })).toHaveCount(0);
  await expect(host.page.locator('[data-slot="poster-card"] img')).toHaveAttribute("src", `/uploads/${second}/poster.webp`);
  for (const file of ["poster.webp", "poster-720.webp", "poster-copy.webp", "background.webp", "background-portrait.webp", "card.jpg"]) {
    expect((await request.get(`/uploads/${first}/${file}`)).status(), file).toBe(404);
    expect((await request.get(`/uploads/${second}/${file}`)).status(), file).toBe(200);
  }

  await host.context.close();
});
