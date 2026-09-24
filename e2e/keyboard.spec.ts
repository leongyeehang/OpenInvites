import sharp from "sharp";
import { createDraft, createPublished, type DraftFields } from "./events";
import { signUpVerified } from "./hosts";
import { expect, test, type Locator, type Page } from "./test";

// Ticket 20: a guest can answer, and a host can design their invitation, with the keyboard alone.
// Nothing here is clicked: every step is a key. At each stop the control with the focus shows it:
// a ring (an outline, or the host area's box-shadow ring) on it, or on the tile it sits in, that
// is not there once the focus has gone.

const EVENT = {
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  location: "Ah Ma’s house",
  plusOnes: "2",
  questions: [{ prompt: "Any allergies?", required: true }],
} satisfies DraftFields;

async function expectVisibleFocus(page: Page) {
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
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 60; presses++) {
    await page.keyboard.press("Tab");
    await expectVisibleFocus(page);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`never reached ${target}`);
}

for (const style of ["Inline", "Sheet"] as const) {
  test(`a guest answers Going with a plus-one and a required question by keyboard alone, in the ${style} style`, async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, `keyboard-${style.toLowerCase()}`, { ...EVENT, rsvpStyle: style });
    await page.goto(host.link);
    const flow = style === "Sheet" ? page.getByRole("dialog", { name: "Your RSVP" }) : page;

    await tabTo(page, page.getByRole("button", { name: "Going" }));
    await page.keyboard.press("Enter");
    await expect(flow.getByLabel("Your name")).toBeFocused();
    await expectVisibleFocus(page);
    await page.keyboard.type("Priya Nair");
    // Enter finishes the step, and the focus follows to the next.
    await page.keyboard.press("Enter");
    await expect(flow.getByRole("radio", { name: "Just me" })).toBeFocused();
    await expectVisibleFocus(page);
    await tabTo(page, flow.getByRole("radio", { name: "+1" }));
    await page.keyboard.press("Space");
    await expect(flow.getByRole("radio", { name: "+1" })).toHaveAttribute("aria-checked", "true");
    await tabTo(page, flow.getByLabel("Guest 1"));
    await page.keyboard.type("Arjun");
    await page.keyboard.press("Enter");
    await expect(flow.getByLabel(/Any allergies/)).toBeFocused();
    await expectVisibleFocus(page);
    await page.keyboard.type("No nuts");
    await tabTo(page, flow.getByRole("button", { name: "Send RSVP" }));
    await page.keyboard.press("Enter");

    // The confirmation takes the focus, so it is what a screen reader reads next.
    await expect(flow.getByRole("heading", { name: "You’re going!" })).toBeFocused();
    await expect(flow.getByText("Priya Nair, plus one more.")).toBeVisible();
    await expect(flow.getByText("Bringing Arjun.")).toBeVisible();

    // Taking the RSVP back hands the focus back to the buttons it was given with.
    await tabTo(page, flow.getByRole("button", { name: "Remove my RSVP" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Going" })).toBeFocused();
    await expectVisibleFocus(page);
    await host.context.close();
  });
}

test("a host applies a template, changes a knob and closes the Design drawer by keyboard alone", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-drawer", EVENT);
  const page = host.page;
  await page.goto(host.link);

  // The Design button comes after the whole invitation, every control of which shows its focus.
  const design = page.getByRole("button", { name: "Design" });
  await tabTo(page, design);
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Design" });
  await expect(drawer).toBeVisible();

  // Into the templates, where the one in use has the focus, and the arrow keys choose another.
  const birthday = drawer.getByRole("radio", { name: "Birthday" });
  await tabTo(page, birthday);
  await page.keyboard.press("ArrowRight");
  await expect(drawer.getByRole("radio", { name: "Vows" })).toBeFocused();
  await expect(drawer.getByText("Theme: Vows")).toBeVisible();
  await expectVisibleFocus(page);

  // A knob: the background, which makes the theme the host's own.
  await tabTo(page, drawer.getByRole("group", { name: "Background" }).getByRole("radio", { checked: true }));
  await page.keyboard.press("ArrowRight");
  await expect(drawer.getByText("Theme: Custom, started from Vows")).toBeVisible();
  await expectVisibleFocus(page);

  // And the finer knobs under Details, opened with the keyboard too.
  await tabTo(page, drawer.getByRole("button", { name: "Details" }));
  await page.keyboard.press("Enter");
  await tabTo(page, drawer.getByRole("group", { name: "Text tone" }).getByRole("radio", { checked: true }));
  await page.keyboard.press("ArrowRight");
  await expect(drawer.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Light" })).toBeChecked();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(design).toBeFocused();
  await expectVisibleFocus(page);
  await host.context.close();
});

// The host pages' rings, and the Design drawer's, are drawn at half strength over the page. On
// screen, in the 12px to the left of each focused control, at half its height, some of the ring is
// where the page was without the focus, and stands out at 3:1 or more both from what was there
// and from the page beyond. The host pages keep one look whatever the device's colour scheme, so
// each scheme is looked at.
for (const colorScheme of ["light", "dark"] as const) {
  test(`every focused control on a host's pages and in the Design drawer is ringed at 3:1, with a ${colorScheme} colour scheme`, async ({ page, request }) => {
    test.slow();
    await page.emulateMedia({ colorScheme });
    await signUpVerified(page, request, `rings-${colorScheme}`);
    const link = await createDraft(page, { title: "Ada’s birthday", start: "2027-03-06T19:00" });
    const manage = page.url();

    const form = [
      page.getByLabel("Title"),
      page.getByLabel("All day"),
      page.getByLabel("Time zone"),
      page.getByLabel("Description"),
      page.getByRole("button", { name: "Bold" }),
      page.getByRole("button", { name: "Add a question" }),
      page.getByRole("button", { name: "Save changes" }),
      page.getByRole("button", { name: "Publish" }),
      page.getByRole("button", { name: "Delete event" }),
    ];
    for (const control of form) await expectRingStandsOut(page, control);

    await page.goto(`${manage}/share`);
    await expectRingStandsOut(page, page.getByRole("link", { name: "Back to the event" }));

    await page.goto(link);
    await page.getByRole("button", { name: "Design" }).click();
    const drawer = page.getByRole("dialog", { name: "Design" });
    await expectRingStandsOut(page, drawer.getByRole("button", { name: "Details" }));
    await expectRingStandsOut(page, drawer.getByRole("group", { name: "Templates" }).getByRole("radio", { name: "Birthday" }));
    await expectRingStandsOut(page, drawer.getByRole("group", { name: "Background" }).getByRole("radio").first());
    // The drawer's one field drawn at half strength, which a picture brings.
    const picture = await sharp({ create: { width: 64, height: 40, channels: 3, background: { r: 40, g: 60, b: 90 } } }).jpeg().toBuffer();
    await drawer.getByLabel("Upload your photo or poster").setInputFiles({ name: "garden.jpg", mimeType: "image/jpeg", buffer: picture });
    await expect(drawer.getByLabel("Describe your picture")).toBeVisible({ timeout: 20_000 });
    await expectRingStandsOut(page, drawer.getByLabel("Describe your picture"));
  });
}

// Focuses the control as the keyboard does (the last thing done was a key, so it shows its focus
// as it does for Tab), and reads the strip beside it (or beside the tile it sits in) with the focus
// and without.
async function expectRingStandsOut(page: Page, control: Locator) {
  const shown = control.locator("xpath=ancestor-or-self::label[1]").or(control).first();
  await page.keyboard.press("Shift");
  await control.focus();
  expect(await control.evaluate((element) => element.matches(":focus-visible")), `${control} shows its focus`).toBe(true);
  const focused = await stripBeside(page, shown);
  await control.blur();
  const unfocused = await stripBeside(page, shown);
  const beyond = unfocused[0];
  const standsOut = Math.max(...focused.map((pixel, at) => Math.min(contrast(pixel, unfocused[at]), contrast(pixel, beyond))));
  expect(standsOut, `the ring round ${control}`).toBeGreaterThanOrEqual(3);
}

// The 12px to the left of an element, at half its height, as it is on screen, once whatever is
// fading in or out has finished.
async function stripBeside(page: Page, element: Locator) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  await element.scrollIntoViewIfNeeded();
  const box = (await element.boundingBox())!;
  const clip = { x: Math.floor(box.x) - 12, y: Math.floor(box.y + box.height / 2), width: 12, height: 1 };
  const { data, info } = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
  return Array.from({ length: info.width }, (_, at) => [0, 1, 2].map((channel) => data[at * info.channels + channel]));
}

// WCAG 2's contrast ratio, from sRGB channels 0 to 255.
function contrast(a: number[], b: number[]) {
  const luminance = (rgb: number[]) =>
    rgb
      .map((channel) => channel / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, at) => sum + c * [0.2126, 0.7152, 0.0722][at], 0);
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
