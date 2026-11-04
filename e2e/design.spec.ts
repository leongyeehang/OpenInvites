import sharp from "sharp";
import { expect, test, type APIRequestContext, type Locator, type Page } from "./test";
import { closeDesign, createPublished, openDesign, savedAfter } from "./events";

// M4 ticket 06: the editor's design sheets, Poster, Title, Theme and Effect, which took the Design
// drawer's place (ticket 10 of M1). Every choice shows on the invitation at once and is saved, and
// guests see what was saved. A gallery poster brings its look (M4 ticket 02); any knob after it
// makes the look the host's own, and the look can be restored. The host's page is the editor,
// which createPublished leaves them on.
const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", location: "Ah Ma’s house", plusOnes: "0" } as const;

// What a guest's browser is sent for the page, which is the saved theme and nothing else.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

async function titleFont(page: Page) {
  return page.locator("h1").first().evaluate((title) => getComputedStyle(title).fontFamily);
}

const posterSrc = (page: Page) => page.locator('[data-slot="poster-card"] img');

// One choice in an open sheet, saved.
async function choose(page: Page, sheet: Locator, group: string, name: string | RegExp) {
  const choice = sheet.getByRole("group", { name: group, exact: true }).getByRole("radio", { name, exact: typeof name === "string" });
  if (!(await choice.isChecked())) await savedAfter(page, () => choice.check());
  await expect(choice).toBeChecked();
}

test("a host picks a gallery poster, its look comes with it, and guests see the saved theme", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design", EVENT);
  const editor = host.page;
  const previewBefore = await page.goto(host.link).then(() => page.locator('meta[property="og:image"]').getAttribute("content"));

  // The Poster sheet opens on the colour every event starts on, and the gallery is by occasion.
  let poster = await openDesign(editor, "Poster");
  await expect(poster.getByRole("tab", { name: "Colour" })).toHaveAttribute("aria-selected", "true");
  await expect(poster.getByRole("radio", { name: "Golden hour" })).toBeChecked();
  await poster.getByRole("tab", { name: "Gallery" }).click();
  await poster.getByRole("group", { name: "Occasion" }).getByRole("radio", { name: "Holiday" }).check();
  await expect(poster.getByRole("radio", { name: "Candles" })).toHaveCount(0);

  // A gallery poster shows at once, as the poster itself, with its look: Aurora's grotesque title.
  await choose(editor, poster, "Poster", "Aurora");
  await expect(posterSrc(editor)).toHaveAttribute("src", /^\/posters\/aurora\.[0-9a-f]{8}\.svg$/);
  await expect.poll(() => titleFont(editor)).toMatch(/bricolage/i);
  await expect(poster.getByRole("button", { name: "Restore the Aurora look" })).toHaveCount(0);
  await closeDesign(editor, "Poster");

  // Any knob after it makes the look the host's own, and offers Aurora's back.
  let theme = await openDesign(editor, "Theme");
  await choose(editor, theme, "RSVP buttons", "Solid accent");
  await choose(editor, theme, "Page", "Light");
  await expect(editor.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  await closeDesign(editor, "Theme");
  poster = await openDesign(editor, "Poster", "Gallery");
  await expect(poster.getByRole("button", { name: "Restore the Aurora look" })).toBeVisible();
  await closeDesign(editor, "Poster");

  // Saved as it was made: a guest's copy of the page already wears it, and so does the reopened
  // editor; the link's preview card is drawn afresh for the new look.
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-tone="dark"');
  await editor.reload();
  theme = await openDesign(editor, "Theme");
  await expect(theme.getByRole("group", { name: "Page", exact: true }).getByRole("radio", { name: "Light" })).toBeChecked();
  await expect(theme.getByRole("radio", { name: "Solid accent" })).toBeChecked();
  await closeDesign(editor, "Theme");

  // The guest sees the saved theme and no editor: Aurora's poster, font and accent, dark text,
  // solid buttons.
  await page.goto(host.link);
  expect(await page.locator('meta[property="og:image"]').getAttribute("content")).not.toBe(previewBefore);
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  await expect(posterSrc(page)).toHaveAttribute("src", /^\/posters\/aurora\./);
  expect(await titleFont(page)).toMatch(/bricolage/i);
  const going = page.getByRole("button", { name: "Going" });
  await expect(going).toHaveCSS("background-color", "rgb(126, 240, 200)");
  await expect(page.getByRole("navigation", { name: "Design the invitation" })).toHaveCount(0);

  // Restoring the look brings Aurora's glass buttons back; the page stays the host's.
  poster = await openDesign(editor, "Poster", "Gallery");
  await savedAfter(editor, () => poster.getByRole("button", { name: "Restore the Aurora look" }).click());
  await expect(poster.getByRole("button", { name: "Restore the Aurora look" })).toHaveCount(0);
  await closeDesign(editor, "Poster");
  theme = await openDesign(editor, "Theme");
  await expect(theme.getByRole("group", { name: "RSVP buttons" }).getByRole("radio", { name: "Glass" })).toBeChecked();
  await expect(theme.getByRole("group", { name: "Page", exact: true }).getByRole("radio", { name: "Light" })).toBeChecked();
  await closeDesign(editor, "Theme");
  await page.reload();
  await expect(going).not.toHaveCSS("background-color", "rgb(126, 240, 200)");

  // Another poster brings its own look over this one: Disco's display face, its title on the poster.
  poster = await openDesign(editor, "Poster", "Gallery");
  await choose(editor, poster, "Poster", "Disco");
  await closeDesign(editor, "Poster");
  await expect.poll(() => titleFont(editor)).toMatch(/syne/i);
  const title = await openDesign(editor, "Title");
  await expect(title.getByRole("group", { name: "Title placement" }).getByRole("radio", { name: "On the poster" })).toBeChecked();
  await closeDesign(editor, "Title");

  await host.context.close();
});

test("each tab of the Poster sheet changes the poster: a colour puts the title on it, a picture is the poster, and emoji make one", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "design-tabs", EVENT);
  const editor = host.page;

  // A colour: no picture, and the title on the colour's block.
  let poster = await openDesign(editor, "Poster", "Colour");
  await choose(editor, poster, "Colours", "Dusk");
  await closeDesign(editor, "Poster");
  await page.goto(host.link);
  await expect(posterSrc(page)).toHaveCount(0);
  const block = (await page.locator('[data-slot="poster-card"]').boundingBox())!;
  const heading = (await page.getByRole("heading", { level: 1, name: EVENT.title }).boundingBox())!;
  expect(heading.y + heading.height).toBeLessThanOrEqual(block.y + block.height);

  // An upload: the host's picture is the poster.
  poster = await openDesign(editor, "Poster", "Upload");
  const picture = await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 30, g: 60, b: 90 } } }).jpeg().toBuffer();
  await poster.getByLabel("Upload your photo or poster").setInputFiles({ name: "garden.jpg", mimeType: "image/jpeg", buffer: picture });
  await expect(poster.getByLabel("Describe your picture")).toBeVisible({ timeout: 20_000 });
  await closeDesign(editor, "Poster");
  await expect.poll(async () => /src="\/uploads\/[0-9a-f-]{36}\/poster\.webp"/.test(await guestHtml(request, host.link)), { timeout: 15_000 }).toBe(true);

  // Emoji: chosen, drawn and uploaded as the picture, which replaces the photo; reloaded, the sheet
  // shows the emoji and the colour it was made of.
  poster = await openDesign(editor, "Poster", "Emoji");
  await savedAfter(editor, async () => {
    await poster.getByRole("button", { name: "🎉", exact: true }).click();
    await poster.getByRole("button", { name: "🌈", exact: true }).click();
    await poster.getByRole("radio", { name: "Mint" }).check();
  });
  await expect(poster.getByRole("button", { name: "Remove 🎉" })).toBeVisible();
  await closeDesign(editor, "Poster");
  await editor.reload();
  poster = await openDesign(editor, "Poster");
  await expect(poster.getByRole("tab", { name: "Emoji" })).toHaveAttribute("aria-selected", "true");
  await expect(poster.getByRole("button", { name: "Remove 🎉" })).toBeVisible();
  await expect(poster.getByRole("button", { name: "Remove 🌈" })).toBeVisible();
  await expect(poster.getByRole("radio", { name: "Mint" })).toBeChecked();
  await closeDesign(editor, "Poster");
  await page.reload();
  await expect(posterSrc(page)).toHaveAttribute("src", /^\/uploads\/[0-9a-f-]{36}\/poster\.webp$/);

  await host.context.close();
});

test("the Theme sheet switches the layout to the Broadsheet and back, and the Title sheet shows the title in each face", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-theme", EVENT);
  const editor = host.page;

  const theme = await openDesign(editor, "Theme");
  const layouts = theme.getByRole("group", { name: "Layout" });
  await expect(layouts.getByRole("radio", { name: /^Poster/ })).toBeChecked();
  await expect(layouts.getByRole("radio", { name: /^Thread/ }).locator("..")).toContainText("The invitation reads like a chat.");
  await choose(editor, theme, "Layout", /^Broadsheet/);
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-layout="broadsheet"');
  await page.goto(host.link);
  await expect(page.getByRole("radio", { name: "I’ll be there" })).toBeVisible();
  await choose(editor, theme, "Layout", /^Poster/);
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-layout="poster"');
  await closeDesign(editor, "Theme");

  const title = await openDesign(editor, "Title");
  for (const face of ["Instrument Serif", "Bricolage Grotesque", "Syne", "Fredoka"]) await expect(title.getByRole("radio", { name: face })).toBeVisible();
  await expect(title.getByText(EVENT.title)).toHaveCount(4);
  await choose(editor, title, "Title font", /Fredoka/);
  await expect.poll(() => titleFont(editor)).toMatch(/fredoka/i);
  // A colour has no title placement: its title is always on it.
  await expect(title.getByRole("group", { name: "Title placement" })).toHaveCount(0);
  await closeDesign(editor, "Title");

  await host.context.close();
});

// The sheets' two forms, decided by the viewport alone.
test("a design sheet takes half a phone's screen over a live copy, which a tap closes it from, and is a side panel on a wider screen", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-forms", EVENT);
  const editor = host.page;
  const viewport = editor.viewportSize()!;
  // While a sheet is open the page behind it is hidden from assistive technology, the toolbar too.
  const button = editor.getByRole("navigation", { name: "Design the invitation", includeHidden: true }).getByRole("button", { name: "Effect", includeHidden: true });
  // Tailwind's scale is the CSS scale property, not a transform.
  const transform = () => editor.locator("main").evaluate((main) => getComputedStyle(main).scale);

  await expect(button).toHaveAttribute("aria-expanded", "false");
  const sheet = await openDesign(editor, "Effect");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(sheet.getByRole("heading", { name: "Effect" })).toBeFocused();
  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  const panel = (await sheet.boundingBox())!;
  if (viewport.width < 768) {
    // Edge to edge from the foot, half the screen, and the invitation a copy at half its size above.
    expect(panel.x).toBe(0);
    expect(Math.round(panel.y + panel.height)).toBe(viewport.height);
    expect(panel.height).toBeLessThan(viewport.height * 0.6);
    await expect.poll(transform).toBe("0.5");
    // A tap on the copy closes the sheet, and the focus is back on the toolbar's button.
    await editor.mouse.click(viewport.width / 2, panel.y / 2);
    await expect(sheet).toBeHidden();
  } else {
    // Down the right-hand side, beside the invitation, which keeps its size.
    expect(panel.x + panel.width).toBeGreaterThan(viewport.width - 20);
    expect(panel.height).toBeGreaterThan(viewport.height * 0.9);
    expect(await transform()).toBe("none");
    await editor.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect.poll(transform).toBe("none");

  await host.context.close();
});

test("nothing in a design sheet scrolls sideways, and every poster is in reach down it", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-width", EVENT);
  const poster = await openDesign(host.page, "Poster", "Gallery");
  await poster.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  const sideways = () =>
    poster.evaluate(
      (panel) => [panel, ...panel.querySelectorAll("*")].filter((element) => element.scrollWidth > element.clientWidth && ["auto", "scroll"].includes(getComputedStyle(element).overflowX)).length,
    );
  expect(await sideways()).toBe(0);
  const panel = (await poster.boundingBox())!;
  const last = poster.getByRole("group", { name: "Poster", exact: true }).getByRole("radio").last();
  await last.scrollIntoViewIfNeeded();
  const tile = (await last.boundingBox())!;
  expect(tile.x).toBeGreaterThanOrEqual(panel.x);
  expect(tile.x + tile.width).toBeLessThanOrEqual(panel.x + panel.width);
  await host.context.close();
});

test("choosing Confetti lets it fall once, and under reduced motion a sheet appears and nothing falls", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-motion", EVENT);
  const editor = host.page;
  const motion = (element: Element) => ({ animation: getComputedStyle(element).animationName, running: element.getAnimations({ subtree: true }).length });

  let effect = await openDesign(editor, "Effect");
  expect((await effect.evaluate(motion)).animation).toBe("enter");
  await choose(editor, effect, "Effect", /^Confetti/);
  await expect(editor.locator('[data-effect="confetti"]')).toBeVisible();
  await closeDesign(editor, "Effect");

  await editor.emulateMedia({ reducedMotion: "reduce" });
  effect = await openDesign(editor, "Effect");
  expect(await effect.evaluate(motion)).toEqual({ animation: "none", running: 0 });
  await choose(editor, effect, "Effect", /^None/);
  await choose(editor, effect, "Effect", /^Confetti/);
  await expect(editor.locator('[data-effect="confetti"]')).toHaveCount(0);
  expect(await editor.locator("main").evaluate((main) => getComputedStyle(main).transitionDuration)).toBe("0s");
  await closeDesign(editor, "Effect");

  await host.context.close();
});
