import { expect, test, type Locator, type Page } from "./test";
import { createPublished } from "./events";

// Ticket 11: the RSVP sheet, which the Poster layout always uses since M4: the steps and the
// confirmation rise over the invitation in a frosted sheet, from the reply bar fixed to the foot
// of the screen (M4 ticket 03). The guest drives the test's own page, so it all runs at 390
// pixels in the mobile project and at desktop width in the other.

const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "2" } as const;

// While the sheet is open the page behind it is hidden from assistive technology, so the page's
// own controls are found including hidden ones.
const onPage = (page: Page, name: string) => page.getByRole("button", { name, exact: true, includeHidden: true });
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Your RSVP" });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, "on screen").not.toBeNull();
  return found!;
}

// Its rise and any change of size have finished.
async function settled(locator: Locator) {
  await locator.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
}

async function counts(hostPage: Page) {
  await hostPage.goto("/dashboard");
  return hostPage.getByRole("region", { name: "Upcoming" });
}

test("a guest answers in a sheet that rises over the invitation and grows through the steps", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sheet", EVENT);
  await page.goto(host.link);
  const title = page.locator("h1");
  const titleBox = await box(title);

  await page.getByRole("button", { name: "Going" }).click();
  const sheet = sheetOf(page);
  await expect(sheet).toBeVisible();
  await settled(sheet);
  // The invitation stays in view above the sheet, the three buttons still under the poster.
  await expect(title).toBeVisible();
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual((await box(sheet)).y);
  for (const status of ["Going", "Maybe", "Can’t go"]) await expect(onPage(page, status)).toBeVisible();

  const nameStep = (await box(sheet)).height;
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await expect(sheet.getByText("You can bring up to 2 people.")).toBeVisible();
  // The sheet grows and shrinks from its top edge only: the Send button stays under the guest's
  // finger as fields come and go, so a tap as soon as they see it lands on it.
  const send = sheet.getByRole("button", { name: "Send RSVP" });
  const sendAt = await box(send);
  await sheet.getByRole("radio", { name: "+2" }).click();
  expect(await box(send)).toEqual(sendAt);
  await sheet.getByLabel("Guest 1").fill("Arjun");
  await sheet.getByLabel("Guest 2").fill("Mei");
  // More to answer, so a taller sheet.
  await expect.poll(async () => (await box(sheet)).height).toBeGreaterThan(nameStep + 50);

  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible();
  await expect(sheet.getByText("Priya Nair, plus 2 more.")).toBeVisible();
  await expect(sheet.getByText("Bringing Arjun and Mei.")).toBeVisible();
  await expect(sheet.getByText(/^https?:\/\/\S+\/r\/\S+$/)).toBeVisible();
  await expect((await counts(host.page)).getByText("3 people expected")).toBeVisible();

  // The confirmed sheet closes, the bar says so, and Change opens it again.
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  const bar = page.locator('[data-slot="rsvp-bar"]');
  await expect(bar).toContainText("You’re going");
  await bar.getByRole("button", { name: "Change" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible();

  // Coming back on the same device finds the RSVP behind the same button, not a sheet in the way.
  await page.reload();
  await expect(bar).toContainText("You’re going");
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await sheet.getByRole("button", { name: "Edit details" }).click();
  await expect(sheet.getByLabel("Your name")).toHaveValue("Priya Nair");

  // Changing the answer closes the sheet on the buttons, keeps the name, and replaces the RSVP.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await sheet.getByRole("button", { name: "Change my answer" }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Maybe" }).click();
  await expect(sheet.getByLabel("Your name")).toHaveValue("Priya Nair");
  await settled(sheet);
  await sheet.getByRole("button", { name: "Continue" }).click();
  // Fewer to name, so a shorter sheet, and Send is still where the guest saw it.
  const sendAgainAt = await box(send);
  await sheet.getByRole("radio", { name: "Just me" }).click();
  expect(await box(send)).toEqual(sendAgainAt);
  await send.click();
  await expect(sheet.getByText("You’re a maybe.")).toBeVisible();
  await expect((await counts(host.page)).getByText("0 going · 1 maybe · 0 can’t go · no one expected yet")).toBeVisible();

  await host.context.close();
});

test("the sheet keeps focus until it closes and hands it back, on the host's own invitation too", async ({ browser, request }) => {
  test.slow();
  // The host tries their own invitation: it is the guest's page, with nothing of the editor on it
  // (the design sheets are the editor's, M4 ticket 06).
  const host = await createPublished(browser, request, "sheet-focus", EVENT);
  const page = host.page;
  await page.goto(host.link);
  await expect(page.getByRole("button", { name: "Design", includeHidden: true })).toHaveCount(0);

  const going = page.getByRole("button", { name: "Going" });
  await going.click();
  const sheet = sheetOf(page);
  await expect(sheet).toBeVisible();
  await settled(sheet);
  await expect(sheet.getByLabel("Your name")).toBeFocused();

  // Round and round inside the sheet, forwards and back, never out to the page behind it.
  for (const key of ["Tab", "Tab", "Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-slot="rsvp-sheet"]')), `after ${key}`).toBe(true);
  }

  // Escape closes it, and focus is back on the button that opened it.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(going).toBeFocused();

  await host.context.close();
});

test("a guest can answer in the sheet with the keyboard alone", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sheet-keyboard", EVENT);
  await page.goto(host.link);

  // From the top of the page to Going, the way a keyboard gets there.
  const going = page.getByRole("button", { name: "Going" });
  for (let presses = 0; presses < 20 && !(await going.evaluate((button) => button === document.activeElement)); presses++) {
    await page.keyboard.press("Tab");
  }
  await expect(going).toBeFocused();
  await page.keyboard.press("Enter");

  const sheet = sheetOf(page);
  await expect(sheet.getByLabel("Your name")).toBeFocused();
  await page.keyboard.type("Priya Nair");
  // Enter finishes the step, and focus moves on with it rather than staying on a hidden field.
  await page.keyboard.press("Enter");
  await expect(sheet.getByText("You can bring up to 2 people.")).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Just me" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("radio", { name: "+1" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(sheet.getByRole("radio", { name: "+1" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(sheet.getByLabel("Guest 1")).toBeFocused();
  await page.keyboard.type("Arjun");
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("button", { name: "Send RSVP" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(sheet.getByText("You’re going!")).toBeVisible();
  await expect(sheet.getByText("Bringing Arjun.")).toBeVisible();
  // Closed, the focus goes back to the bar, whose buttons have made way for Change.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Change" })).toBeFocused();

  await host.context.close();
});

test("under reduced motion the sheet is simply there: nothing slides, fades or resizes smoothly", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "sheet-motion", EVENT);
  const motion = (element: Element) => {
    const style = getComputedStyle(element);
    return { animation: style.animationName, transition: style.transitionProperty, running: element.getAnimations({ subtree: true }).length };
  };

  // With motion welcome, the sheet rises in and moves between its sizes.
  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  const sheet = sheetOf(page);
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate(motion)).toMatchObject({ animation: "enter", transition: "height" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("button", { name: "Going" }).click();
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate(motion)).toEqual({ animation: "none", transition: "none", running: 0 });
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await expect(sheet.getByText("You can bring up to 2 people.")).toBeVisible();
  expect(await sheet.evaluate(motion)).toEqual({ animation: "none", transition: "none", running: 0 });
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await host.context.close();
});

// M4 ticket 03: the reply bar. Fixed to the foot of the screen at the top of a long page and at its
// end, edge to edge less its margins on a phone and at the foot of the page's column on a wider
// screen; the sheet opens from it, and the focus comes back to it, before and after a reply.
test("the reply bar stays at the foot of the screen, opens the sheet, and takes the focus back", async ({ page, browser, request }) => {
  test.slow();
  const long = Array.from({ length: 30 }, (_, line) => `Line ${line + 1} of the plan for the evening.`).join("\n");
  const host = await createPublished(browser, request, "reply-bar", { ...EVENT, location: "Ah Ma’s house", description: long });
  await page.goto(host.link);
  const bar = page.locator('[data-slot="rsvp-bar"]');
  const viewport = page.viewportSize()!;

  // At the foot of the screen, as the page opens and once it is scrolled to its end.
  const atFoot = async () => {
    const found = await box(bar);
    const gap = viewport.height - (found.y + found.height);
    expect(gap, "between the bar and the foot of the screen").toBeGreaterThanOrEqual(0);
    expect(gap, "between the bar and the foot of the screen").toBeLessThanOrEqual(24);
    return found;
  };
  const top = await atFoot();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(viewport.height * 2);
  // The page grows a little once the guest's device adds its pieces (the countdown, Open in Maps),
  // so it is scrolled again until it is at its end.
  const toEnd = () =>
    page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      return Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
    });
  await expect.poll(toEnd).toBe(true);
  await page.waitForTimeout(300);
  await expect.poll(toEnd).toBe(true);
  expect(await atFoot()).toEqual(top);
  // Nothing of the page is left under it at the end: the footer clears it.
  const footer = await box(page.getByRole("contentinfo"));
  expect(footer.y + footer.height).toBeLessThanOrEqual(top.y + 1);

  const column = await box(page.locator("main"));
  if (viewport.width < 768) {
    expect(top.x).toBeGreaterThan(0);
    expect(top.x).toBeLessThanOrEqual(16);
    expect(viewport.width - (top.x + top.width)).toBeLessThanOrEqual(16);
  } else {
    // The page is a phone's width in the middle, and the bar sits in it.
    expect(column.width).toBeLessThanOrEqual(448);
    expect(Math.abs(column.x + column.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    expect(top.x).toBeGreaterThanOrEqual(column.x);
    expect(top.x + top.width).toBeLessThanOrEqual(column.x + column.width);
  }

  // The sheet opens from it, by the keyboard too, and Escape hands the focus back to it.
  const going = bar.getByRole("button", { name: "Going" });
  await going.focus();
  await page.keyboard.press("Enter");
  const sheet = sheetOf(page);
  await expect(sheet.getByLabel("Your name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(going).toBeFocused();

  // After a reply it says what it was, and Change opens the sheet on it.
  await going.click();
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByRole("heading", { name: "You’re going!" })).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  const change = bar.getByRole("button", { name: "Change" });
  await expect(bar).toContainText("You’re going");
  await expect(change).toBeFocused();
  await expect(bar.getByRole("button", { name: "Going" })).toHaveCount(0);
  await change.click();
  await expect(sheet.getByRole("heading", { name: "You’re going!" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(change).toBeFocused();

  // Coming back, the bar still says so.
  await page.reload();
  await expect(bar).toContainText("You’re going");

  await host.context.close();
});

