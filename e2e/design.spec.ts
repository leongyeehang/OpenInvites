import { expect, test, type APIRequestContext, type Locator, type Page } from "./test";
import { createPublished } from "./events";

// Ticket 10: the host's Design drawer. Every change shows at once and is saved, and guests see what
// was saved. M4 ticket 02: a gallery poster brings its look (the templates of 0.4, folded into the
// gallery), any knob after it makes the look the host's own, and the look can be restored.
const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", location: "Ah Ma’s house", plusOnes: "0" } as const;

// What a guest's browser is sent for the page, which is the saved theme and nothing else.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

async function titleFont(page: Page) {
  return page.getByRole("heading", { level: 1 }).evaluate((title) => getComputedStyle(title).fontFamily);
}

async function openDrawer(page: Page) {
  await page.getByRole("button", { name: "Design" }).click();
  const drawer = page.getByRole("dialog", { name: "Design" });
  await expect(drawer).toBeVisible();
  return drawer;
}

test("a host picks a gallery poster, its look comes with it, and guests see the saved theme", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design", EVENT);
  await host.page.goto(host.link);
  const previewBefore = await host.page.locator('meta[property="og:image"]').getAttribute("content");

  const drawer = await openDrawer(host.page);
  const posters = drawer.getByRole("group", { name: "Poster" });
  await expect(posters.getByRole("radio", { name: "Golden hour" })).toBeChecked();
  // Sorted by occasion, each a group of its own.
  await expect(posters.getByRole("group", { name: "Holiday" }).getByRole("radio", { name: "Aurora" })).toBeVisible();

  // A gallery poster shows on the page at once, as the poster itself, with its look: Aurora's
  // grotesque title.
  const aurora = posters.getByRole("radio", { name: "Aurora" });
  await aurora.check();
  await expect(aurora).toBeChecked();
  await expect(host.page.locator('[data-slot="poster-card"] img')).toHaveAttribute("src", /^\/posters\/aurora\.[0-9a-f]{8}\.svg$/);
  await expect.poll(() => titleFont(host.page)).toMatch(/bricolage/i);
  const restore = drawer.getByRole("button", { name: "Restore the Aurora look" });
  await expect(restore).toHaveCount(0);

  // Any knob after it makes the look the host's own, and offers Aurora's back.
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("radio", { name: "Solid accent" }).check();
  await expect(restore).toBeVisible();
  await expect(aurora).toBeChecked();
  await drawer.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Dark" }).check();
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");

  // Saved as it was made: a guest's copy of the page already wears it.
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-tone="dark"');
  await expect(drawer.getByText("Saved", { exact: true })).toBeVisible();

  await host.page.reload();
  const reopened = await openDrawer(host.page);
  await expect(reopened.getByRole("button", { name: "Restore the Aurora look" })).toBeVisible();
  await reopened.getByRole("button", { name: "Details" }).click();
  await expect(reopened.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(reopened.getByRole("radio", { name: "Solid accent" })).toBeChecked();
  // The link's preview card is drawn afresh for the new look.
  expect(await host.page.locator('meta[property="og:image"]').getAttribute("content")).not.toBe(previewBefore);

  // The guest sees the saved theme and no drawer: Aurora's poster, font and accent, dark text,
  // solid buttons.
  await page.goto(host.link);
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  await expect(page.locator('[data-slot="poster-card"] img')).toHaveAttribute("src", /^\/posters\/aurora\./);
  expect(await titleFont(page)).toMatch(/bricolage/i);
  const going = page.getByRole("button", { name: "Going" });
  await expect(going).toHaveCSS("background-color", "rgb(126, 240, 200)");
  await expect(page.getByRole("button", { name: "Design" })).toHaveCount(0);

  // Restoring the look brings Aurora's glass buttons back; the text tone stays the host's.
  await reopened.getByRole("button", { name: "Restore the Aurora look" }).click();
  await expect(reopened.getByRole("button", { name: "Restore the Aurora look" })).toHaveCount(0);
  await expect(reopened.getByRole("group", { name: "RSVP buttons" }).getByRole("radio", { name: "Glass" })).toBeChecked();
  await expect(reopened.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('buttonStyle\\":\\"glass');
  await page.reload();
  await expect(going).not.toHaveCSS("background-color", "rgb(126, 240, 200)");

  // Another poster brings its own look over this one: Disco's display face, its title on the poster.
  await reopened.getByRole("radio", { name: "Disco" }).check();
  await expect.poll(() => titleFont(host.page)).toMatch(/syne/i);
  await expect(reopened.getByRole("group", { name: "Title placement" }).getByRole("radio", { name: "On the poster" })).toBeChecked();

  await host.context.close();
});

test("the drawer keeps its order, offers the three layouts, and gets out of the way", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-order", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);

  // Upload first, then the poster, the layout, and the finer knobs tucked under Details.
  await expect(drawer.getByLabel("Upload your photo or poster")).toBeEnabled();
  const order = await drawer.locator("h3, legend, button[aria-expanded]").allTextContents();
  expect(order.slice(0, 3)).toEqual(["Poster", "Layout", "Details"]);
  await expect(drawer.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
  await expect(drawer.getByRole("radio", { name: "Instrument Serif" })).toBeHidden();

  // Every layout can be chosen, and says what it is.
  const layouts = drawer.getByRole("group", { name: "Layout" });
  await expect(layouts.getByRole("radio", { name: /Poster/ })).toBeChecked();
  const thread = layouts.getByRole("radio", { name: /Thread/ });
  await expect(thread).toBeEnabled();
  await expect(thread.locator("..")).toContainText("The invitation reads like a chat.");
  await expect(drawer.getByText("Coming soon")).toHaveCount(0);
  const broadsheet = layouts.getByRole("radio", { name: /Broadsheet/ });
  await expect(broadsheet).toBeEnabled();
  await expect(broadsheet.locator("..")).toContainText("An editorial page with one reply form.");

  // Choosing it changes the layout and nothing else.
  await drawer.getByRole("button", { name: "Details" }).click();
  await broadsheet.check();
  await expect(host.page.locator("[data-layout]")).toHaveAttribute("data-layout", "broadsheet");
  await expect(drawer.getByRole("group", { name: "Poster" }).getByRole("radio", { name: "Golden hour" })).toBeChecked();
  await expect(drawer.getByRole("radio", { name: "Instrument Serif" })).toBeChecked();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-layout="broadsheet"');
  await page.goto(host.link);
  await expect(page.getByRole("radio", { name: "I’ll be there" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Going" })).toHaveCount(0);

  // Back to the Poster.
  await layouts.getByRole("radio", { name: /Poster/ }).check();
  await expect(host.page.locator("[data-layout]")).toHaveAttribute("data-layout", "poster");
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-layout="poster"');

  // A gallery poster's look leaves the layout as the host set it.
  await layouts.getByRole("radio", { name: /Broadsheet/ }).check();
  await drawer.getByRole("radio", { name: "Candlelight" }).check();
  await expect(drawer.getByRole("radio", { name: "Candlelight" })).toBeChecked();
  await expect(layouts.getByRole("radio", { name: /Broadsheet/ })).toBeChecked();
  await expect(host.page.locator("[data-layout]")).toHaveAttribute("data-layout", "broadsheet");

  // A colour shows at once.
  await drawer.getByRole("radio", { name: "Dusk" }).check();
  await expect(drawer.getByRole("radio", { name: "Dusk" })).toBeChecked();

  // Escape closes it and hands focus back to the Design button.
  await host.page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(host.page.getByRole("button", { name: "Design" })).toBeFocused();

  await host.context.close();
});

// Ticket 11: the drawer's two forms.

// Its slide-in has finished, so it is where it will stay.
async function settled(locator: Locator) {
  await locator.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, "on screen").not.toBeNull();
  return found!;
}

test("the drawer is a bottom sheet on a phone and a side panel on a wider screen, with the page in view and changing", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-forms", { ...EVENT, description: "Bring nothing." });
  const page = host.page;
  await page.goto(host.link);
  const drawer = await openDrawer(page);
  await settled(drawer);

  const bottomSheet = async () => {
    // Edge to edge, from the foot of the screen, with the invitation above it. (Polled, because a
    // window that has just been resized takes a moment to lay out again.)
    const edges = async () => {
      const panel = await box(drawer);
      const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: window.innerHeight }));
      return { left: panel.x, right: layout.width - panel.x - panel.width, foot: Math.round(layout.height - panel.y - panel.height) };
    };
    await expect.poll(edges).toEqual({ left: 0, right: 0, foot: 0 });
    const panel = await box(drawer);
    expect(panel.height).toBeLessThan(page.viewportSize()!.height * 0.7);
    // The poster runs the column's width, so the title may sit below the fold; scrolled to, it is
    // in view above the sheet.
    await page.evaluate(() => document.querySelector("h1")!.scrollIntoView({ block: "start" }));
    const title = await box(page.locator("h1"));
    expect(title.y + title.height).toBeLessThanOrEqual(panel.y);
    // And room to scroll the whole page up above it.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await box(page.locator("main > :last-child"));
    expect(last.y + last.height).toBeLessThanOrEqual(panel.y);
    await page.evaluate(() => window.scrollTo(0, 0));
  };

  if (page.viewportSize()!.width < 768) {
    await bottomSheet();
  } else {
    // Down the right-hand side, the full height, with the page moved over beside it.
    const viewport = page.viewportSize()!;
    const panel = await box(drawer);
    expect(panel.x + panel.width).toBeGreaterThan(viewport.width - 20);
    expect(panel.height).toBeGreaterThan(viewport.height * 0.9);
    expect(panel.width).toBeLessThan(viewport.width / 2);
    const content = await box(page.locator("main"));
    expect(content.x + content.width).toBeLessThanOrEqual(panel.x);
  }

  // The page keeps changing as the host chooses.
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("radio", { name: "Dark" }).check();
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  await drawer.getByRole("radio", { name: "Fredoka" }).check();
  await expect.poll(() => titleFont(page)).toMatch(/fredoka/i);

  // The viewport decides the form, so a window narrowed to a phone's width gets the sheet.
  if (page.viewportSize()!.width >= 768) {
    await page.setViewportSize({ width: 390, height: 844 });
    await bottomSheet();
  }

  await host.context.close();
});

test("nothing in the drawer scrolls sideways, and every poster is in reach down it", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-width", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  await settled(drawer);
  await drawer.getByRole("button", { name: "Details" }).click();
  await expect(drawer.getByRole("radio", { name: "Instrument Serif" })).toBeVisible();

  // Whatever in the drawer a host can scroll sideways: nothing, the panel included.
  const sideways = () =>
    drawer.evaluate((panel) =>
      [panel, ...panel.querySelectorAll("*")].filter((element) => element.scrollWidth > element.clientWidth && ["auto", "scroll"].includes(getComputedStyle(element).overflowX))
        .length,
    );
  expect(await sideways()).toBe(0);

  // The last poster of the gallery sits inside the panel's width, and scrolling down brings it in.
  const panel = await box(drawer);
  const last = drawer.getByRole("group", { name: "Any occasion" }).getByRole("radio").last();
  await last.scrollIntoViewIfNeeded();
  const tile = await box(last);
  expect(tile.x).toBeGreaterThanOrEqual(panel.x);
  expect(tile.x + tile.width).toBeLessThanOrEqual(panel.x + panel.width);

  await host.context.close();
});

test("under reduced motion the drawer appears without sliding in", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-motion", EVENT);
  const page = host.page;
  const motion = (element: Element) => ({ animation: getComputedStyle(element).animationName, running: element.getAnimations({ subtree: true }).length });

  await page.goto(host.link);
  const drawer = await openDrawer(page);
  expect((await drawer.evaluate(motion)).animation).toBe("enter");
  await page.keyboard.press("Escape");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = await openDrawer(page);
  expect(await still.evaluate(motion)).toEqual({ animation: "none", running: 0 });
  // Nor does anything in it move as the host chooses.
  await still.getByRole("button", { name: "Details" }).click();
  await still.getByRole("radio", { name: "Outline" }).check();
  expect(await still.evaluate(motion)).toEqual({ animation: "none", running: 0 });

  await host.context.close();
});
