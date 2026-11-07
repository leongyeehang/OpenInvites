import { expectNoSeriousViolations } from "./axe";
import { createDraft, createPublished, type DraftFields, eventLinkIn, openMore, openSettings, publishInEditor, savedAfter, typeTitle } from "./events";
import { latestMailTo, mailCountTo, newHost, signUpVerified } from "./hosts";
import { openMyReply, replyBar } from "./reply";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// M6 ticket 07: an invite-only event opens only to its hosts and to a device with a pass. Anyone
// else gets the locked page, with the host's name and nothing of the event; an invitee proves the
// email the host invited them with by a code read from Mailpit, once on each device, and is in, with
// the invite as who they are; an invitee with no email gets in by their personal invite link alone.
// The calendar file, the preview card and the report form are closed to anyone not in, a cancelled
// invite-only event shows its notice only to those in, and a vote from outside is refused. The host
// turns invite-only on with the Settings sheet's switch. Every guest is on a device of their own,
// reaching the instance from an address of their own, so each keeps within the test profile's five
// replies and five emails a minute. Each test runs at 390 pixels in the mobile project and at
// desktop width in the other.
//
// M6 ticket 08: turning invite-only on invites everyone who already replied, past the 500 invites a
// host may make, so nobody who replied is locked out: a guest without an email stays in by their
// cookie and their edit link, one with an email proves it once on each device and finds their
// reply theirs. The Invites page says invite-only is on and which rows their link alone lets in.
// Turning it off locks nobody out and deletes nothing.

const INVITE_ONLY = "Invite-only: only people on the invite list can open the invitation";
const SENT = "If that email is on the invite list, a code is on its way.";
const INVITE_LINK = /^https?:\/\/\S+\/i\/[A-Za-z0-9]{24}$/;
const EDIT_LINK = /^https?:\/\/\S+\/r\/\S+$/;
const HINT =
  "They prove their email on each device they use; someone with only a phone number gets in by their link. Guests who already replied are added to the list; those with an email prove it once.";
const BANNER = "Invite-only is on: only these people can open the invitation.";
const LINK_LETS_IN = "Anyone with this link can open the invitation";

// A title nothing else on the page could contain, so its absence means something.
const SECRET = { title: "Ada’s secret supper", start: "2027-03-06T19:00", plusOnes: "0", email: "optional", verifyEmail: true, location: "The back room at Lau Pa Sat", description: "Bring a story." } satisfies DraftFields;

// A guest on a device of their own.
async function newGuest(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  return context.newPage();
}

// The host, in the editor, turns invite-only on, and follows the sheet's link to the invite list.
async function turnInviteOnlyOn(page: Page) {
  const sheet = await openSettings(page);
  await savedAfter(page, () => sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel(INVITE_ONLY, { exact: true }).check());
  await expect(sheet.getByText(HINT, { exact: true })).toBeVisible();
  await sheet.getByRole("link", { name: "Manage the invite list" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Invites");
}

function inviteRow(hostPage: Page, name: string) {
  return hostPage.getByRole("listitem").filter({ has: hostPage.getByText(name, { exact: true }) });
}

// The host makes an invite on the invites page, which is open, and reads its link from its row.
async function makeInvite(hostPage: Page, name: string, { email, phone }: { email?: string; phone?: string }): Promise<string> {
  await hostPage.getByLabel("Name", { exact: true }).fill(name);
  if (email) await hostPage.getByLabel("Email", { exact: true }).fill(email);
  if (phone) await hostPage.getByLabel("Phone number", { exact: true }).fill(phone);
  await hostPage.getByRole("button", { name: "Make link" }).click();
  await expect(hostPage.getByRole("status").filter({ hasText: /^Made a link for / })).toHaveText(`Made a link for ${name}.`, { timeout: 15_000 });
  return (await inviteRow(hostPage, name).getByText(INVITE_LINK).textContent())!.trim();
}

// The locked page: the host's name and the way in, nothing of the event.
async function expectLocked(page: Page, hostName: string) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A private invitation");
  await expect(page.getByText(`from ${hostName}`, { exact: true })).toBeVisible();
  await expect(page.getByText("Lost your link? Ask the host.")).toBeVisible();
  await expect(page).toHaveTitle("You’re invited");
  await expect(page.getByText("secret supper")).toHaveCount(0);
}

// The code in the newest email to the address, which is the only thing on its line.
async function codeSentTo(request: APIRequestContext, email: string, after = 0): Promise<string> {
  const code = (await latestMailTo(request, email, after)).match(/^([0-9]{6})\r?$/m)?.[1];
  expect(code, `a code in the email to ${email}`).toBeDefined();
  return code!;
}

// On the locked page, the guest asks for a code for the email shown or typed, and is told the same
// whether or not it is on the list.
async function askForCode(page: Page, email?: string) {
  if (email) await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText(SENT, { exact: true })).toBeVisible({ timeout: 15_000 });
}

async function enterCode(page: Page, code: string) {
  await expect(page.getByLabel("Code", { exact: true })).toBeFocused();
  await page.getByLabel("Code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Open the invitation" }).click();
}

test("an invitee proves their email on each device to open an invite-only event; anyone else sees only the host's name", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "invite-only", SECRET);
  const editor = host.page.url();
  const meiEmail = newHost("invite-only-mei").email;
  const strangerEmail = newHost("invite-only-stranger").email;

  // A guest who opened the link before it was invite-only, and has no invite.
  await page.goto(host.link);
  await expect(page.getByRole("heading", { name: SECRET.title })).toBeVisible();

  // The host turns invite-only on, and lists Mei by her email and Dev by his phone.
  await turnInviteOnlyOn(host.page);
  const meiLink = await makeInvite(host.page, "Mei Lin", { email: meiEmail });
  const devLink = await makeInvite(host.page, "Dev Patel", { phone: "+65 9123 4567" });

  // The guest without an invite now sees the locked page, and its source holds nothing of the event:
  // no title, place or description, no Open Graph and no preview card.
  await page.reload();
  await expectLocked(page, host.name);
  await expectNoSeriousViolations(page, "the locked page");
  const html = await (await request.get(host.link)).text();
  for (const leak of ["secret supper", "Lau Pa Sat", "Bring a story", "og:", "twitter:", "preview.png"]) expect(html).not.toContain(leak);
  // An email not on the list gets the same answer as one on it, and no mail.
  await askForCode(page, strangerEmail);
  await expect(page.getByLabel("Code", { exact: true })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Open the invitation" }).click();
  await expect(page.getByText("That code isn’t right.")).toBeVisible({ timeout: 15_000 });
  await expectLocked(page, host.name);

  // What opens the event by its link is closed to them too: the calendar file and the preview
  // card are not found, and the report form sends them to the locked page.
  expect((await page.request.get(`${host.link}/calendar.ics`)).status()).toBe(404);
  expect((await page.request.get(`${host.link}/preview.png`)).status()).toBe(404);
  await page.goto(`${host.link}/report`);
  await expect(page).toHaveURL(host.link);
  await expectLocked(page, host.name);

  // Mei opens her personal invite link: the locked page, with her email filled in and kept as it is.
  const mei = await newGuest(browser);
  await mei.goto(meiLink);
  await expect(mei).toHaveURL(host.link);
  await expectLocked(mei, host.name);
  await expect(mei.getByLabel("Your email")).toHaveValue(meiEmail);
  await expect(mei.getByLabel("Your email")).toHaveAttribute("readonly", "");
  await askForCode(mei);
  await enterCode(mei, await codeSentTo(request, meiEmail));

  // She is in: the invitation, with her name and email filled in, and her reply needs no second
  // code, though the event checks emails.
  await expect(mei.getByRole("heading", { name: SECRET.title })).toBeVisible({ timeout: 15_000 });
  await expect(mei).toHaveTitle(SECRET.title);
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Your name")).toHaveValue("Mei Lin");
  await expect(mei.getByLabel("Email")).toHaveValue(meiEmail);
  await mei.getByRole("button", { name: "Send RSVP" }).click();
  await expect(mei.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await expect(mei.getByText(meiLink, { exact: true })).toBeVisible();
  expect(await mailCountTo(request, meiEmail)).toBe(1);
  await host.page.reload();
  await expect(inviteRow(host.page, "Mei Lin").getByText("Replied · Going", { exact: true })).toBeVisible();

  // The page is open to her, the calendar file too, and still no preview card for anyone.
  expect((await mei.request.get(`${host.link}/calendar.ics`)).status()).toBe(200);
  expect((await mei.request.get(`${host.link}/preview.png`)).status()).toBe(404);
  expect(await (await mei.request.get(host.link)).text()).not.toContain("og:");

  // On a second device she is asked again, from the event link and from her own invite link after
  // her reply, and once in there, her reply is hers.
  const meiLaptop = await newGuest(browser);
  await meiLaptop.goto(host.link);
  await expectLocked(meiLaptop, host.name);
  await expect(meiLaptop.getByLabel("Your email")).toHaveValue("");
  await meiLaptop.goto(meiLink);
  await expectLocked(meiLaptop, host.name);
  await expect(meiLaptop.getByLabel("Your email")).toHaveValue(meiEmail);
  await askForCode(meiLaptop);
  await enterCode(meiLaptop, await codeSentTo(request, meiEmail, 1));
  await expect(meiLaptop.getByRole("heading", { name: SECRET.title })).toBeVisible({ timeout: 15_000 });
  await openMyReply(meiLaptop);
  await expect(meiLaptop.getByText("You’re going!")).toBeVisible();
  await expect(meiLaptop.getByText(meiLink, { exact: true })).toBeVisible();

  // Dev, invited by phone alone, is let straight in by his link, with his name filled in.
  const dev = await newGuest(browser);
  await dev.goto(devLink);
  await expect(dev).toHaveURL(host.link);
  await expect(dev.getByRole("heading", { name: SECRET.title })).toBeVisible();
  await dev.getByRole("button", { name: "Going", exact: true }).click();
  await expect(dev.getByLabel("Your name")).toHaveValue("Dev Patel");
  // And stays in on the event link.
  await dev.goto(host.link);
  await expect(dev.getByRole("heading", { name: SECRET.title })).toBeVisible();

  // The host sees the invitation whatever their device holds.
  await host.page.goto(host.link);
  await expect(host.page.getByRole("heading", { name: SECRET.title })).toBeVisible();

  // The host deletes Mei's invite: her pass goes with it, and though her reply stays, her devices
  // are locked out.
  await host.page.goto(`${editor}/invites`);
  await host.page.getByRole("button", { name: "Delete the invite for Mei Lin" }).click();
  await host.page.getByRole("alertdialog", { name: "Delete the invite for Mei Lin?" }).getByRole("button", { name: "Delete invite" }).click();
  await expect(host.page.getByText("Mei Lin", { exact: true })).toHaveCount(0);
  for (const device of [mei, meiLaptop]) {
    await device.goto(host.link);
    await expectLocked(device, host.name);
  }

  // Nothing was ever sent to the address that is not on the list.
  expect(await mailCountTo(request, strangerEmail)).toBe(0);
  await Promise.all([host.context.close(), mei.context().close(), meiLaptop.context().close(), dev.context().close()]);
});

test("a cancelled invite-only event shows its notice only to the invited", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "invite-only-cancel", { title: "Ada’s secret supper", start: "2027-03-06T19:00", plusOnes: "0" });
  await turnInviteOnlyOn(host.page);
  const devLink = await makeInvite(host.page, "Dev Patel", { phone: "+65 9123 4567" });
  const dev = await newGuest(browser);
  await dev.goto(devLink);
  await expect(dev.getByRole("heading", { name: SECRET.title })).toBeVisible();

  await host.page.goto(host.page.url().replace(/\/invites$/, ""));
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible();

  await dev.reload();
  await expect(dev.getByRole("heading", { name: SECRET.title })).toBeVisible();
  await expect(dev.getByText("This event is cancelled")).toBeVisible();
  await page.goto(host.link);
  await expectLocked(page, host.name);
  await expect(page.getByText("This event is cancelled")).toHaveCount(0);
  await Promise.all([host.context.close(), dev.context().close()]);
});

test("an invite-only event still voting on its date refuses an outsider's vote", async ({ page, browser, request }) => {
  test.slow();
  // The host makes a draft whose date is a poll of two days, and publishes it.
  const context = await browser.newContext();
  const hostPage = await context.newPage();
  const { name } = await signUpVerified(hostPage, request, "invite-only-poll");
  await hostPage.goto("/events/new");
  await expect(hostPage).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await typeTitle(hostPage, "Ada’s secret supper");
  await hostPage.getByRole("button", { name: /^When:/ }).click();
  const when = hostPage.getByRole("dialog", { name: "When" });
  await when.getByRole("button", { name: "Not sure yet? Let guests vote" }).click();
  await when.getByLabel("Date 1", { exact: true }).fill("2027-05-08");
  await when.getByLabel("Date 2", { exact: true }).fill("2027-05-09");
  await savedAfter(hostPage, () => when.getByRole("button", { name: "Done" }).click());
  const link = await eventLinkIn(hostPage);
  await publishInEditor(hostPage);

  // An outsider has the vote open from before the host turned invite-only on.
  await page.goto(link);
  await page.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Vote on a date" }).click();
  const sheet = page.getByRole("dialog", { name: "Which dates work for you?" });
  await sheet.getByRole("group").first().getByRole("radio", { name: "Yes" }).check();
  await sheet.getByRole("group").nth(1).getByRole("radio", { name: "No" }).check();
  await sheet.getByLabel("Your name").fill("Sam Outsider");

  await turnInviteOnlyOn(hostPage);
  await sheet.getByRole("button", { name: "Send my votes" }).click();
  await expect(sheet.getByText("Voting on the date has closed.")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expectLocked(page, name);

  // No vote was counted.
  await hostPage.goto(hostPage.url().replace(/\/invites$/, ""));
  await expect(hostPage.getByRole("button", { name: /^When:/ })).toHaveAccessibleName("When: Date to be decided · no votes yet");
  await context.close();
});

// A guest replies on their own device, from the event link, and reads the edit link their
// confirmation gives them.
async function reply(page: Page, link: string, { name, email, phone }: { name: string; email?: string; phone?: string }): Promise<string> {
  await page.goto(link);
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  if (email) await page.getByLabel("Email").fill(email);
  if (phone) await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  return (await page.getByText(EDIT_LINK).textContent())!.trim();
}

// The invitation, with the reply this device holds shown as the guest's own.
async function expectInWithReply(page: Page, title: string) {
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
  await expect(replyBar(page)).toContainText("You’re going");
}

test("turning invite-only on invites everyone who replied, says whom the link alone lets in, and turning it off locks nobody out", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "invite-only-switch", { title: SECRET.title, start: SECRET.start, plusOnes: "0", email: "optional", phone: "optional" });
  const editor = host.page.url();
  const anaEmail = newHost("invite-only-ana").email;
  const boEmail = newHost("invite-only-bo").email;

  // The host's other event is invite-only, with Bo on its list by his email.
  const otherLink = await createDraft(host.page, { title: "Ada’s other supper", start: SECRET.start, plusOnes: "0" });
  await publishInEditor(host.page);
  await turnInviteOnlyOn(host.page);
  await makeInvite(host.page, "Bo Chen", { email: boEmail });
  expect(otherLink).not.toBe(host.link);

  // Ana replies with her email, Dev with his phone alone, before the event is invite-only.
  const ana = await newGuest(browser);
  const anaLink = await reply(ana, host.link, { name: "Ana Silva", email: anaEmail });
  const dev = await newGuest(browser);
  const devLink = await reply(dev, host.link, { name: "Dev Patel", phone: "+65 9123 4567" });

  // The host turns invite-only on: both are on the invite list, as replied, and only Dev's row says
  // that his link alone lets anyone in.
  await host.page.goto(editor);
  await turnInviteOnlyOn(host.page);
  await expect(host.page.getByText(BANNER, { exact: true })).toBeVisible();
  await expect(host.page.getByRole("button", { name: /^Delete the invite for / })).toHaveCount(2);
  await expect(inviteRow(host.page, "Ana Silva").getByText("Replied · Going", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Ana Silva").getByText(anaEmail, { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Ana Silva").getByText(LINK_LETS_IN)).toHaveCount(0);
  await expect(inviteRow(host.page, "Dev Patel").getByText("Replied · Going", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Dev Patel").getByText("+65 9123 4567", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Dev Patel").getByText(LINK_LETS_IN, { exact: true })).toBeVisible();
  await expectNoSeriousViolations(host.page, "the invite list of an invite-only event");

  // A stranger is locked out, and asking for a code with an email on the other event's list gets
  // the answer anyone gets, and sends nothing (counted at the end).
  await page.goto(host.link);
  await expectLocked(page, host.name);
  await askForCode(page, boEmail);

  // Dev stays in by his cookie, and by his edit link on a new device.
  await dev.reload();
  await expectInWithReply(dev, SECRET.title);
  const devLaptop = await newGuest(browser);
  await devLaptop.goto(devLink);
  await expect(devLaptop).toHaveURL(host.link);
  await expectInWithReply(devLaptop, SECRET.title);
  await Promise.all([dev.context().close(), devLaptop.context().close()]);

  // Ana's edit link, opened on a new device, asks for a code sent to her email, once; then her
  // reply is hers, her edit link is her invite's, and changing her reply works.
  const anaLaptop = await newGuest(browser);
  await anaLaptop.goto(anaLink);
  await expect(anaLaptop).toHaveURL(host.link);
  await expectLocked(anaLaptop, host.name);
  await expect(anaLaptop.getByLabel("Your email")).toHaveValue(anaEmail);
  const anaMail = await mailCountTo(request, anaEmail);
  await askForCode(anaLaptop);
  await enterCode(anaLaptop, await codeSentTo(request, anaEmail, anaMail));
  await expectInWithReply(anaLaptop, SECRET.title);
  await openMyReply(anaLaptop);
  await expect(anaLaptop.getByText("You’re going!")).toBeVisible();
  await expect(anaLaptop.getByText(INVITE_LINK)).toBeVisible();
  await anaLaptop.getByRole("button", { name: "Edit details" }).click();
  await anaLaptop.getByLabel("Your name").fill("Ana S.");
  await anaLaptop.getByRole("button", { name: "Send RSVP" }).click();
  await expect(anaLaptop.getByText("Ana S., just you.")).toBeVisible({ timeout: 15_000 });
  await anaLaptop.goto(anaLink);
  await expectInWithReply(anaLaptop, SECRET.title);
  await openMyReply(anaLaptop);
  await expect(anaLaptop.getByText("Ana S., just you.")).toBeVisible();
  await anaLaptop.context().close();
  // Her first device has not proven her email, so it is asked too.
  await ana.reload();
  await expectLocked(ana, host.name);
  await expect(ana.getByLabel("Your email")).toHaveValue(anaEmail);

  // The banner's link opens the editor's settings, where the host turns invite-only off: the
  // invite list keeps everyone, without the banner or the warning, and nobody is locked out.
  await host.page.getByRole("link", { name: "Change it in the event’s settings" }).click();
  const sheet = host.page.getByRole("dialog", { name: "Settings" });
  await expect(sheet).toBeVisible();
  await savedAfter(host.page, () => sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel(INVITE_ONLY, { exact: true }).uncheck());
  await sheet.getByRole("link", { name: "Manage the invite list" }).click();
  await expect(host.page.getByRole("heading", { level: 1 })).toHaveText("Invites");
  await expect(host.page.getByText(BANNER)).toHaveCount(0);
  await expect(host.page.getByText(LINK_LETS_IN)).toHaveCount(0);
  await expect(host.page.getByRole("button", { name: /^Delete the invite for / })).toHaveCount(2);
  await expect(inviteRow(host.page, "Ana Silva").getByText("Replied · Going", { exact: true })).toBeVisible();
  await ana.reload();
  await expectInWithReply(ana, SECRET.title);

  // The stranger, in again, replies with their name alone; turned on again, invite-only invites
  // only them, and the others keep the one invite each.
  await page.reload();
  const samLink = await reply(page, host.link, { name: "Sam Tan" });
  await host.page.goto(editor);
  await turnInviteOnlyOn(host.page);
  await expect(host.page.getByRole("button", { name: /^Delete the invite for / })).toHaveCount(3);
  await expect(inviteRow(host.page, "Sam Tan").getByText("Replied · Going", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Sam Tan").getByText(LINK_LETS_IN, { exact: true })).toBeVisible();
  await page.goto(samLink);
  await expectInWithReply(page, SECRET.title);

  // The address on the other event's list was never sent anything.
  expect(await mailCountTo(request, boEmail)).toBe(0);
  await Promise.all([host.context.close(), ana.context().close()]);
});

test("turning invite-only on invites the guests who replied even when the invite list is full", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "invite-only-full", { title: SECRET.title, start: SECRET.start, plusOnes: "0" });
  const editor = host.page.url();

  // The host fills the invite list with one pasted list of 500.
  await host.page.goto(`${editor}/invites`);
  const names = Array.from({ length: 500 }, (_, at) => `Guest ${String(at + 1).padStart(3, "0")}`);
  await host.page.getByLabel("Add several", { exact: true }).fill(names.join("\n"));
  await host.page.getByRole("button", { name: "Make these links" }).click();
  await expect(host.page.getByText("This event has 500 invites, the most it can have. Delete one to make another.")).toBeVisible({ timeout: 30_000 });

  // Two guests reply from the event link, and the host turns invite-only on.
  await reply(page, host.link, { name: "Ravi Kumar" });
  const sun = await newGuest(browser);
  await reply(sun, host.link, { name: "Sun Li" });
  await host.page.goto(editor);
  await turnInviteOnlyOn(host.page);

  // Both are on the list, past the 500, as replied, and both are still in.
  await expect(host.page.getByRole("button", { name: /^Delete the invite for / })).toHaveCount(502, { timeout: 15_000 });
  await expect(inviteRow(host.page, "Ravi Kumar").getByText("Replied · Going", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Sun Li").getByText("Replied · Going", { exact: true })).toBeVisible();
  for (const guest of [page, sun]) {
    await guest.reload();
    await expectInWithReply(guest, SECRET.title);
  }
  await Promise.all([host.context.close(), sun.context().close()]);
});
