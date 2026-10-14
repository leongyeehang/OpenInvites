import sharp from "sharp";
import { createDraft, createPublished } from "./events";
import { latestMailTo, newHost, OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// Ticket 20 (spec, story 65): when the guest's device asks for reduced motion, nothing moves
// anywhere. After each thing a person does, the page is running no animation or transition, and
// no element (nor its ::before or ::after) would run one: every duration is zero.
test.use({ contextOptions: { reducedMotion: "reduce" } });

async function expectStill(page: Page, where: string) {
  const moving = await page.evaluate(() => {
    const running = document.getAnimations().map((animation) => `${animation.constructor.name} on ${describe(animation.effect instanceof KeyframeEffect ? animation.effect.target : null)}`);
    const timed = [...document.querySelectorAll("*")].flatMap((element) =>
      [null, "::before", "::after"].flatMap((pseudo) => {
        const style = getComputedStyle(element, pseudo);
        const lasts = (durations: string) => durations.split(",").some((duration) => parseFloat(duration) > 0);
        return lasts(style.animationDuration) || lasts(style.transitionDuration)
          ? [`${describe(element)}${pseudo ?? ""}: animation ${style.animationName} ${style.animationDuration}, transition ${style.transitionProperty} ${style.transitionDuration}`]
          : [];
      }),
    );
    return [...running, ...timed];

    function describe(element: Element | null) {
      if (!element) return "nothing";
      const classes = typeof element.className === "string" ? element.className.split(/\s+/).slice(0, 4).join(".") : "";
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    }
  });
  expect.soft(moving, `what moves on ${where}`).toEqual([]);
}

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
  await host.goto("/events/new");
  await host.getByRole("button", { name: "Add a question" }).click();
  await expectStill(host, "the event form, creating");
  const link = await createDraft(host, { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "1", questions: [{ prompt: "Any allergies?" }] });
  const manage = host.url();
  await host.goto(link);
  await expectStill(host, "a draft, as its host sees it");
  await page.goto(link);
  await expectStill(page, "a draft, as a guest sees it");
  await host.goto(manage);
  await host.getByRole("button", { name: "Publish" }).click();
  await expect(host.getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });
  await host.getByRole("button", { name: "Delete event" }).hover();
  await host.getByRole("button", { name: "Delete event" }).click();
  await expect(host.getByRole("alertdialog")).toBeVisible();
  await expectStill(host, "the event form, with the delete dialog open");
  await host.keyboard.press("Escape");
  await expectStill(host, "the event form, the dialog closed");

  // The Design drawer: opened, a template, a knob, closed.
  await host.goto(link);
  await host.getByRole("button", { name: "Design" }).hover();
  await host.getByRole("button", { name: "Design" }).click();
  const drawer = host.getByRole("dialog", { name: "Design" });
  await expectStill(host, "the Design drawer, open");
  // Vows, like Birthday, has guests answer in the sheet.
  await drawer.getByRole("radio", { name: "Vows" }).check();
  // It sparkles too, and under reduced motion the sparkles are not drawn.
  await expect(host.locator('[data-effect="sparkles"]')).toBeHidden();
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("radio", { name: "Glass" }).check();
  await expect(drawer.getByText("Theme: Custom, started from Vows")).toBeVisible();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain("rose-garden");
  await expectStill(host, "the Design drawer, after a template and a knob");
  await host.keyboard.press("Escape");
  await expectStill(host, "the event page, the drawer closed");

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
  await expect(sheet.getByText("You’re going!")).toBeVisible();
  await expectStill(page, "the RSVP sheet, the confirmation");
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expectStill(page, "the event page, the sheet closed");

  // Inline, another guest answers under the buttons, step by step, and their Going brings no
  // confetti.
  await host.getByRole("button", { name: "Design" }).click();
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("group", { name: "RSVP style" }).getByRole("radio", { name: "Inline" }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('rsvpStyle\\":\\"inline');
  await drawer.getByRole("group", { name: "Effect" }).getByRole("radio", { name: "Confetti" }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('effect\\":\\"confetti');
  const second = await browser.newContext({ reducedMotion: "reduce" });
  const inline = await second.newPage();
  await inline.goto(link);
  await inline.getByRole("button", { name: "Going" }).click();
  await inline.getByLabel("Your name").fill("Mei Tan");
  await expect(inline.getByRole("dialog")).toHaveCount(0);
  await expectStill(inline, "the Inline RSVP flow, the name step");
  await inline.getByRole("button", { name: "Continue" }).click();
  await inline.getByRole("radio", { name: "+1" }).click();
  await expectStill(inline, "the Inline RSVP flow, the plus-ones step");
  await inline.getByRole("button", { name: "Continue" }).click();
  await expectStill(inline, "the Inline RSVP flow, the questions step");
  await inline.getByRole("button", { name: "Send RSVP" }).click();
  await expect(inline.getByText("You’re going!")).toBeVisible();
  // It would come with the confirmation, so none now is none at all.
  expect(await inline.locator('[data-effect="confetti"]').count()).toBe(0);
  await expectStill(inline, "the Inline RSVP flow, the confirmation, with confetti chosen");
  await second.close();

  // Doodles: the shapes are not drawn, and the date sticker sits tilted and still, here and on the
  // poster below.
  await drawer.getByRole("group", { name: "Effect" }).getByRole("radio", { name: "Doodles" }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('effect\\":\\"doodles');
  await expectStill(host, "the Design drawer, with doodles");
  await page.reload();
  await expect(page.locator('[data-effect="doodles"]')).toBeHidden();
  await expectStill(page, "the event page, with doodles");

  // The host's picture as the poster.
  await drawer.getByLabel("Upload your photo or poster").setInputFiles(await picture());
  await expect(drawer.getByRole("group", { name: "Use it as" })).toBeVisible({ timeout: 20_000 });
  await drawer.getByRole("group", { name: "Use it as" }).getByRole("radio", { name: "Poster" }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain("poster.webp");
  await expectStill(host, "the Design drawer, with the host's picture");
  await page.reload();
  await expect(page.locator('[data-slot="poster-card"] img')).toBeVisible();
  await expectStill(page, "the event page, poster mode");

  // The Broadsheet: its page rises into place, and its receipt's stamp comes down, only when
  // motion is welcome. A guest replies on its ballot.
  await drawer.getByRole("group", { name: "Layout" }).getByRole("radio", { name: /^Broadsheet/ }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('data-layout="broadsheet"');
  await expectStill(host, "the Design drawer, the Broadsheet chosen");
  const third = await browser.newContext({ reducedMotion: "reduce" });
  const ballot = await third.newPage();
  await ballot.goto(link);
  await expectStill(ballot, "the Broadsheet");
  await ballot.getByRole("radio", { name: "I’ll be there" }).check();
  await ballot.getByLabel("Your name").fill("Tom Ong");
  await ballot.getByRole("button", { name: "One guest more" }).click();
  await expectStill(ballot, "the Broadsheet's ballot, filled in");
  await ballot.getByRole("button", { name: "Post my reply" }).click();
  await expect(ballot.getByText("Received", { exact: true })).toBeVisible();
  await expectStill(ballot, "the Broadsheet's receipt");
  await third.close();

  // The Thread: everything is there at once, the host is never seen typing, and the page jumps to
  // the newest line rather than scrolling. A guest answers in its conversation.
  await drawer.getByRole("group", { name: "Layout" }).getByRole("radio", { name: /^Thread/ }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('data-layout="thread"');
  await expectStill(host, "the Design drawer, the Thread chosen");
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
  await expect(chat.locator('[data-slot="done"]')).toBeVisible();
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
  await host.getByRole("button", { name: "Publish" }).click();
  await expect(host.getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });
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
  await expect(bea.getByText("This event is full. If the host approves your reply, you’ll join the waitlist.")).toBeVisible();
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
    await guest.getByRole("button", { name: "Show my RSVP" }).click();
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
  await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible({ timeout: 15_000 });
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
