import { expectNoSeriousViolations } from "./axe";
import { createPublished } from "./events";
import { expect, test, type Locator, type Page } from "./test";

// M4 ticket 10: on a wide screen the invitation stays phone-width, the toolbar floats under it,
// and every sheet opens as a panel down the right, the invitation sliding clear of it at its own
// size rather than shrinking.

const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", location: "The back garden" };

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, `${locator} on screen`).not.toBeNull();
  return found!;
}

async function settled(sheet: Locator) {
  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
}

// Opens a sheet with its opener, and checks it is a panel down the right with the invitation and
// its toolbar beside it, whole and at their size.
async function besideInvitation(page: Page, opener: Locator, name: string) {
  const width = page.viewportSize()!.width;
  await opener.click();
  const sheet = page.getByRole("dialog", { name });
  await expect(sheet).toBeVisible();
  await settled(sheet);
  const main = page.locator("main").first();
  await expect.poll(() => main.evaluate((element) => element.getAnimations().length)).toBe(0);
  const [panel, invitation] = [await box(sheet), await box(main)];
  expect(panel.x + panel.width, `${name} reaches the right edge`).toBeGreaterThan(width - 20);
  expect(panel.width).toBeLessThanOrEqual(400);
  expect(Math.round(invitation.width), `the invitation keeps its width beside ${name}`).toBe(448);
  expect(invitation.x).toBeGreaterThanOrEqual(0);
  expect(invitation.x + invitation.width, `the invitation is clear of ${name}`).toBeLessThanOrEqual(panel.x);
  expect(await main.evaluate((element) => getComputedStyle(element).scale)).toBe("none");
  return sheet;
}

for (const size of [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
]) {
  test(`at ${size.width}×${size.height}, every sheet opens beside the invitation, which stays whole and unscaled`, async ({ browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the viewport is set here, the same for every project");
    test.slow();
    const host = await createPublished(browser, request, `desktop-${size.width}`, EVENT);
    const page = host.page;
    await page.setViewportSize(size);
    const toolbar = page.getByRole("navigation", { name: "Design the invitation" });

    for (const [opener, name] of [
      [toolbar.getByRole("button", { name: "Poster" }), "Poster"],
      [toolbar.getByRole("button", { name: "Theme" }), "Theme"],
      [toolbar.getByRole("button", { name: "Settings" }), "Settings"],
      [page.getByRole("button", { name: /^When:/ }), "When"],
      [page.getByRole("button", { name: "More" }), "More"],
    ] as const) {
      const sheet = await besideInvitation(page, opener, name);
      if (name === "Poster") await expectNoSeriousViolations(page, `the Poster sheet beside the invitation at ${size.width}`);
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(opener).toBeFocused();
    }

    // Closed, the invitation is back in the middle, the toolbar under it.
    const main = page.locator("main").first();
    await expect.poll(async () => Math.round((await box(main)).x + 224)).toBe(size.width / 2);
    const bar = await box(toolbar);
    expect(Math.abs(bar.x + bar.width / 2 - size.width / 2)).toBeLessThan(2);
    await host.context.close();
  });
}
