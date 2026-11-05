import { expect, type Locator, type Page } from "@playwright/test";

// Ticket 20: what keyboard.spec.ts checks at every stop, shared with the specs that walk a page
// of their own by keyboard (e2e/home-page.spec.ts). The control with the focus shows it: a ring
// (an outline, or the host area's box-shadow ring) on it, or on the tile it sits in, that is not
// there once the focus has gone.
export async function expectVisibleFocus(page: Page) {
  const shown = await page.evaluate(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || focused === document.body) return "nothing has the focus";
    // A radio laid invisibly over its tile shows its focus on the tile (the drawer's choices).
    const holders = [focused, focused.closest("label")].filter((element): element is HTMLElement => element !== null);
    const ring = (element: Element) => {
      const style = getComputedStyle(element);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2 ? `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} ${style.outlineOffset}` : "none";
      return `${outline} | ${style.boxShadow}`;
    };
    // Read without transitions, so a ring fading in or out is read as it ends up.
    const transitions = holders.map((element) => element.style.transition);
    for (const element of holders) element.style.transition = "none";
    const focusedRing = holders.map(ring);
    focused.blur();
    const unfocusedRing = holders.map(ring);
    focused.focus({ preventScroll: true });
    holders.forEach((element, at) => (element.style.transition = transitions[at]));
    if (document.activeElement !== focused || !focused.matches(":focus-visible")) return "the focus did not come back";
    const ringed = focusedRing.some((withFocus, at) => withFocus !== unfocusedRing[at] && withFocus !== "none | none");
    return ringed ? "ringed" : `no ring on ${focused.outerHTML.slice(0, 160)}`;
  });
  expect(shown).toBe("ringed");
}

// Tab until `target` has the focus, checking every stop on the way shows it.
export async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 60; presses++) {
    await page.keyboard.press("Tab");
    await expectVisibleFocus(page);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`never reached ${target}`);
}
