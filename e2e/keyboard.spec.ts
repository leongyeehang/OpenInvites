import sharp from "sharp";
import { closeDesign, createDraft, createPublished, type DraftFields, openArrange, openDesign, openSettings, savedAfter, saveStatus, setSchedule, toEditor } from "./events";
import { expectRingStandsOut } from "./contrast";
import { hostWithShelves, SHELVES } from "./dashboard";
import { expectVisibleFocus, tabTo } from "./focus";
import { homeByKeyboard, openHome } from "./home";
import { latestMailTo, mailCountTo, newHost, OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
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
// the thanks and back to the page. The report page wears the site's backdrop, never the event's
// Theme (M8 ticket 18): its form's controls are ringed in the focus ring solved for that backdrop,
// read as their ring's contrast is (e2e/contrast.ts).
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
  await expect(page.getByText("Thank you. Your report has reached whoever runs this site.")).toBeVisible({ timeout: 15_000 });
  await tabUntil(page, page.getByRole("link", { name: "Back to the event page" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new URL(host.link).pathname);

  await page.goto(`${host.link}/report`);
  for (const control of [reason, email, send]) await expectRingStandsOut(page, control);
  await host.context.close();
});

// Tab until `target` has the focus, on the report page, whose rings expectRingStandsOut reads instead.
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

// M8 ticket 28: in Arrange, a row's disclosure, its Heading field and its Collapsed switch are
// each a Tab away; on the guest's page the collapsed section's summary is a stop of its own, which
// Enter and Space open and close.
test("a host renames and collapses a section in Arrange, and a guest opens it, by keyboard alone", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-collapse", EVENT);
  const page = host.page;
  await setSchedule(page, [{ start: "20:00", title: "Cake" }]);
  await tabTo(page, page.getByRole("navigation", { name: "Design the invitation" }).getByRole("button", { name: "Arrange" }));
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Arrange" });
  await expect(sheet.getByRole("heading", { name: "Arrange" })).toBeFocused();

  const options = sheet.getByRole("button", { name: "Options for Schedule" });
  await tabTo(page, options);
  await page.keyboard.press("Enter");
  await expect(options).toHaveAttribute("aria-expanded", "true");
  await tabTo(page, sheet.getByRole("textbox", { name: "Heading" }));
  await savedAfter(page, () => page.keyboard.type("Plan"));
  await expect(sheet.getByRole("button", { name: "Options for Plan" })).toBeVisible();
  const collapsed = sheet.getByRole("switch", { name: "Collapsed" });
  await tabTo(page, collapsed);
  await savedAfter(page, () => page.keyboard.press("Space"));
  await expect(collapsed).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(host.link);
  const schedule = guest.locator('details[data-slot="schedule"]');
  const summary = schedule.locator("summary");
  await expect(summary.getByRole("heading", { name: "Plan" })).toBeVisible();
  await expect(schedule).not.toHaveAttribute("open");
  await tabTo(guest, summary);
  await guest.keyboard.press("Enter");
  await expect(schedule).toHaveAttribute("open", "");
  await expect(schedule).toContainText("Cake");
  await guest.keyboard.press("Enter");
  await expect(schedule).not.toHaveAttribute("open");
  await guest.keyboard.press("Space");
  await expect(schedule).toHaveAttribute("open", "");
  await expectVisibleFocus(guest);
  await Promise.all([host.context.close(), guest.context().close()]);
});

// M8 ticket 29: Links added from Arrange, its rows filled, moved and removed by keyboard alone. A
// moved row's button keeps the focus; removing the last row gives it to "Add a link".
test("a host adds Links, moves one and removes another, by keyboard alone", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-links", EVENT);
  const page = host.page;
  await tabTo(page, page.getByRole("navigation", { name: "Design the invitation" }).getByRole("button", { name: "Arrange" }));
  await page.keyboard.press("Enter");
  const arrange = page.getByRole("dialog", { name: "Arrange" });
  await expect(arrange.getByRole("heading", { name: "Arrange" })).toBeFocused();
  await tabTo(page, arrange.getByRole("button", { name: "Registry", exact: true }));
  await savedAfter(page, () => page.keyboard.press("Enter"));

  const sheet = page.getByRole("dialog", { name: "Registry" });
  await expect(sheet.getByRole("heading", { name: "Registry" })).toBeFocused();
  const add = sheet.getByRole("button", { name: "Add a link" });
  for (const [n, label, url] of [
    [1, "Our list", "https://www.example.com/registry"],
    [2, "Songs", "example.org/songs"],
  ] as const) {
    await tabTo(page, add);
    await page.keyboard.press("Enter");
    await expect(sheet.getByRole("textbox", { name: `Label of link ${n}`, exact: true })).toBeFocused();
    await page.keyboard.type(label);
    await page.keyboard.press("Tab");
    await expect(sheet.getByRole("textbox", { name: `Address of link ${n}`, exact: true })).toBeFocused();
    await savedAfter(page, () => page.keyboard.type(url));
  }

  const up = sheet.getByRole("button", { name: "Move Songs up" });
  await tabTo(page, up);
  await savedAfter(page, () => page.keyboard.press("Enter"));
  await expect(up).toBeFocused();
  await expect(sheet.getByRole("textbox", { name: "Label of link 1", exact: true })).toHaveValue("Songs");
  await expectVisibleFocus(page);

  await tabTo(page, sheet.getByRole("button", { name: "Remove Our list" }));
  await savedAfter(page, () => page.keyboard.press("Enter"));
  await expect(sheet.getByRole("listitem")).toHaveCount(1);
  await expect(add).toBeFocused();
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

    // The header's bar of glass, and a field and its button on Account (M8 ticket 20).
    await page.goto("/dashboard");
    await expectRingStandsOut(page, page.getByRole("banner").getByRole("link", { name: "New event" }));
    // The 12px read beside the initials reach into the New event pill, 8px off: the ring is drawn
    // on the bar between them, so the pill is hidden while the bar is read (until the next page).
    await page.getByRole("banner").getByRole("link", { name: "New event" }).evaluate((element) => ((element as HTMLElement).style.visibility = "hidden"));
    await expectRingStandsOut(page, page.getByRole("banner").getByRole("button", { name: "Account menu" }));
    await page.goto("/account");
    const displayName = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { level: 2, name: "Display name" }) });
    await expectRingStandsOut(page, displayName.getByLabel("Display name"));
    await expectRingStandsOut(page, displayName.getByRole("button", { name: "Save" }));

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
    await closeDesign(page, "Theme");
    // Arrange (M8 ticket 25): a row's Move button and its switch.
    const arrangeSheet = await openArrange(page);
    await expectRingStandsOut(page, arrangeSheet.getByRole("button", { name: "Move Album up" }));
    await expectRingStandsOut(page, arrangeSheet.getByRole("switch", { name: "Schedule" }));
  });
}

// M8 ticket 23: every page outside an event page shows its focus on its poster. By Tab from the
// top of the page, the first five stops are each marked, then each is ringed in turn and its ring
// read against the poster and the glass round it (e2e/contrast.ts). The ring round the header's
// initials is read with the New event pill hidden, as the 12px strip beside them reaches it.
async function firstFiveStopsRinged(page: Page, where: string) {
  await expect(page.locator(".site-page")).toHaveCount(1);
  for (let stop = 1; stop <= 5; stop++) {
    await page.keyboard.press("Tab");
    const marked = await page.evaluate((at) => {
      const focused = document.activeElement;
      if (!focused || focused === document.body) return false;
      focused.setAttribute("data-stop", String(at));
      return true;
    }, stop);
    expect(marked, `${where}: Tab ${stop} reaches a control`).toBe(true);
  }
  // By its address, as hidden it has no role to be found by.
  const pill = page.getByRole("banner").locator('a[href="/events/new"]');
  for (let stop = 1; stop <= 5; stop++) {
    const control = page.locator(`[data-stop="${stop}"]`);
    const initials = await control.evaluate((element) => element.getAttribute("aria-label") === "Account menu");
    if (initials) await pill.evaluate((element) => ((element as HTMLElement).style.visibility = "hidden"));
    await test.step(`${where}: the ring at stop ${stop}`, () => expectRingStandsOut(page, control));
    if (initials) await pill.evaluate((element) => (element as HTMLElement).style.removeProperty("visibility"));
  }
}

test("every site page shows its focus on its poster", async ({ page, browser, request }) => {
  test.slow();
  await page.goto("/sign-in");
  await firstFiveStopsRinged(page, "sign-in");
  // The site's name above the card is where Tab starts.
  await expect(page.locator('[data-stop="1"]')).toHaveAttribute("data-slot", "site-name");
  await page.goto("/forgot-password");
  await firstFiveStopsRinged(page, "forgot-password");

  const host = await createPublished(browser, request, "keyboard-site-pages", EVENT);
  const editor = host.page.url();
  await host.page.goto("/account");
  await firstFiveStopsRinged(host.page, "account");
  await host.page.goto(`${editor}/invites`);
  await firstFiveStopsRinged(host.page, "invites");
  await host.context.close();

  const operator = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await signIn(operator, OPERATOR.email, PASSWORD);
  await expect(operator).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await operator.goto("/instance");
  await firstFiveStopsRinged(operator, "instance");
  await operator.context().close();
});

// The dashboard by keyboard (dashboard, ticket 05): from the header's New event and account menu to
// Next up's poster and its three buttons, then a tile on every shelf, in that order, each ringed.
test("a host walks the dashboard by keyboard, from the header through Next up to every shelf", async ({ browser, request }) => {
  test.slow();
  const host = await hostWithShelves(browser, request, "keyboard-shelves");
  const page = host.page;
  const nextUp = page.getByRole("region", { name: "Next up", exact: true });
  const order = [
    page.getByRole("banner").getByRole("link", { name: "New event" }),
    page.getByRole("banner").getByRole("button", { name: "Account menu" }),
    nextUp.getByRole("link", { name: new RegExp(SHELVES.nextUp) }),
    nextUp.getByRole("link", { name: "Guests" }),
    nextUp.getByRole("link", { name: "Edit" }),
    nextUp.getByRole("link", { name: "Share" }),
    page.getByRole("region", { name: "Coming up", exact: true }).getByRole("link", { name: new RegExp(SHELVES.comingUp) }),
    page.getByRole("region", { name: "Drafts", exact: true }).getByRole("link", { name: new RegExp(SHELVES.draft) }),
    page.getByRole("region", { name: "Past", exact: true }).getByRole("link", { name: new RegExp(SHELVES.past) }),
  ];
  await tabTo(page, order[0]);
  for (const next of order.slice(1)) {
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
    await expectVisibleFocus(page);
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await host.context.close();
});

// M6 ticket 10: the Schedule sheet by keyboard alone, from the details list's Schedule row: Add an
// item, by Enter and by Space, puts the focus on the new row's day; its start time and title are
// typed; a middle row removed leaves the focus on the same Remove, which then removes the row that
// took its place; the last row removed gives the focus to Add an item; the arrow keys pick "Only
// when the page is opened"; Done saves it and gives the focus back to the row, which counts the
// items.
test("a host lists a schedule in its sheet by keyboard alone: adds items, fills them, removes one, picks how pages keep fresh, and Done", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-schedule", EVENT);
  const page = host.page;
  await toEditor(page);
  const row = page.getByRole("button", { name: /^Schedule:/ });
  await tabTo(page, row);
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Schedule" });
  await expect(sheet.getByRole("heading", { name: "Schedule" })).toBeFocused();

  const add = sheet.getByRole("button", { name: "Add an item" });
  for (const [n, key, time, title] of [
    [1, "Enter", "0700P", "Dinner"],
    [2, "Space", "0900P", "Cake"],
    [3, "Enter", "1000P", "Nightcap"],
  ] as const) {
    await tabTo(page, add);
    await page.keyboard.press(key);
    // The new row has the focus at its first field, the day, which starts on the event's.
    const day = sheet.getByLabel(`Day ${n}`, { exact: true });
    await expect(day).toBeFocused();
    await expectVisibleFocus(page);
    await expect(day).toHaveValue("2027-03-06");
    await tabThroughFields(page, sheet.getByLabel(`Start time ${n}`, { exact: true }));
    await page.keyboard.type(time);
    await tabThroughFields(page, sheet.getByLabel(`Title ${n}`, { exact: true }));
    await page.keyboard.type(title);
  }
  await expect(sheet.getByLabel("Start time 1", { exact: true })).toHaveValue("19:00");
  await expect(sheet.getByLabel("Start time 2", { exact: true })).toHaveValue("21:00");
  await expect(sheet.getByLabel("Start time 3", { exact: true })).toHaveValue("22:00");

  // The second row, removed from its own Remove, back from the third's title: the focus stays on
  // Remove item 2, which now removes what was the third row.
  await tabThroughFields(page, sheet.getByRole("button", { name: "Remove item 2" }), "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(sheet.locator("ol > li")).toHaveCount(2);
  await expect(sheet.getByRole("button", { name: "Remove item 2" })).toBeFocused();
  await expectVisibleFocus(page);
  await expect(sheet.getByLabel("Title 2", { exact: true })).toHaveValue("Nightcap");
  await expect(sheet.getByLabel("Start time 2", { exact: true })).toHaveValue("22:00");

  // A third row, removed from its own Remove: the focus goes to Add an item, not out of the sheet.
  // From Remove item 2 the way there crosses the row's time fields.
  await tabThroughFields(page, add);
  await page.keyboard.press("Enter");
  await expect(sheet.getByLabel("Day 3", { exact: true })).toBeFocused();
  await tabThroughFields(page, sheet.getByRole("button", { name: "Remove item 3" }));
  await page.keyboard.press("Enter");
  await expect(sheet.locator("ol > li")).toHaveCount(2);
  await expect(add).toBeFocused();
  await expectVisibleFocus(page);

  // The freshness is a radio group: Tab stops on the one chosen, the arrow keys choose the other.
  await tabThroughFields(page, sheet.getByRole("radio", { name: "Refresh every minute while the event is on" }));
  await page.keyboard.press("ArrowDown");
  const reload = sheet.getByRole("radio", { name: "Only when the page is opened" });
  await expect(reload).toBeChecked();
  await expect(reload).toBeFocused();
  await expectVisibleFocus(page);

  await tabTo(page, sheet.getByRole("button", { name: "Done" }));
  await page.keyboard.press("Enter");
  await expect(sheet).toBeHidden({ timeout: 15_000 });
  await expect(row).toHaveAccessibleName("Schedule: 2 items");
  await expect(row).toBeFocused();
  await expectVisibleFocus(page);
  await host.context.close();
});

// Tab until `target` has the focus, through date and time fields, each of which Chrome steps through
// a part at a time (month, day, year; hour, minute, AM or PM; a date and time's both). Every other
// stop shows its focus; those fields are read where they are first reached, as reading a ring takes
// the focus away and gives it back at the field's first part. Shift+Tab goes back the same way.
async function tabThroughFields(page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab") {
  for (let presses = 0; presses < 40; presses++) {
    await page.keyboard.press(key);
    const inParts = await page.evaluate(() => ["date", "time", "datetime-local"].includes((document.activeElement as HTMLInputElement | null)?.type ?? ""));
    if (!inParts) await expectVisibleFocus(page, `Tab ${presses + 1} towards ${target}`);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`never reached ${target}`);
}

// M6 ticket 10: an invitee opens an invite-only event's locked page by keyboard alone: the email,
// Send me a code, the code field, which takes the focus once the code is sent, Open the
// invitation, and Send it again, within reach while it waits and doing nothing then.
test("an invitee opens an invite-only event by keyboard alone, with Send it again within reach", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-locked", { title: "Ada’s secret supper", start: "2027-03-06T19:00", plusOnes: "0" });
  const meiEmail = newHost("keyboard-locked-mei").email;
  const sheet = await openSettings(host.page);
  await savedAfter(host.page, () =>
    sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel("Invite-only: only people on the invite list can open the invitation", { exact: true }).check(),
  );
  await sheet.getByRole("link", { name: "Manage the invite list" }).click();
  await host.page.getByLabel("Name", { exact: true }).fill("Mei Lin");
  await host.page.getByLabel("Email", { exact: true }).fill(meiEmail);
  await host.page.getByRole("button", { name: "Make link" }).click();
  await expect(host.page.getByRole("status").filter({ hasText: /^Made a link for / })).toHaveText("Made a link for Mei Lin.", { timeout: 15_000 });

  const guest = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  const page = await guest.newPage();
  await page.goto(host.link);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A private invitation");
  await tabTo(page, page.getByLabel("Your email"));
  await page.keyboard.type(meiEmail);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Send me a code" })).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");

  const code = page.getByLabel("Code", { exact: true });
  await expect(code).toBeFocused({ timeout: 15_000 });
  await expectVisibleFocus(page);
  await expect(page.getByText("If that email is on the invite list, a code is on its way.")).toBeVisible();
  await page.keyboard.type((await latestMailTo(request, meiEmail)).match(/^([0-9]{6})\r?$/m)![1]);
  const open = page.getByRole("button", { name: "Open the invitation" });
  await page.keyboard.press("Tab");
  await expect(open).toBeFocused();
  await expectVisibleFocus(page);

  // Send it again is the next stop, waiting, and pressing it sends nothing.
  const again = page.getByRole("button", { name: "Send it again", exact: true });
  await page.keyboard.press("Tab");
  await expect(again).toBeFocused();
  await expectVisibleFocus(page);
  await expect(again).toHaveAttribute("aria-disabled", "true");
  await expect(again).toHaveAccessibleDescription(/^Send it again in \d+s$/);
  // Enter on it sends nothing: it still waits, with its seconds, and keeps the focus. This rests on
  // the thirty seconds after the code went: since then the code was read from Mailpit, typed, and
  // the focus moved two stops, a few seconds at most, so the margin is twenty seconds and more.
  await page.keyboard.press("Enter");
  await expect(again).toBeFocused();
  await expect(again).toHaveAttribute("aria-disabled", "true");
  await expect(again).toHaveAccessibleDescription(/^Send it again in \d+s$/);

  await page.keyboard.press("Shift+Tab");
  await expect(open).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ada’s secret supper" })).toBeVisible({ timeout: 15_000 });
  // That round trip to the server comes after any post the Enter could have made, which would have
  // sent its code before answering: still the one code.
  expect(await mailCountTo(request, meiEmail)).toBe(1);
  await guest.close();
  await host.context.close();
});

// M6 ticket 10: in the album's viewer, a host approves a photo waiting for approval, and deletes
// another, by keyboard alone. Approve keeps the viewer on the photo and gives the focus to Download;
// Delete asks first, and once the photo is gone the focus is on the album's heading.
test("a host approves one waiting photo and deletes another in the album's viewer by keyboard alone", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-album", { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" });
  const settings = await openSettings(host.page);
  await savedAfter(host.page, () => settings.getByRole("group", { name: "Album", exact: true }).getByLabel("Approve photos before they’re shown").check());
  await host.page.keyboard.press("Escape");

  // A guest replies and adds two photos, which wait.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(host.link);
  await guest.getByRole("button", { name: "Going" }).click();
  await guest.getByLabel("Your name").fill("Priya Nair");
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await guest.getByRole("dialog", { name: "Your RSVP" }).getByRole("button", { name: "Close" }).click();
  const picture = async (name: string, background: string) => ({
    name,
    mimeType: "image/jpeg",
    buffer: await sharp({ create: { width: 1600, height: 1200, channels: 3, background } }).jpeg().toBuffer(),
  });
  const album = (on: Page) => on.locator('[data-slot="album"]');
  await album(guest).getByLabel(/^Add photos/).setInputFiles([await picture("garden.jpg", "#2f6b3a"), await picture("cake.jpg", "#c0506a")]);
  await expect(album(guest).getByRole("status")).toContainText("cake.jpg: added, awaiting approval", { timeout: 20_000 });

  const page = host.page;
  await page.goto(host.link);
  await tabTo(page, album(page).getByRole("button", { name: "Photo 1 by Priya Nair, awaiting approval" }));
  await page.keyboard.press("Enter");
  const viewer = page.getByRole("dialog", { name: "Photo 1 of 2" });
  await expect(viewer).toContainText("Added by Priya Nair · Awaiting approval");
  // The viewer opens with the focus on its first control, Approve.
  const approve = viewer.getByRole("button", { name: "Approve" });
  await expect(approve).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(approve).toHaveCount(0, { timeout: 15_000 });
  await expect(viewer).not.toContainText("Awaiting approval");
  await expect(viewer.getByRole("link", { name: "Download" })).toBeFocused();
  await expectVisibleFocus(page);

  // The next photo, by the arrow key, still waits; Delete, then Delete it, with Space.
  await page.keyboard.press("ArrowRight");
  const next = page.getByRole("dialog", { name: "Photo 2 of 2" });
  await expect(next).toContainText("Added by Priya Nair · Awaiting approval");
  await tabTo(page, next.getByRole("button", { name: "Delete", exact: true }));
  await page.keyboard.press("Space");
  const confirm = page.getByRole("alertdialog", { name: "Delete this photo?" });
  await expect(confirm).toBeVisible();
  await tabTo(page, confirm.getByRole("button", { name: "Delete it" }));
  await page.keyboard.press("Space");
  await expect(confirm).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Photos" })).toBeFocused();
  await expect(album(page).getByRole("img")).toHaveCount(1);
  await expect(album(page).getByRole("button", { name: "Photo 1 by Priya Nair" })).toBeVisible();
  await guest.context().close();
  await host.context.close();
});

// M6 ticket 10: on the Invites page, with personal letters on, a host shares an invite's link,
// sends its invitation and sends it again, and writes and saves its letter, by keyboard alone; then
// sends everyone not yet sent theirs, and the button keeps the focus (M6 final review).
test("a host shares, sends, sends again and writes the letter of an invite, and sends to everyone not yet sent, by keyboard alone", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "keyboard-invites", { title: "Ada’s supper club", start: "2027-03-06T19:00", plusOnes: "0" });
  const page = host.page;
  const meiEmail = newHost("keyboard-invites-mei").email;
  const kaiEmail = newHost("keyboard-invites-kai").email;
  // A share sheet that keeps what it was given, as a phone's would show it.
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: ShareData }).shared = data;
      },
    });
  });
  await page.goto(`${page.url()}/invites`);
  await page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(page.getByRole("textbox", { name: "Letter", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Name", { exact: true }).fill("Mei Lin");
  await page.getByLabel("Email", { exact: true }).fill(meiEmail);
  await page.getByRole("button", { name: "Make link" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Made a link for / })).toHaveText("Made a link for Mei Lin.", { timeout: 15_000 });
  const row = page.getByRole("listitem").filter({ has: page.getByText("Mei Lin", { exact: true }) });

  // Share, with Enter.
  await tabTo(page, row.getByRole("button", { name: "Share link for Mei Lin" }));
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: ShareData }).shared?.url)).toMatch(/\/i\/[A-Za-z0-9]{24}$/);

  // Send, with Enter: the button keeps the focus, now as Send again, which Space sends again.
  await page.keyboard.press("Tab");
  const send = row.getByRole("button", { name: "Send the invitation to Mei Lin", exact: true });
  await expect(send).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(row.getByRole("status")).toHaveText("Invitation sent to Mei Lin.", { timeout: 15_000 });
  const again = row.getByRole("button", { name: "Send the invitation to Mei Lin again" });
  await expect(again).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Space");
  await expect.poll(() => mailCountTo(request, meiEmail), { timeout: 30_000 }).toBe(2);

  // The letter, typed in its field and saved with Enter on its button.
  const letter = row.getByRole("textbox", { name: "Letter Mei Lin" });
  await tabTo(page, letter);
  await page.keyboard.type("Dear Mei,");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Bring your guitar.");
  await page.keyboard.press("Tab");
  const save = row.getByRole("button", { name: "Save letter Mei Lin" });
  await expect(save).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(row.getByRole("status").filter({ hasText: "Letter saved." })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(letter).toHaveValue("Dear Mei,\nBring your guitar.");

  // Send to everyone not yet sent, with Enter, sends Kai's, the one left, and keeps the focus: with
  // nobody left to send to, it reads as disabled where it stands.
  await page.getByLabel("Name", { exact: true }).fill("Kai Tan");
  await page.getByLabel("Email", { exact: true }).fill(kaiEmail);
  await page.getByRole("button", { name: "Make link" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Made a link for / })).toHaveText("Made a link for Kai Tan.", { timeout: 15_000 });
  await tabTo(page, page.getByRole("button", { name: "Send to everyone not yet sent (1)" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Sent 1 invitation.", { exact: true })).toBeVisible({ timeout: 15_000 });
  const sendAll = page.getByRole("button", { name: "Send to everyone not yet sent (0)" });
  await expect(sendAll).toBeFocused();
  await expect(sendAll).toHaveAttribute("aria-disabled", "true");
  await expectVisibleFocus(page);
  await expect.poll(() => mailCountTo(request, kaiEmail), { timeout: 30_000 }).toBe(1);
  await host.context.close();
});

// M8 ticket 16: the album vote by keyboard alone. In the Voting block the host starts voting, moves
// an award up (the focus stays on the moved row's button) and turns voting off through its
// confirmation; a guest reaches a star by Tab, votes with Space, moves the vote with Enter and takes
// it back, the focus staying on the star; picks an award in the picker; and reaches the viewer's
// star.
test("the album vote by keyboard alone: the host's Voting block, a guest's stars, the award picker and the viewer's star", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "keyboard-voting", { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" });
  const editor = host.page.url();
  const album = (on: Page) => on.locator('[data-slot="album"]');
  const picture = async (name: string, background: string) => ({
    name,
    mimeType: "image/jpeg",
    buffer: await sharp({ create: { width: 1200, height: 900, channels: 3, background } }).jpeg().toBuffer(),
  });
  await host.page.goto(host.link);
  await album(host.page).getByLabel(/^Add photos/).setInputFiles([await picture("garden.jpg", "#2f6b3a"), await picture("cake.jpg", "#c0506a")]);
  await expect(album(host.page).locator("li[data-item]")).toHaveCount(2, { timeout: 20_000 });
  await host.page.goto(editor);

  // The block, walked from its own fields (the sheet's other groups have tests of their own): Start
  // voting, back from Who may vote, then a second award moved up, by keyboard.
  const page = host.page;
  const block = (await openSettings(page)).locator('[data-slot="voting-block"]');
  await savedAfter(page, () => block.getByRole("button", { name: "Best photo", exact: true }).click());
  const whoMayVote = block.getByLabel("Who may vote", { exact: true });
  await whoMayVote.focus();
  await tabThroughFields(page, block.getByRole("button", { name: "Start voting" }), "Shift+Tab");
  await savedAfter(page, () => page.keyboard.press("Enter"));
  await expect(block).toHaveAttribute("data-state", "open");
  // Start voting gives way to Close voting; the walk goes on from Who may vote, through the
  // closing time, to the awards.
  await whoMayVote.focus();
  await tabThroughFields(page, block.getByRole("button", { name: "Move Best photo up" }));
  await savedAfter(page, () => page.keyboard.press("Enter"));
  // First now, it cannot go further up: the focus is on its other move button.
  await expect(block.getByRole("button", { name: "Move Best photo down" })).toBeFocused();
  await expectVisibleFocus(page);

  // A guest, at an address of their own: their numbers follow their own order.
  const guest = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await guest.goto(host.link);
  await guest.getByRole("button", { name: "Going" }).click();
  await guest.getByLabel("Your name").fill("Ana Ruiz");
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await guest.getByRole("dialog", { name: "Your RSVP" }).getByRole("button", { name: "Close" }).click();
  const star = (n: number) => album(guest).getByRole("button", { name: `Vote for Photo ${n}`, exact: true });
  const answered = () => guest.waitForResponse((response) => response.request().method() === "POST" && response.request().headers()["next-action"] !== undefined);

  // Space gives the vote, Enter on another star moves it, Enter again takes it back.
  await tabTo(guest, star(1));
  let answer = answered();
  await guest.keyboard.press("Space");
  await answer;
  await expect(star(1)).toHaveAttribute("aria-pressed", "true");
  await expect(star(1)).toBeFocused();
  await expectVisibleFocus(guest);
  await tabTo(guest, star(2));
  answer = answered();
  await guest.keyboard.press("Enter");
  await answer;
  await expect(star(2)).toHaveAttribute("aria-pressed", "true");
  await expect(star(1)).toHaveAttribute("aria-pressed", "false");
  await expect(star(2)).toBeFocused();
  await expectVisibleFocus(guest);
  answer = answered();
  await guest.keyboard.press("Enter");
  await answer;
  await expect(star(2)).toHaveAttribute("aria-pressed", "false");
  await expect(star(2)).toBeFocused();
  await expectVisibleFocus(guest);

  // The picker, above the grid: Favourite, back by Shift+Tab, and Enter.
  const picker = album(guest).getByRole("group", { name: "Awards", exact: true });
  await tabThroughFields(guest, picker.getByRole("button", { name: "Favourite", exact: true }), "Shift+Tab");
  await guest.keyboard.press("Enter");
  await expect(picker.getByRole("button", { name: "Favourite", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectVisibleFocus(guest);

  // The viewer's star, by Tab.
  await tabTo(guest, album(guest).getByRole("button", { name: "Photo 1", exact: true }));
  await guest.keyboard.press("Enter");
  const viewer = guest.getByRole("dialog", { name: "Photo 1 of 2" });
  await expect(viewer).toBeVisible();
  await tabTo(guest, viewer.getByRole("button", { name: "Vote for this photo" }));
  answer = answered();
  await guest.keyboard.press("Enter");
  await answer;
  await expect(viewer.getByRole("button", { name: "Vote for this photo" })).toHaveAttribute("aria-pressed", "true");
  await guest.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // Turn off voting's confirmation, back from Who may vote by Tab and Enter, once the votes are
  // counted.
  await whoMayVote.focus();
  await tabThroughFields(page, block.getByRole("button", { name: "Turn off voting" }), "Shift+Tab");
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("alertdialog", { name: "Turn off voting?" });
  await expect(confirm.getByRole("button", { name: "Turn it off" })).toBeEnabled();
  await tabTo(page, confirm.getByRole("button", { name: "Turn it off" }));
  await savedAfter(page, () => page.keyboard.press("Enter"));
  await expect(confirm).toBeHidden();
  await expect(block).toHaveAttribute("data-state", "off");
  await Promise.all([guest.context().close(), host.context.close()]);
});
