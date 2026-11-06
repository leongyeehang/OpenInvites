import sharp from "sharp";
import { closeDesign, createDraft, createPublished, type DesignSheet, openDesign, openMore, openSettings, publishInEditor, savedAfter } from "./events";
import { openHome } from "./home";
import { latestMailTo, newHost, OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
import { expectStill } from "./still";
import { hostWithShelves } from "./dashboard";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// Ticket 20 (spec, story 65): when the guest's device asks for reduced motion, nothing moves
// anywhere. After each thing a person does, the page is running no animation or transition, and
// no element (nor its ::before or ::after) would run one: every duration is zero (e2e/still.ts).
test.use({ contextOptions: { reducedMotion: "reduce" } });

test("under reduced motion nothing moves, on any page, whatever a person does", async ({ page, browser, request }) => {
  test.setTimeout(240_000);
  for (const path of ["/", "/sign-up", "/sign-in", "/privacy", "/terms", "/too-fast", "/e/abcdefghij"]) {
    await page.goto(path);
    await expectStill(page, path);
  }

  // A host with an event, on their own pages: the form as they create it, and their draft.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const host = await context.newPage();
  await signUpVerified(host, request, "still");
  await host.goto("/dashboard");
  await expectStill(host, "the dashboard");
  // The editor, and its Settings sheet opened with a question added.
  await host.goto("/events/new");
  await expect(host.getByRole("textbox", { name: "Event title" })).toBeVisible({ timeout: 20_000 });
  await expectStill(host, "the editor, a blank invitation");
  await (await openSettings(host)).getByRole("button", { name: "Add a question" }).click();
  await expectStill(host, "the editor's Settings sheet, a question added");
  const link = await createDraft(host, { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "1", questions: [{ prompt: "Any allergies?" }] });
  const manage = host.url();
  await host.goto(link);
  await expectStill(host, "a draft, as its host sees it");
  await page.goto(link);
  await expectStill(page, "a draft, as a guest sees it");
  await host.goto(manage);
  await publishInEditor(host);
  await openMore(host);
  await host.getByRole("button", { name: "Delete event" }).hover();
  await host.getByRole("button", { name: "Delete event" }).click();
  await expect(host.getByRole("alertdialog")).toBeVisible();
  await expectStill(host, "the event form, with the delete dialog open");
  await host.keyboard.press("Escape");
  await expectStill(host, "the event form, the dialog closed");
  // More is still open behind it: closed too, back to the invitation.
  if (await host.getByRole("dialog", { name: "More" }).isVisible()) await host.keyboard.press("Escape");
  await expect(host.getByRole("dialog", { name: "More" })).toBeHidden();

  // The design sheets: the Poster sheet opened, a gallery poster, a knob in the Theme sheet, closed.
  // Each choice is made in its sheet, saved, and the page looked at with the sheet still open.
  const choose = async (sheet: DesignSheet, group: string, name: RegExp, what: string, tab?: "Gallery" | "Colour") => {
    const opened = await openDesign(host, sheet, tab);
    await savedAfter(host, () => opened.getByRole("group", { name: group, exact: true }).getByRole("radio", { name }).check());
    await expectStill(host, what);
    await closeDesign(host, sheet);
  };
  await host.getByRole("navigation", { name: "Design the invitation" }).getByRole("button", { name: "Poster" }).hover();
  await openDesign(host, "Poster", "Gallery");
  await expectStill(host, "the Poster sheet, open");
  await closeDesign(host, "Poster");
  // Rose garden sparkles, and under reduced motion the sparkles are not drawn.
  await choose("Poster", "Poster", /^Rose garden$/, "the Poster sheet, a gallery poster chosen", "Gallery");
  await expect(host.locator('[data-effect="sparkles"]')).toBeHidden();
  await choose("Theme", "RSVP buttons", /^Glass$/, "the Theme sheet, a knob changed");
  const poster = await openDesign(host, "Poster");
  await expect(poster.getByRole("button", { name: "Restore the Rose garden look" })).toBeVisible();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain("rose-garden");
  await host.keyboard.press("Escape");
  await expectStill(host, "the editor, the sheet closed");

  // A guest answers in the sheet, from the first tap to the confirmation, and closes it.
  await page.goto(link);
  await expectStill(page, "the event page");
  await page.getByRole("button", { name: "Going" }).hover();
  await page.getByRole("button", { name: "Going" }).click();
  const sheet = page.getByRole("dialog", { name: "Your RSVP" });
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await expectStill(page, "the RSVP sheet, open");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByRole("radio", { name: "+1" }).click();
  await expectStill(page, "the RSVP sheet, grown by a step");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await expectStill(page, "the RSVP sheet, the confirmation");
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expectStill(page, "the event page, the sheet closed");

  // With confetti chosen, another guest answers step by step, and their Going brings none.
  await choose("Effect", "Effect", /^Confetti/, "the Effect sheet, confetti chosen");
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('effect\\":\\"confetti');
  const second = await browser.newContext({ reducedMotion: "reduce" });
  const inline = await second.newPage();
  await inline.goto(link);
  await inline.getByRole("button", { name: "Going" }).click();
  await inline.getByLabel("Your name").fill("Mei Tan");
  await expectStill(inline, "the RSVP sheet with confetti chosen, the name step");
  await inline.getByRole("button", { name: "Continue" }).click();
  await inline.getByRole("radio", { name: "+1" }).click();
  await expectStill(inline, "the RSVP sheet with confetti chosen, the plus-ones step");
  await inline.getByRole("button", { name: "Continue" }).click();
  await expectStill(inline, "the RSVP sheet with confetti chosen, the questions step");
  await inline.getByRole("button", { name: "Send RSVP" }).click();
  await expect(inline.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  // It would come with the confirmation, so none now is none at all.
  expect(await inline.locator('[data-effect="confetti"]').count()).toBe(0);
  await expectStill(inline, "the RSVP sheet, the confirmation, with confetti chosen");
  await second.close();

  // Doodles: the shapes are not drawn.
  await choose("Effect", "Effect", /^Doodles/, "the Effect sheet, with doodles");
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('effect\\":\\"doodles');
  await page.reload();
  await expect(page.locator('[data-effect="doodles"]')).toBeHidden();
  await expectStill(page, "the event page, with doodles");

  // The host's picture as the poster.
  const upload = await openDesign(host, "Poster", "Upload");
  await upload.getByLabel("Upload your photo or poster").setInputFiles(await picture());
  await expect.poll(() => guestHtml(request, link), { timeout: 20_000 }).toContain("poster.webp");
  await expectStill(host, "the Poster sheet, with the host's picture");
  await closeDesign(host, "Poster");
  await page.reload();
  await expect(page.locator('[data-slot="poster-card"] img')).toBeVisible();
  await expectStill(page, "the event page, poster mode");

  // The Broadsheet: its page rises into place, and its receipt's stamp comes down, only when
  // motion is welcome. A guest replies on its ballot.
  await choose("Theme", "Layout", /^Broadsheet/, "the Theme sheet, the Broadsheet chosen");
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('data-layout="broadsheet"');
  const third = await browser.newContext({ reducedMotion: "reduce" });
  const ballot = await third.newPage();
  await ballot.goto(link);
  await expectStill(ballot, "the Broadsheet");
  await ballot.getByRole("radio", { name: "I’ll be there" }).check();
  await ballot.getByLabel("Your name").fill("Tom Ong");
  await ballot.getByRole("button", { name: "One guest more" }).click();
  await expectStill(ballot, "the Broadsheet's ballot, filled in");
  await ballot.getByRole("button", { name: "Post my reply" }).click();
  await expect(ballot.getByText("Received", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expectStill(ballot, "the Broadsheet's receipt");
  await third.close();

  // The Thread: everything is there at once, the host is never seen typing, and the page jumps to
  // the newest line rather than scrolling. A guest answers in its conversation.
  await choose("Theme", "Layout", /^Thread/, "the Theme sheet, the Thread chosen");
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('data-layout="thread"');
  const fourth = await browser.newContext({ reducedMotion: "reduce" });
  const chat = await fourth.newPage();
  await chat.goto(link);
  await expectStill(chat, "the Thread");
  await chat.getByRole("button", { name: "Going", exact: true }).click();
  expect(await chat.locator('[data-slot="typing"]').count()).toBe(0);
  await chat.getByLabel("Your name").fill("Ana Lim");
  await expectStill(chat, "the Thread's conversation, the name in the composer");
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  expect(await chat.locator('[data-slot="typing"]').count()).toBe(0);
  await chat.getByRole("button", { name: "+1", exact: true }).click();
  await expectStill(chat, "the Thread's conversation, a question");
  await chat.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(chat.locator('[data-slot="done"]')).toBeVisible({ timeout: 15_000 });
  expect(await chat.locator('[data-slot="typing"]').count()).toBe(0);
  await expectStill(chat, "the Thread's done bubble");
  await fourth.close();

  // The host's guest list, with the guest opened for editing, and the share screen.
  await host.goto(`${manage}/guests`);
  await host.getByRole("button", { name: "Edit" }).first().click();
  await expectStill(host, "the guest list");
  await host.goto(`${manage}/share`);
  await expectStill(host, "the share screen");

  // Called off: the page with its notice.
  await host.goto(manage);
  await openMore(host);
  await host.getByRole("button", { name: "Cancel event" }).click();
  await host.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.getByText("Cancelled", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expectStill(page, "a cancelled event");
  await context.close();

  // The operator's instance settings.
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto("/instance");
  await expectStill(page, "the instance settings");
});

// A guest of their own, at an address of their own, whose device asks for reduced motion.
async function stillGuest(browser: Browser): Promise<Page> {
  return (await browser.newContext({ reducedMotion: "reduce", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
}

// The code in the newest email to the address, alone on its line.
async function codeSentTo(request: APIRequestContext, email: string) {
  return (await latestMailTo(request, email)).match(/^([0-9]{6})\r?$/m)![1];
}

// M3 (ticket 11): nothing M3 added moves either. On the Poster, in the sheet, on an event that
// proves the guest's email, takes one guest and asks the host to approve each reply: the code step,
// a reply waiting for the host, the event full, a reply on the waitlist and one declined; the
// host's guest list with its new sections, and the invites page; a report sent, and the operator's
// reports page.
// Home page, ticket 05: the home page `app` draws, Open, under a light gallery poster and a dark
// one. The entrance its pieces rise in with is not run. Its other two states are checked the same
// way on an instance of their own, in e2e/home-page.spec.ts.
test("under reduced motion the home page is still, under the Balloons poster and the Disco poster", async ({ page }) => {
  for (const poster of ["Balloons", "Disco"] as const) {
    await openHome(page, poster);
    await expect(page.getByRole("heading", { level: 1, name: "OpenInvites" })).toBeVisible();
    await expectStill(page, `the home page, Open, under ${poster}`);
  }
});

test("under reduced motion nothing M3 added moves: the code step, approval and the waitlist in the sheet, invites, and reports", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const host = await context.newPage();
  await signUpVerified(host, request, "still-m3");
  const link = await createDraft(host, { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0", capacity: "1", approval: true, email: "optional", verifyEmail: true });
  const manage = host.url();
  await publishInEditor(host);
  const decide = async (name: string, button: "Approve" | "Decline", lands: RegExp) => {
    await host.goto(`${manage}/guests`);
    await host.getByRole("region", { name: /^Waiting for approval/ }).getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: button }).click();
    await expect(host.getByRole("region", { name: lands }).getByText(name)).toBeVisible({ timeout: 15_000 });
  };
  // A Going reply in the sheet, with the email when one is given.
  const reply = async (guest: Page, name: string, email?: string) => {
    await guest.goto(link);
    await guest.getByRole("button", { name: "Going" }).click();
    const sheet = guest.getByRole("dialog", { name: "Your RSVP" });
    await sheet.getByLabel("Your name").fill(name);
    if (email) await sheet.getByLabel("Email").fill(email);
    await sheet.getByRole("button", { name: "Send RSVP" }).click();
    return sheet;
  };

  // Arjun proves his email with the code and waits for the host, who approves him: the one place.
  const arjun = await stillGuest(browser);
  const email = newHost("still-m3-guest").email;
  const sheet = await reply(arjun, "Arjun Rao", email);
  await expect(sheet.getByLabel("Code")).toBeFocused({ timeout: 15_000 });
  await expectStill(arjun, "the code step, in the sheet");
  await sheet.getByLabel("Code").fill(await codeSentTo(request, email));
  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(sheet.getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible({ timeout: 15_000 });
  await expectStill(arjun, "a reply waiting for the host's approval, in the sheet");
  await decide("Arjun Rao", "Approve", /^Going/);

  // Bea finds the event full; she and Chen wait for the host, who puts Bea on the waitlist and
  // declines Chen.
  const [bea, chen] = [await stillGuest(browser), await stillGuest(browser)];
  await bea.goto(link);
  await expect(bea.getByText("This event is full. A Going reply joins the waitlist once the host approves it.")).toBeVisible();
  await expectStill(bea, "the event page, full");
  await expect((await reply(bea, "Bea Lim")).getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible({ timeout: 15_000 });
  await expect((await reply(chen, "Chen Wei")).getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible({ timeout: 15_000 });
  await host.goto(`${manage}/guests`);
  await expectStill(host, "the guest list, two replies waiting for approval");
  await decide("Bea Lim", "Approve", /^Waitlist/);
  await decide("Chen Wei", "Decline", /^Declined/);
  await expectStill(host, "the guest list, with the waitlist and a reply declined");
  for (const [guest, heading] of [
    [bea, "You’re on the waitlist, number 1."],
    [chen, "The host wasn’t able to accept your reply."],
  ] as const) {
    await guest.reload();
    await guest.getByRole("button", { name: "Change", exact: true }).click();
    await expect(guest.getByRole("dialog", { name: "Your RSVP" }).getByRole("heading", { name: heading })).toBeVisible();
    await expectStill(guest, `the sheet: ${heading}`);
  }

  // The invites page, an invite made and its delete dialog open.
  await host.goto(`${manage}/invites`);
  await host.getByLabel("Name", { exact: true }).fill("Mei Lin");
  await host.getByRole("button", { name: "Make link" }).click();
  await expect(host.getByRole("status")).toHaveText("Made a link for Mei Lin.", { timeout: 15_000 });
  await expectStill(host, "the invites page, an invite made");
  await host.getByRole("button", { name: "Delete the invite for Mei Lin" }).hover();
  await host.getByRole("button", { name: "Delete the invite for Mei Lin" }).click();
  await expect(host.getByRole("alertdialog")).toBeVisible();
  await expectStill(host, "the invites page, the delete dialog");

  // A report, from the report form, and the operator's reports page.
  await page.goto(link);
  await page.getByRole("contentinfo").getByRole("link", { name: "Report this event" }).click();
  await expectStill(page, "the report form");
  await page.getByLabel("What’s wrong with this page?").fill(`This page is not what it says it is (still ${Date.now().toString(36)}).`);
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thank you. Your report has reached whoever runs this site.")).toBeVisible({ timeout: 15_000 });
  await expectStill(page, "the report form, sent");
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto("/instance/reports");
  await expectStill(page, "the reports page");

  for (const guest of [arjun, bea, chen]) await guest.context().close();
  await context.close();
});

// The Broadsheet and the Thread on an event that proves the guest's email and takes one guest: the
// code step, the event full, and a reply on the waitlist, which the Broadsheet stamps Waitlisted.
test("under reduced motion nothing moves in the code step, the full notice or the waitlist, on the Broadsheet and in the Thread", async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  for (const layout of ["Broadsheet", "Thread"] as const) {
    const host = await createPublished(browser, request, `still-${layout.toLowerCase()}`, {
      title: "Ada’s birthday",
      start: "2027-03-06T19:00",
      plusOnes: "0",
      capacity: "1",
      email: "optional",
      verifyEmail: true,
      layout,
    });
    const where = `the ${layout}`;
    // A Going reply, with the email when one is given.
    const reply = async (guest: Page, name: string, email?: string) => {
      await guest.goto(host.link);
      if (layout === "Broadsheet") {
        await guest.getByRole("radio", { name: "I’ll be there", exact: true }).check();
        await guest.getByLabel("Your name").fill(name);
        if (email) await guest.getByLabel("Email").fill(email);
        await guest.getByRole("button", { name: "Post my reply" }).click();
        return;
      }
      await guest.getByRole("button", { name: "Going", exact: true }).click();
      await guest.getByLabel("Your name").fill(name);
      await guest.getByRole("button", { name: "Send", exact: true }).click();
      if (!email) return guest.getByRole("button", { name: "Skip", exact: true }).click();
      await guest.getByLabel("Email").fill(email);
      await guest.getByRole("button", { name: "Send", exact: true }).click();
    };

    const arjun = await stillGuest(browser);
    const email = newHost(`still-${layout.toLowerCase()}-guest`).email;
    await reply(arjun, "Arjun Rao", email);
    await expect(arjun.getByLabel("Code")).toBeFocused({ timeout: 15_000 });
    await expectStill(arjun, `${where}'s code step`);
    await arjun.getByLabel("Code").fill(await codeSentTo(request, email));
    await arjun.getByRole("button", { name: layout === "Thread" ? "Send" : "Confirm", exact: true }).click();
    await expect(layout === "Thread" ? arjun.locator('[data-slot="done"]') : arjun.getByRole("heading", { name: "You’re going!" })).toBeVisible({ timeout: 15_000 });
    await expectStill(arjun, `${where}, Going once the code is right`);

    const bea = await stillGuest(browser);
    await bea.goto(host.link);
    await expect(bea.getByText("This event is full. You can join the waitlist.")).toBeVisible();
    await expectStill(bea, `${where}, full`);
    await reply(bea, "Bea Lim");
    await expect(layout === "Thread" ? bea.locator('[data-slot="done"]') : bea.getByText("Waitlisted", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expectStill(bea, `${where}, on the waitlist`);
    for (const guest of [arjun, bea]) await guest.context().close();
    await host.context.close();
  }
});

// What a guest's browser is sent for the page, which is the saved theme.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

// A poster made in another tool.
async function picture() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1350"><rect width="100%" height="100%" fill="#1d2340"/><circle cx="450" cy="450" r="220" fill="#f5c16c"/></svg>`;
  return { name: "poster.jpg", mimeType: "image/jpeg", buffer: await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer() };
}

// M4's extras under reduced motion: a reaction's six, the album's viewer, an editor sheet beside the
// invitation on a desktop, and a date poll's sheet.
test("under reduced motion the reactions, the album, the desktop editor and the vote are still", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "still-extras", { title: "Ada’s picnic", start: "2026-01-10T12:00", plusOnes: "0" });
  const page = host.page;
  await page.emulateMedia({ reducedMotion: "reduce" });
  const editor = page.url();

  await page.goto(host.link);
  const box = page.getByLabel("Add a comment");
  await box.fill("See you on the lawn.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });
  await page.getByRole("listitem").filter({ hasText: "See you on the lawn." }).getByRole("button", { name: "Add a reaction" }).click();
  await expect(page.getByRole("group", { name: "React with" })).toBeVisible();
  await expectStill(page, "a comment's six reactions, open");
  await page.getByRole("group", { name: "React with" }).getByRole("button", { name: "Party" }).click();
  await expectStill(page, "a comment with a reaction");

  const album = page.locator('[data-slot="album"]');
  const picture = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#3a6b4f" } }).jpeg().toBuffer();
  await album.getByLabel("Add photos").setInputFiles([{ name: "lawn.jpg", mimeType: "image/jpeg", buffer: picture }]);
  await album.getByRole("button", { name: /^Photo 1 by / }).click({ timeout: 20_000 });
  await expect(page.getByRole("dialog", { name: "Photo 1 of 1" })).toBeVisible();
  await expectStill(page, "the photo viewer");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(editor);
  await page.getByRole("navigation", { name: "Design the invitation" }).getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expectStill(page, "the Settings sheet beside the invitation at 1024 pixels");
  await page.keyboard.press("Escape");

  // A second event, whose date is put to a vote.
  await page.goto("/events/new");
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await savedAfter(page, async () => {
    const title = page.getByRole("textbox", { name: "Event title" });
    await title.fill("Ada’s supper");
    await title.press("Enter");
  });
  await page.getByRole("button", { name: /^When:/ }).click();
  const when = page.getByRole("dialog", { name: "When" });
  await when.getByRole("button", { name: "Not sure yet? Let guests vote" }).click();
  await when.getByLabel("Date 1", { exact: true }).fill("2027-05-08");
  await when.getByLabel("Date 2", { exact: true }).fill("2027-05-09");
  await expectStill(page, "the When sheet's candidates");
  await savedAfter(page, () => when.getByRole("button", { name: "Done" }).click());
  await publishInEditor(page);
  await page.getByRole("link", { name: "Preview" }).click();
  await page.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Vote on a date" }).click();
  await expect(page.getByRole("dialog", { name: "Which dates work for you?" })).toBeVisible();
  await expectStill(page, "the vote's sheet");
  await host.context.close();
});

// The dashboard with an event on every shelf, still (dashboard, ticket 05): no tile lifts, nothing
// fades in, and the glow behind it never moves.
test("under reduced motion the dashboard with an event on every shelf is still", async ({ browser, request }) => {
  test.slow();
  const host = await hostWithShelves(browser, request, "still-shelves");
  await expectStill(host.page, "the dashboard, every shelf");
  await host.page.getByRole("region", { name: "Coming up", exact: true }).getByRole("link").first().hover();
  await expectStill(host.page, "the dashboard, a tile hovered");
  await host.context.close();
});
