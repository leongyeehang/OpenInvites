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
// the poster's copy, with its own footer and no other, one `main` and one `h1`, every control on a
// surface its focus ring is proven against, and nothing on it moving. Controls carry short
// transitions that can still be finishing as the page arrives (a web font swapping in under load),
// so the page is given until they end: something that moved by itself would never end. The
// controls are read once it is still, and again until none is bare, so one drawn late (a client
// component's, once it has hydrated) is read too, and one on its way to a surface is not failed
// for where it was.
export async function expectSiteLook(page: Page, copy: string) {
  await expect(page.locator(".site-page")).toHaveCount(1);
  const backdrop = page.locator('[data-slot="backdrop"]');
  await expect(backdrop).toHaveCount(1);
  await expect(backdrop.locator(`[style*="${copy}"]`)).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  // A legal page's text is the operator's, and may hold headings of its own (src/legal).
  expect(await page.locator("h1").evaluateAll((found) => found.filter((h1) => !h1.closest('[data-slot="legal-text"]')).length), "the page's h1").toBe(1);
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().map((animation) => animation.constructor.name)), { message: "what moves" })
    .toEqual([]);
  await expect.poll(() => page.evaluate(BARE_CONTROLS), { message: "controls on the bare backdrop" }).toEqual([]);
}

// Every control on a site page a person can reach and see, that sits on none of the surfaces
// legibility.ts solves its focus ring against (SITE_SURFACES): a veil, a panel of glass, a card, an
// alert or the header's bar, known by their `data-slot`. The footer is none of them: its links and
// languages sit on pills of the veil, which carry the veil's slot (page-footer.tsx), and the footer
// round them is bare. A ring is drawn outside its control, so one on the bare backdrop is ringed on
// a picture nothing proves it on (the part review's finding 1, Site settings' Reports).
function BARE_CONTROLS() {
  const SURFACES = ["veil", "glass", "card", "alert", "host-header"].map((slot) => `[data-slot="${slot}"]`).join(", ");
  return [...document.querySelectorAll(".site-page :is(a[href], button, input, select, textarea, [tabindex])")]
    .filter((control) => control.getAttribute("tabindex") !== "-1" && !control.matches(":disabled, [type=hidden]"))
    .filter((control) => control.checkVisibility({ visibilityProperty: true }) && control.getClientRects().length > 0)
    .filter((control) => !control.closest(SURFACES))
    .map((control) => `${control.tagName.toLowerCase()} “${(control.textContent || control.getAttribute("aria-label") || "").trim().slice(0, 40)}”`);
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
