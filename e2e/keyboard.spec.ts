import sharp from "sharp";
import { closeDesign, createDraft, createPublished, type DraftFields, openDesign, saveStatus, toEditor } from "./events";
import { expectVisibleFocus, tabTo } from "./focus";
import { homeByKeyboard, openHome } from "./home";
import { latestMailTo, mailCountTo, newHost, PASSWORD, signUpVerified } from "./hosts";
import { clientAddress, expect, test, type Locator, type Page } from "./test";

// Ticket 20: a guest can answer, and a host can design their invitation, with the keyboard alone.
// Nothing here is clicked: every step is a key. At each stop the control with the focus shows it:
// a ring (an outline, or the host area's box-shadow ring) on it, or on the tile it sits in, that
// is not there once the focus has gone (e2e/focus.ts).

const EVENT = {
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  location: "Ah Ma’s house",
  plusOnes: "2",
  questions: [{ prompt: "Any allergies?", required: true }],
} satisfies DraftFields;

// Home page, ticket 05: a visitor goes through the home page `app` draws, Open, to Create an
// account, under a light gallery poster and a dark one. Its other two states are walked the same
// way on an instance of their own, in e2e/home-page.spec.ts.
for (const poster of ["Balloons", "Disco"] as const) {
  test(`a visitor goes through the home page to Create an account by keyboard alone, under the ${poster} poster`, async ({ page }) => {
    await openHome(page, poster);
    await homeByKeyboard(page, ["Create an account", "Sign in"]);
    await expect(page).toHaveURL(/\/sign-up$/);
  });
}

for (const style of ["Sheet"] as const) {
  test(`a guest answers Going with a plus-one and a required question by keyboard alone, in the ${style} style`, async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, `keyboard-${style.toLowerCase()}`, { ...EVENT });
    await page.goto(host.link);
    const flow = page.getByRole("dialog", { name: "Your RSVP" });

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

test("a guest answers Going with a plus-one and a required question by keyboard alone, on the Broadsheet's ballot", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-broadsheet", { ...EVENT, layout: "Broadsheet" });
  await page.goto(host.link);

  // The answer is a radio button: Space marks it, and what it asks opens beneath, after it.
  const going = page.getByRole("radio", { name: "I’ll be there" });
  await tabTo(page, going);
  await page.keyboard.press("Space");
  await expect(going).toBeChecked();
  await tabTo(page, page.getByLabel("Your name"));
  await page.keyboard.type("Priya Nair");
  // The stepper's first button can go no lower, and keeps its place in the order all the same.
  await tabTo(page, page.getByRole("button", { name: "One guest more" }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByLabel("Guest 1"));
  await page.keyboard.type("Arjun");
  await tabTo(page, page.getByLabel(/Any allergies/));
  await page.keyboard.type("No nuts");
  await tabTo(page, page.getByRole("button", { name: "Post my reply" }));
  await page.keyboard.press("Enter");

  // The receipt takes the focus, so it is what a screen reader reads next.
  await expect(page.getByRole("heading", { name: "You’re going!" })).toBeFocused();
  await expect(page.getByText("Priya Nair, plus one more.")).toBeVisible();
  await expect(page.getByText("Bringing Arjun.")).toBeVisible();

  // Taking the RSVP back hands the focus back to the answer it was given with.
  await tabTo(page, page.getByRole("button", { name: "Remove my RSVP" }));
  await page.keyboard.press("Enter");
  await expect(going).toBeFocused();
  await expectVisibleFocus(page);
  await host.context.close();
});

test("a guest answers Going with a plus-one and a required question by keyboard alone, in the Thread's composer", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-thread", { ...EVENT, layout: "Thread" });
  await page.goto(host.link);

  // Each answer the composer offers takes the focus once the host has asked for it.
  await tabTo(page, page.getByRole("button", { name: "Going", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Your name")).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.type("Priya Nair");
  // Enter sends it.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Just me", exact: true })).toBeFocused();
  await expectVisibleFocus(page);
  await tabTo(page, page.getByRole("button", { name: "+1", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Any allergies?")).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.type("No nuts");
  await page.keyboard.press("Enter");

  // The done bubble takes the focus, so it is what a screen reader reads next.
  const done = page.locator('[data-slot="done-text"]');
  await expect(done).toBeFocused();
  await expect(done).toContainText("You’re in, Priya!");

  // Taking the RSVP back hands the focus back to the chip it was given with.
  await tabTo(page, page.getByRole("button", { name: "Remove my RSVP" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Going", exact: true })).toBeFocused();
  await expectVisibleFocus(page);
  await host.context.close();
});

// Ticket 05 (M3): on an event that proves the guest's email, the code step by keyboard alone in each
// layout: the code's field takes the focus once the code is sent, and the confirmation once it is
// right. The guest reaches the instance from an address of their own, so the hosts' sign-up emails
// leave their allowance of mail whole.
test("a guest proves their email with the code by keyboard alone, on the Poster, the Broadsheet's ballot and in the Thread's composer", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const PROVEN = { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0", email: "optional", verifyEmail: true } satisfies DraftFields;
  const codeSentTo = async (email: string) => (await latestMailTo(request, email)).match(/^([0-9]{6})\r?$/m)![1];

  for (const layout of ["Poster", "Broadsheet", "Thread"] as const) {
    const host = await createPublished(browser, request, `keyboard-code-${layout.toLowerCase()}`, layout === "Poster" ? { ...PROVEN } : { ...PROVEN, layout });
    const email = newHost(`keyboard-code-${layout.toLowerCase()}-guest`).email;
    const guest = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
    const page = await guest.newPage();
    await page.goto(host.link);

    if (layout === "Broadsheet") {
      await tabTo(page, page.getByRole("radio", { name: "I’ll be there" }));
      await page.keyboard.press("Space");
      await tabTo(page, page.getByLabel("Your name"));
      await page.keyboard.type("Priya Nair");
      await tabTo(page, page.getByLabel("Email"));
      await page.keyboard.type(email);
      await tabTo(page, page.getByRole("button", { name: "Post my reply" }));
      await page.keyboard.press("Enter");
    } else if (layout === "Poster") {
      await tabTo(page, page.getByRole("button", { name: "Going", exact: true }));
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Your name")).toBeFocused();
      await page.keyboard.type("Priya Nair");
      await tabTo(page, page.getByLabel("Email"));
      await page.keyboard.type(email);
      await tabTo(page, page.getByRole("button", { name: "Send RSVP" }));
      await page.keyboard.press("Enter");
    } else {
      // Each of the Thread's turns is sent with Enter.
      await tabTo(page, page.getByRole("button", { name: "Going", exact: true }));
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Your name")).toBeFocused();
      await page.keyboard.type("Priya Nair");
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Email")).toBeFocused();
      await page.keyboard.type(email);
      await page.keyboard.press("Enter");
    }

    const code = page.getByLabel("Code");
    await expect(code).toBeFocused({ timeout: 15_000 });
    await expectVisibleFocus(page);
    await page.keyboard.type(await codeSentTo(email));
    if (layout === "Broadsheet") {
      await tabTo(page, page.getByRole("button", { name: "Confirm" }));
      await page.keyboard.press("Enter");
    } else await page.keyboard.press("Enter");

    // What says the reply is saved takes the focus, so it is what a screen reader reads next.
    if (layout === "Thread") await expect(page.locator('[data-slot="done-text"]')).toBeFocused({ timeout: 15_000 });
    else {
      await expect(page.getByRole("heading", { name: "You’re going!" })).toBeFocused({ timeout: 15_000 });
      await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible();
    }
    await guest.close();
    await host.context.close();
  }
});

// Ticket 12 (after 0.4): "Send it again" waits thirty seconds after each code, and a guest on the
// keyboard can still reach it while it waits: it keeps its place in the tab order, says it is
// unavailable, and does nothing when it is pressed.
test("a guest tabs to the code step's Send it again while it waits, and pressing it sends nothing", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-resend", { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0", email: "optional", verifyEmail: true });
  const email = newHost("keyboard-resend-guest").email;
  const guest = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  const page = await guest.newPage();
  await page.goto(host.link);
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByLabel("Code")).toBeFocused({ timeout: 15_000 });

  // The next stop after the code is the button, waiting, under the name it always has, with the
  // seconds left as its description, which a screen reader reads on reaching it.
  const again = page.getByRole("button", { name: "Send it again", exact: true });
  await expect(again).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Tab");
  await expect(again).toBeFocused();
  await expectVisibleFocus(page);
  await expect(again).toHaveAccessibleDescription(/^Send it again in \d+s$/);
  await page.keyboard.press("Enter");
  await expect(again).toBeFocused();
  await expect(page.getByText("We sent a code to")).toBeVisible();
  await expect.poll(() => mailCountTo(request, email), { timeout: 15_000 }).toBe(1);

  await guest.close();
  await host.context.close();
});

// Ticket 12 (after 0.4): a host who asks for a phone number, optionally, is given one by a guest
// who answers on the Broadsheet's ballot by keyboard alone, and the host's guest list shows it.
test("a guest gives the phone number the host asked for by keyboard alone, on the Broadsheet's ballot, and the host's list shows it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-phone", { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0", layout: "Broadsheet", phone: "optional" });
  await page.goto(host.link);
  await tabTo(page, page.getByRole("radio", { name: "I’ll be there" }));
  await page.keyboard.press("Space");
  await tabTo(page, page.getByLabel("Your name"));
  await page.keyboard.type("Priya Nair");
  await tabTo(page, page.getByLabel("Phone number"));
  await page.keyboard.type("(02) 555-1234");
  await tabTo(page, page.getByRole("button", { name: "Post my reply" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "You’re going!" })).toBeFocused({ timeout: 15_000 });
  await expect(page.getByText("Phone: (02) 555-1234", { exact: true })).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByRole("region", { name: /^Going/ }).getByText("(02) 555-1234", { exact: true })).toBeVisible();
  await host.context.close();
});

// Ticket 02 (M3): a guest reports an event page by keyboard alone, from the link in its footer to
// the thanks and back to the page. The report page is a plain page, as the host's are: its form's
// controls show their focus as the host's pages do, read as their ring's contrast is (below).
test("a guest reports an event page by keyboard alone", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-report", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
  await page.goto(host.link);
  await tabTo(page, page.getByRole("contentinfo").getByRole("link", { name: "Report this event" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Report Ada’s birthday" })).toBeVisible();

  const reason = page.getByLabel("What’s wrong with this page?");
  const email = page.getByLabel("Your email (optional)");
  const send = page.getByRole("button", { name: "Send report" });
  await tabUntil(page, reason);
  await page.keyboard.type(`This page is not what it says it is (keyboard ${Date.now().toString(36)}).`);
  await tabUntil(page, email);
  await page.keyboard.type("reporter@example.com");
  await tabUntil(page, send);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible({ timeout: 15_000 });
  await tabUntil(page, page.getByRole("link", { name: "Back to the event page" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new URL(host.link).pathname);

  await page.goto(`${host.link}/report`);
  for (const control of [reason, email, send]) await expectRingStandsOut(page, control);
  await host.context.close();
});

// Tab until `target` has the focus, on a plain page, whose rings expectRingStandsOut reads instead.
async function tabUntil(page: Page, target: Locator) {
  for (let presses = 0; presses < 30; presses++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`never reached ${target}`);
}

// Ticket 09 (M3), on `app-social`, whose Turnstile keys are Cloudflare's always-pass test keys: a
// host signs up by keyboard alone. Past the password the focus goes through the bot check's own
// controls, which are Cloudflare's, in a frame inside a shadow root the page cannot read, and then
// to Create account; every control of the app's own on the way shows its focus.
test.describe("on an instance whose operator has set Turnstile's keys", () => {
  test.use({ baseURL: "http://localhost:3001" });

  test("a host signs up by keyboard alone, tabbing through the bot check to Create account", async ({ page }) => {
    test.slow();
    const host = newHost("keyboard-bot-check");
    await page.goto("/sign-up");
    const create = page.getByRole("button", { name: "Create account" });
    // It is not in the order until the check has passed.
    await expect(create).toBeEnabled({ timeout: 15_000 });
    await tabTo(page, page.getByLabel("Display name"));
    await page.keyboard.type(host.name);
    await tabTo(page, page.getByLabel("Email"));
    await page.keyboard.type(host.email);
    await tabTo(page, page.getByLabel("Password"));
    await page.keyboard.type(PASSWORD);

    let inTheCheck = 0;
    for (let presses = 0; presses < 10; presses++) {
      await page.keyboard.press("Tab");
      if (await create.evaluate((element) => element === document.activeElement)) break;
      const where = await page.evaluate(() => (document.activeElement?.closest('[role="group"][aria-label="Bot check"]') ? "the bot check" : document.activeElement?.outerHTML.slice(0, 120)));
      expect(where, "every stop between the password and Create account").toBe("the bot check");
      inTheCheck++;
    }
    await expect(create).toBeFocused();
    await expectVisibleFocus(page);
    expect(inTheCheck).toBeGreaterThan(0);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });
});

test("a host picks a poster, changes a knob, restores the poster's look and closes the design sheets by keyboard alone", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-drawer", EVENT);
  const page = host.page;
  await toEditor(page);
  const toolbar = page.getByRole("navigation", { name: "Design the invitation" });
  // The title on the invitation, found by its id: while a sheet is open the page behind it is
  // hidden from assistive technology.
  const title = page.locator("#event-title");

  // The Poster sheet, from the toolbar under the invitation; its heading has the focus.
  const posterButton = toolbar.getByRole("button", { name: "Poster" });
  await tabTo(page, posterButton);
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Poster" });
  await expect(sheet.getByRole("heading", { name: "Poster" })).toBeFocused();

  // The event is on a colour; the gallery is a tab away, and its first poster a Tab past the
  // occasions. The arrow keys choose the next, Balloons, which brings its look.
  await tabTo(page, sheet.getByRole("tab", { name: "Gallery" }));
  await page.keyboard.press("Enter");
  const posters = sheet.getByRole("group", { name: "Poster", exact: true });
  await tabTo(page, posters.getByRole("radio", { name: "Candles" }));
  await page.keyboard.press("ArrowRight");
  await expect(posters.getByRole("radio", { name: "Balloons" })).toBeChecked();
  await expect(posters.getByRole("radio", { name: "Balloons" })).toBeFocused();
  await expectVisibleFocus(page);
  await expect(title).toHaveCSS("font-family", /fredoka/i);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(posterButton).toBeFocused();

  // A finer knob, the title's font, in the Title sheet.
  await tabTo(page, toolbar.getByRole("button", { name: "Title" }));
  await page.keyboard.press("Enter");
  const fonts = page.getByRole("dialog", { name: "Title" }).getByRole("group", { name: "Title font" });
  await tabTo(page, fonts.getByRole("radio", { checked: true }));
  await page.keyboard.press("ArrowLeft");
  await expect(fonts.getByRole("radio", { name: "Syne" })).toBeChecked();
  await expect(saveStatus(page)).toHaveAttribute("data-status", "saved", { timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(toolbar.getByRole("button", { name: "Title" })).toBeFocused();

  // Changed, the poster's look is a key away from coming back, and the focus stays in the sheet.
  // Poster is the toolbar's button before Title.
  await page.keyboard.press("Shift+Tab");
  await expect(posterButton).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(sheet.getByRole("tab", { name: "Gallery" })).toHaveAttribute("aria-selected", "true");
  const restore = sheet.getByRole("button", { name: "Restore the Balloons look" });
  await tabTo(page, restore);
  await page.keyboard.press("Enter");
  await expect(restore).toHaveCount(0);
  await expect(sheet.getByRole("heading", { name: "Poster" })).toBeFocused();
  await expect(title).toHaveCSS("font-family", /fredoka/i);

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(posterButton).toBeFocused();
  await expectVisibleFocus(page);
  await host.context.close();
});

// The host pages' rings, and the design sheets', are drawn at half strength over the page. On
// screen, in the 12px to the left of each focused control, at half its height, some of the ring is
// where the page was without the focus, and stands out at 3:1 or more both from what was there
// and from the page beyond. The host pages keep one look whatever the device's colour scheme, so
// each scheme is looked at.
for (const colorScheme of ["light", "dark"] as const) {
  test(`every focused control in the editor's sheets, on a host's pages and in the design sheets is ringed at 3:1, with a ${colorScheme} colour scheme`, async ({ page, request }) => {
    test.slow();
    await page.emulateMedia({ colorScheme });
    await signUpVerified(page, request, `rings-${colorScheme}`);
    await createDraft(page, { title: "Ada’s birthday", start: "2027-03-06T19:00" });
    const manage = page.url();

    // The editor's sheets: When, About, Settings and More.
    const sheets: [opener: Locator, name: string, controls: (sheet: Locator) => Locator[]][] = [
      [page.getByRole("button", { name: /^When:/ }), "When", (sheet) => [sheet.getByLabel("All day"), sheet.getByLabel("Time zone"), sheet.getByRole("button", { name: "Done" })]],
      [page.getByRole("button", { name: /^About:/ }), "About", (sheet) => [sheet.getByLabel("Description"), sheet.getByRole("button", { name: "Bold" })]],
      [
        page.getByRole("navigation", { name: "Design the invitation" }).getByRole("button", { name: "Settings" }),
        "Settings",
        (sheet) => [sheet.getByLabel("Plus-ones per guest"), sheet.getByRole("button", { name: "Add a question" })],
      ],
      [page.getByRole("button", { name: "More" }), "More", (sheet) => [sheet.getByRole("link", { name: "Guest list" }), sheet.getByRole("button", { name: "Delete event" })]],
    ];
    for (const [opener, name, controls] of sheets) {
      await opener.click();
      const sheet = page.getByRole("dialog", { name });
      await expect(sheet).toBeVisible();
      for (const control of controls(sheet)) await expectRingStandsOut(page, control);
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
    }

    await page.goto(`${manage}/share`);
    await expectRingStandsOut(page, page.getByRole("link", { name: "Back to the event" }));

    // The design sheets, over the live copy of the invitation.
    await page.goto(manage);
    let drawer = await openDesign(page, "Poster", "Gallery");
    await expectRingStandsOut(page, drawer.getByRole("tab", { name: "Colour" }));
    await expectRingStandsOut(page, drawer.getByRole("group", { name: "Poster", exact: true }).getByRole("radio", { name: "Candles" }));
    await drawer.getByRole("tab", { name: "Colour" }).click();
    await expectRingStandsOut(page, drawer.getByRole("group", { name: "Colours" }).getByRole("radio").first());
    // The sheets' one field drawn at half strength, which a picture brings.
    await drawer.getByRole("tab", { name: "Upload" }).click();
    const picture = await sharp({ create: { width: 64, height: 40, channels: 3, background: { r: 40, g: 60, b: 90 } } }).jpeg().toBuffer();
    await drawer.getByLabel("Upload your photo or poster").setInputFiles({ name: "garden.jpg", mimeType: "image/jpeg", buffer: picture });
    await expect(drawer.getByLabel("Describe your picture")).toBeVisible({ timeout: 20_000 });
    await expectRingStandsOut(page, drawer.getByLabel("Describe your picture"));
    await closeDesign(page, "Poster");
    drawer = await openDesign(page, "Theme");
    await expectRingStandsOut(page, drawer.getByRole("group", { name: "Layout" }).getByRole("radio").first());
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
