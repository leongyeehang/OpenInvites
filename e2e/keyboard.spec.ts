import { createPublished, type DraftFields } from "./events";
import { expect, test, type Locator, type Page } from "./test";

// Ticket 20: a guest can answer, and a host can design their invitation, with the keyboard alone.
// Nothing here is clicked: every step is a key. At each stop the control with the focus shows it,
// with a ring (an outline, or the host area's box-shadow ring) on it or on the tile it sits in.

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
    if (!focused || focused === document.body) return "nothing has the focus";
    // A radio laid invisibly over its tile shows its focus on the tile (the drawer's choices).
    const ringed = [focused, focused.closest("label")].some((element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2) || style.boxShadow !== "none";
    });
    return ringed ? "ringed" : `no ring on ${focused.outerHTML.slice(0, 160)}`;
  });
  expect(shown).toBe("ringed");
}

// Tab until `target` has the focus, checking every stop on the way shows it.
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 40; presses++) {
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

    await expect(flow.getByText("You’re going!")).toBeVisible();
    await expect(flow.getByText("Priya Nair, plus one more.")).toBeVisible();
    await expect(flow.getByText("Bringing Arjun.")).toBeVisible();
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
