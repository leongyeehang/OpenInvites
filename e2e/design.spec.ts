import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createPublished } from "./events";

// Ticket 10: the host's Design drawer. A template sets the whole theme, any knob after it makes
// the theme "custom, started from" it, every change shows at once and is saved, and guests see
// what was saved.
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

test("a host applies a template, changes knobs, and guests see the saved theme", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design", EVENT);
  await host.page.goto(host.link);
  const previewBefore = await host.page.locator('meta[property="og:image"]').getAttribute("content");

  const drawer = await openDrawer(host.page);
  await expect(drawer.getByText("Theme: Birthday")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Birthday" })).toHaveAttribute("aria-pressed", "true");

  // A template shows on the page at once: Festival's grotesque title.
  await drawer.getByRole("button", { name: "Festival" }).click();
  await expect(drawer.getByRole("button", { name: "Festival" })).toHaveAttribute("aria-pressed", "true");
  await expect(drawer.getByText("Theme: Festival")).toBeVisible();
  await expect.poll(() => titleFont(host.page)).toMatch(/bricolage/i);

  // Any knob after it makes the theme the host's own, started from Festival.
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("radio", { name: "Solid accent" }).check();
  await expect(drawer.getByText("Theme: Custom, started from Festival")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Festival" })).toHaveAttribute("aria-pressed", "false");
  await drawer.getByRole("radio", { name: "Dark" }).check();
  await expect(host.page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");

  // Saved as it was made: a guest's copy of the page already wears it.
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-tone="dark"');
  await expect(drawer.getByText("Saved", { exact: true })).toBeVisible();

  await host.page.reload();
  const reopened = await openDrawer(host.page);
  await expect(reopened.getByText("Theme: Custom, started from Festival")).toBeVisible();
  await reopened.getByRole("button", { name: "Details" }).click();
  await expect(reopened.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(reopened.getByRole("radio", { name: "Solid accent" })).toBeChecked();
  // The link's preview card is drawn afresh for the new look.
  expect(await host.page.locator('meta[property="og:image"]').getAttribute("content")).not.toBe(previewBefore);

  // The guest sees the saved theme and no drawer: Festival's font and accent, dark text, solid buttons.
  await page.goto(host.link);
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  expect(await titleFont(page)).toMatch(/bricolage/i);
  const going = page.getByRole("button", { name: "Going" });
  await expect(going).toHaveCSS("background-color", "rgb(126, 240, 200)");
  await expect(page.getByRole("button", { name: "Design" })).toHaveCount(0);

  // Applying the template again starts clean.
  await reopened.getByRole("button", { name: "Festival" }).click();
  await expect(reopened.getByText("Theme: Festival")).toBeVisible();
  await expect(reopened.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Auto" })).toBeChecked();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-tone="light"');
  await page.reload();
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "light");
  await expect(going).not.toHaveCSS("background-color", "rgb(126, 240, 200)");

  await host.context.close();
});

test("the drawer keeps its order, offers only the Poster layout for now, and gets out of the way", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "design-order", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);

  // Upload first (it arrives with a later ticket), then templates, layout, background, and the
  // finer knobs tucked under Details.
  await expect(drawer.getByRole("button", { name: /Upload your photo or poster/ })).toBeDisabled();
  const order = await drawer.locator("h3, legend, button[aria-expanded]").allTextContents();
  expect(order.slice(0, 4)).toEqual(["Templates", "Layout", "Background", "Details"]);
  await expect(drawer.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
  await expect(drawer.getByRole("radio", { name: "Instrument Serif" })).toBeHidden();

  // Broadsheet and Thread are coming; Supper club, made for Broadsheet, applies as a Poster.
  await expect(drawer.getByRole("radio", { name: /Poster/ })).toBeChecked();
  for (const layout of [/Broadsheet/, /Thread/]) {
    const choice = drawer.getByRole("radio", { name: layout });
    await expect(choice).toBeDisabled();
    await expect(choice.locator("..")).toContainText("Coming soon");
  }
  await drawer.getByRole("button", { name: "Supper club" }).click();
  await expect(drawer.getByText("Theme: Supper club")).toBeVisible();
  await expect(drawer.getByRole("radio", { name: /Poster/ })).toBeChecked();
  await expect(host.page.locator("[data-layout]")).toHaveAttribute("data-layout", "poster");

  // A background from the gallery shows at once and makes the theme custom.
  await drawer.getByRole("radio", { name: "Dusk" }).check();
  await expect(drawer.getByText("Theme: Custom, started from Supper club")).toBeVisible();

  // Escape closes it and hands focus back to the Design button.
  await host.page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(host.page.getByRole("button", { name: "Design" })).toBeFocused();

  await host.context.close();
});
