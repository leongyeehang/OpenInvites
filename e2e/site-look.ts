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
// the poster's copy, with its own footer and no other, and nothing on it moving.
export async function expectSiteLook(page: Page, copy: string) {
  await expect(page.locator(".site-page")).toHaveCount(1);
  const backdrop = page.locator('[data-slot="backdrop"]');
  await expect(backdrop).toHaveCount(1);
  await expect(backdrop.locator(`[style*="${copy}"]`)).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  expect(await page.evaluate(() => document.getAnimations().map((animation) => animation.constructor.name)), "what moves").toEqual([]);
}
