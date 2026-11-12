import { expect, type Page } from "./test";

// The poster each area of the site wears on the shared `app` (M8 ticket 17, src/instance/site-look.ts),
// named by the blurred copy its backdrop paints. That instance keeps the whole gallery as its set,
// so the areas drawn from the site's set wear what the pages drawn without the database would.
export const SITE_POSTERS = {
  welcome: "bokeh-copy",
  guest: "cocktails-copy",
  fallback: "birthday-cake-copy",
  site: "rose-garden-copy",
  host: "string-lights-copy",
} as const;

// A page outside an event page as ticket 18 draws it: one site page, on one backdrop painted with
// the poster's copy, with its own footer and no other, and nothing on it moving. Controls carry
// short transitions that can still be finishing as the page arrives (a web font swapping in under
// load), so the page is given until they end: something that moved by itself would never end.
export async function expectSiteLook(page: Page, copy: string) {
  await expect(page.locator(".site-page")).toHaveCount(1);
  const backdrop = page.locator('[data-slot="backdrop"]');
  await expect(backdrop).toHaveCount(1);
  await expect(backdrop.locator(`[style*="${copy}"]`)).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().map((animation) => animation.constructor.name)), { message: "what moves" })
    .toEqual([]);
}

// Once the backdrop's picture has arrived and been decoded, so that pixels are read against it and
// not against the colour under it.
export async function backdropPainted(page: Page) {
  await page.locator('[data-slot="backdrop"] [style*="url("]').evaluate(async (element) => {
    const url = getComputedStyle(element).backgroundImage.match(/url\("?([^")]+)"?\)/)![1];
    const picture = new Image();
    picture.src = url;
    await picture.decode();
  });
}
