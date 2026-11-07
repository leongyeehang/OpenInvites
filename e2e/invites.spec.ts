import { expectNoSeriousViolations } from "./axe";
import { chooseLayout, createDraft, createPublished, type DraftFields, editSettings, openMore, publishInEditor } from "./events";
import { latestMailTo, mailCountTo, MAILPIT, newHost, signUpVerified } from "./hosts";
import { clientAddress, expect, expectNotFoundAsSent, test, type APIRequestContext, type Browser, type Page } from "./test";
import { openMyReply } from "./reply";

// Ticket 08 (M3): personal invite links. A host makes a link for a named guest; opening it fills in
// the guest's name and the email the host gave, which counts as proven; the reply is tied to the
// invite, approved whatever the approval setting, and the invite link becomes the guest's edit link
// on any device. The host sees who opened and who replied, and the guests invited who have not
// replied under Invited on the guest list; a deleted invite's link is not found, and its reply
// stays. Every guest is on a device of their own, reaching the instance from an address of their
// own. Each test runs at 390 pixels in the mobile project and at desktop width in the other.
//
// Ticket 05 (M6): the invite list. An invite takes a phone and, with personal letters on, a letter;
// "Add several" makes one invite per pasted line, or none when a line is wrong; a guest opening
// their link has the phone filled in where the form asks for one.
//
// Ticket 06 (M6): the invitation email. With mail, on a published event, the host emails an invite
// with an email its invitation (the letter and the personal invite link), one at a time or everyone
// not yet sent; the stop link at its foot stops more and keeps the email. A Share button hands the
// link to the device's share sheet. That an instance without mail offers no Send is in
// registration-without-mail.spec.ts, whose project owns `app-no-mail`.
//
// Ticket 09 (M6): a personal letter on the invitation. With letters on, the guest whose invite has
// a letter sees it on the event page, "For {name}", its lines as the host wrote them, in every
// layout, whether or not the event is invite-only (invite-only.spec.ts opens it with a pass); a
// guest without a letter, a stranger on the event link, and everyone once letters are off see none.

const INVITE_LINK = /^https?:\/\/\S+\/i\/[A-Za-z0-9]{24}$/;

const SUPPER = { title: "Ada’s supper club", start: "2027-03-06T19:00", plusOnes: "0", askEmail: true } satisfies DraftFields;

// A guest on a device of their own.
async function newGuest(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  return context.newPage();
}

// One invite's row on the host's invites page.
function inviteRow(hostPage: Page, name: string) {
  return hostPage.getByRole("listitem").filter({ has: hostPage.getByText(name, { exact: true }) });
}

// The host makes an invite on the invites page, which is open, and reads its link from its row.
async function makeInvite(hostPage: Page, name: string, email?: string): Promise<string> {
  await hostPage.getByLabel("Name", { exact: true }).fill(name);
  if (email) await hostPage.getByLabel("Email", { exact: true }).fill(email);
  await hostPage.getByRole("button", { name: "Make link" }).click();
  await expect(hostPage.getByRole("status").filter({ hasText: /^Made a link for / })).toHaveText(`Made a link for ${name}.`, { timeout: 15_000 });
  await expect(hostPage.getByLabel("Name", { exact: true })).toHaveValue("");
  return (await inviteRow(hostPage, name).getByText(INVITE_LINK).textContent())!.trim();
}

async function closeAll(...pages: Page[]) {
  for (const page of pages) await page.context().close();
}

test("a guest opens their personal invite with their name and email filled in, replies through it, and has it as their edit link on any device; deleted, it is not found and the reply stays", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-walk", SUPPER);
  const manage = host.page.url();
  const meiEmail = newHost("invites-mei").email;

  // The event has a custom link, which is where an invite lands.
  const custom = `adas-supper-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const customUrl = host.link.replace(/\/e\/.*$/, `/e/${custom}`);
  await host.page.goto(`${manage}/share`);
  await host.page.getByRole("textbox", { name: "Custom link" }).fill(custom);
  await host.page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(host.page.getByText(customUrl, { exact: true })).toBeVisible({ timeout: 15_000 });
  // Anyone with the link sees who is coming.
  await host.page.goto(manage);
  await editSettings(host.page, async () => {
    await host.page.getByLabel("Who can see the guest list").selectOption("always");
  });

  // The host makes two invites from the manage page's Invites; nobody has opened either.
  await host.page.goto(manage);
  await openMore(host.page);
  await host.page.getByRole("link", { name: "Invites", exact: true }).click();
  await expect(host.page.getByRole("heading", { level: 1 })).toHaveText("Invites");
  const meiLink = await makeInvite(host.page, "Mei Lin", meiEmail);
  await makeInvite(host.page, "Dev Patel");
  await expect(inviteRow(host.page, "Mei Lin").getByText("Not opened", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Mei Lin").getByText(meiEmail, { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Mei Lin").getByRole("button", { name: "Copy link for Mei Lin" })).toBeVisible();
  // The newest first.
  await expect(host.page.getByRole("listitem").first()).toContainText("Dev Patel");

  // Mei opens her link on her own device and lands on the event page at its custom link, the token
  // nowhere in the address, with her name and email filled in.
  const mei = await newGuest(browser);
  await mei.goto(meiLink);
  await expect(mei).toHaveURL(customUrl);
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Your name")).toHaveValue("Mei Lin");
  await expect(mei.getByLabel("Email")).toHaveValue(meiEmail);

  // The host's list says she opened it; the guest list has both under Invited, and counts neither.
  await host.page.reload();
  await expect(inviteRow(host.page, "Mei Lin").getByText("Opened", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Dev Patel").getByText("Not opened", { exact: true })).toBeVisible();
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByText("Nobody has replied yet. Share the event link and your guests will appear here.")).toBeVisible();
  await expect(host.page.getByText("No one expected yet · 0 going · 0 maybe · 0 can’t go", { exact: true })).toBeVisible();
  const invited = host.page.getByRole("region", { name: /^Invited/ });
  await expect(host.page.getByRole("heading", { name: "Invited (2)" })).toBeVisible();
  await expect(invited.getByRole("listitem").filter({ hasText: "Mei Lin" })).toContainText("Opened");
  await expect(invited.getByRole("listitem").filter({ hasText: "Dev Patel" })).toContainText("Not opened");

  // She replies Going. Her edit link is the invite link; the /r/ link is not shown.
  await mei.getByRole("button", { name: "Send RSVP" }).click();
  await expect(mei.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await expect(mei.getByText(`We’ll reach you at ${meiEmail}.`)).toBeVisible();
  await expect(mei.getByText(meiLink, { exact: true })).toBeVisible();
  await expect(mei.getByText(/\/r\//)).toHaveCount(0);

  // The list anyone can see names her, and never Dev, whose invite nobody has replied through.
  const visitor = await newGuest(browser);
  await visitor.goto(customUrl);
  await expect(visitor.getByText("1 person expected")).toBeVisible();
  await expect(visitor.getByRole("listitem").filter({ hasText: "Mei Lin" })).toBeVisible();
  await expect(visitor.getByText("Dev Patel")).toHaveCount(0);
  expect(await (await visitor.request.get(customUrl)).text()).not.toContain("Dev Patel");

  // The host's list reads Replied · Going, with no link to copy; on the guest list she is Going and
  // no longer under Invited.
  await host.page.goto(`${manage}/invites`);
  await expect(inviteRow(host.page, "Mei Lin").getByText("Replied · Going", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Mei Lin").getByText(INVITE_LINK)).toHaveCount(0);
  await expect(inviteRow(host.page, "Mei Lin").getByRole("button", { name: /^Copy/ })).toHaveCount(0);
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByRole("region", { name: /^Going/ }).getByText("Mei Lin", { exact: true })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: "Invited (1)" })).toBeVisible();
  await expect(invited.getByText("Mei Lin")).toHaveCount(0);
  await expect(host.page.getByText("1 person expected · 1 going · 0 maybe · 0 can’t go", { exact: true })).toBeVisible();

  // On a second device the same link lands on her reply, which she changes there.
  const meiPhone = await newGuest(browser);
  await meiPhone.goto(meiLink);
  await expect(meiPhone).toHaveURL(customUrl);
  await openMyReply(meiPhone);
  await expect(meiPhone.getByText("You’re going!")).toBeVisible();
  await meiPhone.getByRole("button", { name: "Change my answer" }).click();
  await meiPhone.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(meiPhone.getByLabel("Your name")).toHaveValue("Mei Lin");
  await meiPhone.getByRole("button", { name: "Send RSVP" }).click();
  await expect(meiPhone.getByText("You’re a maybe.")).toBeVisible({ timeout: 15_000 });
  await mei.reload();
  await openMyReply(mei);
  await expect(mei.getByText("You’re a maybe.")).toBeVisible();
  // One reply, not two.
  await host.page.reload();
  await expect(host.page.getByText("No one expected yet · 0 going · 1 maybe · 0 can’t go", { exact: true })).toBeVisible();
  await expect(host.page.getByRole("region", { name: /^Maybe/ }).getByText("Mei Lin", { exact: true })).toBeVisible();

  // The host deletes her invite: the link is not found, the reply stays, and both her devices still
  // find it, now with its own edit link.
  await host.page.goto(`${manage}/invites`);
  await expect(inviteRow(host.page, "Mei Lin").getByText("Replied · Maybe", { exact: true })).toBeVisible();
  await host.page.getByRole("button", { name: "Delete the invite for Mei Lin" }).click();
  const dialog = host.page.getByRole("alertdialog", { name: "Delete the invite for Mei Lin?" });
  await expect(dialog.getByText("The link stops working. A reply made with it stays on your guest list.")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete invite" }).click();
  await expect(host.page.getByText("Mei Lin", { exact: true })).toHaveCount(0);
  await expect(host.page.getByRole("heading", { name: "Invites" })).toBeFocused();
  await expectNotFoundAsSent(await request.get(meiLink, { maxRedirects: 0 }));
  await expectNotFoundAsSent(await request.get("/i/not-a-real-token", { maxRedirects: 0 }));
  for (const device of [mei, meiPhone]) {
    await device.goto(customUrl);
    await openMyReply(device);
    await expect(device.getByText("You’re a maybe.")).toBeVisible();
    await expect(device.getByText(meiLink.replace("/i/", "/r/"), { exact: true })).toBeVisible();
  }
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByRole("region", { name: /^Maybe/ }).getByText("Mei Lin", { exact: true })).toBeVisible();
  // Dev, whom nobody has opened the link for, is still under Invited.
  await expect(host.page.getByRole("heading", { name: "Invited (1)" })).toBeVisible();
  await expect(invited.getByRole("listitem").filter({ hasText: "Dev Patel" })).toContainText("Not opened");

  await closeAll(host.page, mei, meiPhone, visitor);
});

test("a guest who withdraws can reply through their invite again; a host who removes a reply made through an invite deletes the invite with it", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-remove", SUPPER);
  const manage = host.page.url();
  const meiEmail = newHost("invites-remove-mei").email;
  await host.page.goto(`${manage}/invites`);
  const meiLink = await makeInvite(host.page, "Mei Lin", meiEmail);

  const mei = await newGuest(browser);
  await mei.goto(meiLink);
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await mei.getByRole("button", { name: "Send RSVP" }).click();
  await expect(mei.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });

  // Her own withdrawal leaves the invite: it is hers to reply through again, filled in as before.
  await mei.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(mei.getByText("You’re going!")).toHaveCount(0);
  await host.page.reload();
  await expect(inviteRow(host.page, "Mei Lin").getByText("Opened", { exact: true })).toBeVisible();
  await mei.reload();
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Your name")).toHaveValue("Mei Lin");
  await expect(mei.getByLabel("Email")).toHaveValue(meiEmail);
  await mei.getByRole("button", { name: "Send RSVP" }).click();
  await expect(mei.getByText(meiLink, { exact: true })).toBeVisible({ timeout: 15_000 });

  // The host removes her reply: the invite goes with it, so its link stops working, as the dialog
  // says, and nobody is listed as invited.
  await host.page.goto(`${manage}/guests`);
  await host.page.getByRole("button", { name: "Edit" }).click();
  await host.page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(host.page.getByText("Remove Mei Lin?")).toBeVisible();
  await host.page.getByRole("button", { name: "Remove guest" }).click();
  await expect(host.page.getByText("Nobody has replied yet. Share the event link and your guests will appear here.")).toBeVisible();
  await expect(host.page.getByRole("heading", { name: /^Invited/ })).toHaveCount(0);
  await host.page.goto(`${manage}/invites`);
  await expect(host.page.getByText("No invites yet.")).toBeVisible();
  await expect(host.page.getByText("Mei Lin", { exact: true })).toHaveCount(0);
  await expectNotFoundAsSent(await request.get(meiLink, { maxRedirects: 0 }));

  // Her device has neither her reply nor the invite: the form is the plain one.
  await mei.reload();
  await expect(mei.getByText("You’re going!")).toHaveCount(0);
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Your name")).toHaveValue("");
  await expect(mei.getByLabel("Email")).toHaveValue("");

  await closeAll(host.page, mei);
});

test("a device that opened an invite before its guest replied elsewhere holds that reply: reloaded it shows it, and a form left filled in changes it rather than adding another", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-devices", SUPPER);
  const manage = host.page.url();
  const meiEmail = newHost("invites-devices-mei").email;
  await host.page.goto(`${manage}/invites`);
  const meiLink = await makeInvite(host.page, "Mei Lin", meiEmail);

  // Her laptop and her tablet open the link; the laptop stops on the form, filled in.
  const [laptop, tablet, phone] = [await newGuest(browser), await newGuest(browser), await newGuest(browser)];
  await laptop.goto(meiLink);
  await laptop.getByRole("button", { name: "Going", exact: true }).click();
  await expect(laptop.getByLabel("Your name")).toHaveValue("Mei Lin");
  await tablet.goto(meiLink);

  // She replies Going from her phone.
  await phone.goto(meiLink);
  await phone.getByRole("button", { name: "Going", exact: true }).click();
  await phone.getByRole("button", { name: "Send RSVP" }).click();
  await expect(phone.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });

  // The tablet, reloaded, shows the phone's reply.
  await tablet.reload();
  await openMyReply(tablet);
  await expect(tablet.getByText("You’re going!")).toBeVisible();
  await expect(tablet.getByText(meiLink, { exact: true })).toBeVisible();

  // The laptop's form, closed and sent as a Maybe, changes that reply.
  await laptop.keyboard.press("Escape");
  await laptop.getByRole("button", { name: "Maybe", exact: true }).click();
  await laptop.getByRole("button", { name: "Send RSVP" }).click();
  await expect(laptop.getByText("You’re a maybe.")).toBeVisible({ timeout: 15_000 });
  await expect(laptop.getByText(meiLink, { exact: true })).toBeVisible();
  for (const device of [laptop, phone, tablet]) {
    await device.reload();
    await openMyReply(device);
    await expect(device.getByText("You’re a maybe.")).toBeVisible();
  }

  // One reply, on the host's list as on the invites page.
  await host.page.goto(`${manage}/guests`);
  await expect(host.page.getByText("No one expected yet · 0 going · 1 maybe · 0 can’t go", { exact: true })).toBeVisible();
  await expect(host.page.getByRole("region", { name: /^Maybe/ }).getByRole("listitem")).toHaveCount(1);
  await host.page.goto(`${manage}/invites`);
  await expect(inviteRow(host.page, "Mei Lin").getByText("Replied · Maybe", { exact: true })).toBeVisible();

  await closeAll(host.page, laptop, tablet, phone);
});

test("with approval on and the email checked by a code, an invited guest with the invite's email is on the list at once with no code; another email is checked", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-approval", { ...SUPPER, verifyEmail: true, approval: true });
  const manage = host.page.url();
  const meiEmail = newHost("invites-approved-mei").email;
  const devEmail = newHost("invites-approved-dev").email;
  const devOwn = newHost("invites-approved-dev-own").email;

  await host.page.goto(`${manage}/invites`);
  const meiLink = await makeInvite(host.page, "Mei Lin", meiEmail);
  const devLink = await makeInvite(host.page, "Dev Patel", devEmail);

  // Mei keeps the email the host gave: no code step, and no wait for the host. The guest list, open
  // to guests once they reply, opens for her.
  const mei = await newGuest(browser);
  await mei.goto(meiLink);
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Email")).toHaveValue(meiEmail);
  await mei.getByRole("button", { name: "Send RSVP" }).click();
  await expect(mei.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await expect(mei.getByText("1 person expected")).toBeVisible();
  // The hosts hear of her reply, which is queued after anything sent to her as she replied: nothing
  // was.
  await expect
    .poll(() => latestMailTo(request, host.email), { timeout: 30_000, message: "the host told of Mei’s reply" })
    .toContain("Mei Lin");
  expect(await mailCountTo(request, meiEmail)).toBe(0);

  // On the host's list she is Going, her email checked, and nobody waits for approval.
  await host.page.goto(`${manage}/guests`);
  const going = host.page.getByRole("region", { name: /^Going/ });
  await expect(going.getByText("Mei Lin", { exact: true })).toBeVisible();
  await expect(going.getByText("Email checked")).toBeAttached();
  await expect(host.page.getByRole("heading", { name: "Waiting for approval (0)" })).toBeVisible();

  // Asha replies from the event link, and waits for the host. Dev's invite link, opened on her
  // device, leaves her with her own reply: no form filled in with his name.
  const asha = await newGuest(browser);
  await asha.goto(host.link);
  await asha.getByRole("button", { name: "Going", exact: true }).click();
  await asha.getByLabel("Your name").fill("Asha Menon");
  await asha.getByRole("button", { name: "Send RSVP" }).click();
  await expect(asha.getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible({ timeout: 15_000 });
  await asha.goto(devLink);
  await openMyReply(asha);
  await expect(asha.getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible();
  await expect(asha.getByText("Asha Menon, just you.")).toBeVisible();
  await expect(asha.getByLabel("Your name")).toHaveCount(0);

  // Dev gives an email of his own instead: it is checked by a code, as anyone's is, and his reply,
  // through his invite, is on the list at once.
  const dev = await newGuest(browser);
  await dev.goto(devLink);
  await dev.getByRole("button", { name: "Going", exact: true }).click();
  await expect(dev.getByLabel("Your name")).toHaveValue("Dev Patel");
  await dev.getByLabel("Email").fill(devOwn);
  await dev.getByRole("button", { name: "Send RSVP" }).click();
  await expect(dev.getByText(`We sent a code to ${devOwn}.`)).toBeVisible({ timeout: 15_000 });
  const code = (await latestMailTo(request, devOwn)).match(/^([0-9]{6})\r?$/m)?.[1];
  expect(code).toBeDefined();
  await dev.getByLabel("Code").fill(code!);
  await dev.getByRole("button", { name: "Confirm" }).click();
  await expect(dev.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await expect(dev.getByText("2 people expected")).toBeVisible();

  await closeAll(host.page, mei, dev, asha);
});

test("the Broadsheet and the Thread fill in the invite's name and email too, and the Thread's done bubble carries the invite link", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-layouts", { title: "Supper at Mei’s", start: "2027-03-06T19:00", plusOnes: "0", askEmail: true, layout: "Broadsheet" });
  const manage = host.page.url();
  const meiEmail = newHost("invites-layouts-mei").email;
  await host.page.goto(`${manage}/invites`);
  const meiLink = await makeInvite(host.page, "Mei Lin", meiEmail);

  const mei = await newGuest(browser);
  await mei.goto(meiLink);
  await mei.getByRole("radio", { name: "I’ll be there", exact: true }).check();
  await expect(mei.getByLabel("Your name")).toHaveValue("Mei Lin");
  await expect(mei.getByLabel("Email")).toHaveValue(meiEmail);

  // In the Thread, the composer offers the name, then the email, as the host gave them.
  await host.page.goto(manage);
  await chooseLayout(host.page, host.link, "Thread");
  await mei.reload();
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Your name")).toHaveValue("Mei Lin");
  await mei.getByRole("button", { name: "Send", exact: true }).click();
  await expect(mei.getByLabel("Email")).toHaveValue(meiEmail);
  await mei.getByRole("button", { name: "Send", exact: true }).click();
  const done = mei.locator('[data-slot="done"]');
  await expect(done).toContainText("You’re in, Mei!", { timeout: 15_000 });
  await expect(done.getByText(meiLink, { exact: true })).toBeVisible();

  await host.page.goto(`${manage}/invites`);
  await expect(inviteRow(host.page, "Mei Lin").getByText("Replied · Going", { exact: true })).toBeVisible();

  await closeAll(host.page, mei);
});

// A letter of exactly the most a letter may be, 1000 characters, in Chinese, across three lines.
const LONGEST_LETTER = `亲爱的 Dev：\n${"好".repeat(1000 - "亲爱的 Dev：\n".length - "\n周六见！".length)}\n周六见！`;

test("an invite made with a phone and a letter shows both on its row; letters turned on show the fields, a saved letter survives a reload, and off they hide and are kept", async ({
  browser,
  request,
}) => {
  test.slow();
  expect(LONGEST_LETTER).toHaveLength(1000);
  const host = await createPublished(browser, request, "invites-letters", SUPPER);
  await host.page.goto(`${host.page.url()}/invites`);
  const letters = host.page.getByRole("checkbox", { name: "Personal letters" });
  await expect(letters).not.toBeChecked();
  await expect(host.page.getByText("Write a note to each guest, shown on their invitation.")).toBeVisible();
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toHaveCount(0);

  // Letters on: the form offers one.
  await letters.click();
  await expect(letters).toBeChecked();
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toBeVisible({ timeout: 15_000 });

  // Mei's invite, with a phone and a letter of two lines.
  const meiLetter = "Dear Mei,\nBring your guitar.";
  await host.page.getByLabel("Name", { exact: true }).fill("Mei Lin");
  await host.page.getByLabel("Email", { exact: true }).fill("mei@example.test");
  await host.page.getByLabel("Phone number", { exact: true }).fill("+65 9123 4567");
  await host.page.getByRole("textbox", { name: "Letter", exact: true }).fill(meiLetter);
  await host.page.getByRole("button", { name: "Make link" }).click();
  await expect(host.page.getByRole("status")).toHaveText("Made a link for Mei Lin.", { timeout: 15_000 });
  await expect(host.page.getByLabel("Phone number", { exact: true })).toHaveValue("");
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toHaveValue("");
  const mei = inviteRow(host.page, "Mei Lin");
  await expect(mei.getByText("mei@example.test", { exact: true })).toBeVisible();
  await expect(mei.getByText("+65 9123 4567", { exact: true })).toBeVisible();
  await expect(host.page.getByRole("textbox", { name: "Letter Mei Lin" })).toHaveValue(meiLetter);

  // A phone of another shape is refused, and the form keeps what was typed.
  await host.page.getByLabel("Name", { exact: true }).fill("Dev Patel");
  await host.page.getByLabel("Phone number", { exact: true }).fill("ring me");
  await host.page.getByRole("button", { name: "Make link" }).click();
  await expect(host.page.getByText("Enter a phone number of 5 to 20 digits.")).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByLabel("Name", { exact: true })).toHaveValue("Dev Patel");
  await host.page.getByLabel("Phone number", { exact: true }).fill("");
  await makeInvite(host.page, "Dev Patel");

  // Dev's letter, written on his row: the longest there may be, its line breaks kept.
  const devLetter = host.page.getByRole("textbox", { name: "Letter Dev Patel" });
  await expect(devLetter).toHaveValue("");
  await devLetter.fill(LONGEST_LETTER);
  await host.page.getByRole("button", { name: "Save letter Dev Patel" }).click();
  await expect(inviteRow(host.page, "Dev Patel").getByRole("status")).toHaveText("Letter saved.", { timeout: 15_000 });
  await host.page.reload();
  await expect(host.page.getByRole("textbox", { name: "Letter Dev Patel" })).toHaveValue(LONGEST_LETTER);
  await expect(host.page.getByRole("textbox", { name: "Letter Mei Lin" })).toHaveValue(meiLetter);

  // Letters off: the fields go, the phone stays on the row; on again, the letters are as they were.
  await host.page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(host.page.getByRole("textbox", { name: /^Letter/ })).toHaveCount(0, { timeout: 15_000 });
  await host.page.reload();
  await expect(host.page.getByRole("checkbox", { name: "Personal letters" })).not.toBeChecked();
  await expect(host.page.getByRole("textbox", { name: /^Letter/ })).toHaveCount(0);
  await expect(inviteRow(host.page, "Mei Lin").getByText("+65 9123 4567", { exact: true })).toBeVisible();
  await host.page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(host.page.getByRole("textbox", { name: "Letter Dev Patel" })).toHaveValue(LONGEST_LETTER, { timeout: 15_000 });

  await closeAll(host.page);
});

// Mei's letter: two paragraphs, in Chinese and English, the second over two lines.
const MEI_LETTER = "親愛的 Mei，\n\n期待與你相見。\nWith love";

// The letter panel on the event page, and that it reads "For {name}" over the letter as written,
// each line break kept as the browser shows it.
async function expectLetter(page: Page, name: string, letter: string) {
  const panel = page.locator('[data-slot="letter"]');
  await expect(panel.getByRole("heading", { name: `For ${name}`, exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByRole("paragraph")).toHaveJSProperty("innerText", letter);
}

test("with letters on, the guest whose invite has a letter sees it, for her, in the Poster, the Broadsheet and the Thread; another guest, a stranger, and everyone once letters are off see none", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-letter-page", { ...SUPPER, description: "Bring a story." });
  const editor = host.page.url();

  // Letters on; Mei's invite has a letter, Dev's none.
  await host.page.goto(`${editor}/invites`);
  await host.page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toBeVisible({ timeout: 15_000 });
  await host.page.getByRole("textbox", { name: "Letter", exact: true }).fill(MEI_LETTER);
  const meiLink = await makeInvite(host.page, "Mei");
  const devLink = await makeInvite(host.page, "Dev");

  // The Poster: Mei's letter, in its own panel above the details.
  const mei = await newGuest(browser);
  await mei.goto(meiLink);
  await expect(mei).toHaveURL(host.link);
  await expectLetter(mei, "Mei", MEI_LETTER);
  await expect(mei.locator('[data-slot="letter"] + [data-slot="details"]')).toBeVisible();
  await expectNoSeriousViolations(mei, "the Poster with a letter");

  // The Broadsheet: first in the paper, before the description.
  await host.page.goto(editor);
  await chooseLayout(host.page, host.link, "Broadsheet");
  await mei.reload();
  await expect(mei.locator('section[data-slot="letter"]:first-child + section[data-slot="description"]')).toBeVisible({ timeout: 15_000 });
  await expectLetter(mei, "Mei", MEI_LETTER);
  await expectNoSeriousViolations(mei, "the Broadsheet with a letter");

  // The Thread: the bubble right after the invitation's card.
  await chooseLayout(host.page, host.link, "Thread");
  await mei.reload();
  await expect(mei.locator('[data-slot="thread-card"] + [data-slot="letter"]')).toBeVisible({ timeout: 15_000 });
  await expectLetter(mei, "Mei", MEI_LETTER);
  await expectNoSeriousViolations(mei, "the Thread with a letter");

  // Dev's invite has no letter, and a stranger on the event link has no invite: no panel for either.
  const dev = await newGuest(browser);
  await dev.goto(devLink);
  await expect(dev.locator('[data-slot="thread-card"]')).toBeVisible();
  await expect(dev.locator('[data-slot="letter"]')).toHaveCount(0);
  await page.goto(host.link);
  await expect(page.locator('[data-slot="thread-card"]')).toBeVisible();
  await expect(page.locator('[data-slot="letter"]')).toHaveCount(0);
  await expect(page.getByText("期待與你相見")).toHaveCount(0);

  // Letters off: Mei's page shows none, though the host keeps it.
  await host.page.goto(`${editor}/invites`);
  await host.page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(host.page.getByRole("textbox", { name: /^Letter/ })).toHaveCount(0, { timeout: 15_000 });
  await mei.reload();
  await expect(mei.locator('[data-slot="thread-card"]')).toBeVisible();
  await expect(mei.locator('[data-slot="letter"]')).toHaveCount(0);
  await expect(mei.getByText("期待與你相見")).toHaveCount(0);

  await closeAll(host.page, mei, dev);
});

test("pasting three lines makes three invites, listed in the pasted order; a bad second line makes none and says which; Send on an invite deleted meanwhile says it is gone", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-paste", SUPPER);
  await host.page.goto(`${host.page.url()}/invites`);
  const people = host.page.getByLabel("Add several", { exact: true });
  await expect(host.page.getByText("One person per line, as Name, email, phone.", { exact: false })).toBeVisible();

  // The second line's email is not one: nobody is made, the line is named, the text stays.
  const wrong = "Ravi Kumar, ravi@example.test\nSun Li, sun@example\nTan Wei";
  await people.fill(wrong);
  await host.page.getByRole("button", { name: "Make these links" }).click();
  await expect(host.page.getByText("Line 2: That does not look like an email address.")).toBeVisible({ timeout: 15_000 });
  await expect(people).toHaveValue(wrong);
  await host.page.reload();
  await expect(host.page.getByText("No invites yet.")).toBeVisible();
  await expect(host.page.getByText("Ravi Kumar", { exact: true })).toHaveCount(0);

  // Three lines, one with everything, one with no email, one with the name alone.
  await host.page.getByLabel("Add several", { exact: true }).fill("Mei Lin, mei@example.test, +65 9123 4567\nDev Patel, , 8123 4567\n\nAsha Menon");
  await host.page.getByRole("button", { name: "Make these links" }).click();
  await expect(host.page.getByRole("status")).toHaveText("Made 3 links.", { timeout: 15_000 });
  await expect(host.page.getByLabel("Add several", { exact: true })).toHaveValue("");
  const deletes = host.page.getByRole("button", { name: /^Delete the invite for / });
  await expect(deletes).toHaveCount(3);
  // Made at once, they are listed in the order they were pasted.
  for (const [at, name] of ["Mei Lin", "Dev Patel", "Asha Menon"].entries()) await expect(deletes.nth(at)).toHaveAccessibleName(`Delete the invite for ${name}`);
  await expect(inviteRow(host.page, "Mei Lin").getByText("mei@example.test", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Mei Lin").getByText("+65 9123 4567", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Dev Patel").getByText("8123 4567", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Asha Menon").getByText("Not opened", { exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Asha Menon").getByText(INVITE_LINK)).toBeVisible();

  // Mei's invite, deleted in another tab, is said to be gone when this one sends it.
  const other = await host.context.newPage();
  await other.goto(host.page.url());
  await other.getByRole("button", { name: "Delete the invite for Mei Lin" }).click();
  await other.getByRole("alertdialog").getByRole("button", { name: "Delete invite" }).click();
  await expect(other.getByRole("button", { name: /^Delete the invite for / })).toHaveCount(2, { timeout: 15_000 });
  await host.page.getByRole("button", { name: "Send the invitation to Mei Lin", exact: true }).click();
  await expect(inviteRow(host.page, "Mei Lin").getByText("This invite no longer exists.", { exact: true })).toBeVisible({ timeout: 15_000 });

  await closeAll(host.page);
});

test("a guest opening their link has the phone the host gave filled in when the form asks for one, and not sent otherwise", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-phone", SUPPER);
  const manage = host.page.url();
  await host.page.goto(`${manage}/invites`);
  await host.page.getByLabel("Phone number", { exact: true }).fill("+65 9123 4567");
  const meiLink = await makeInvite(host.page, "Mei Lin", "mei@example.test");

  // The event asks for an email and no phone: the page fills in the email and never has the phone.
  const mei = await newGuest(browser);
  await mei.goto(meiLink);
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Email")).toHaveValue("mei@example.test");
  await expect(mei.getByLabel("Phone number")).toHaveCount(0);
  expect(await (await mei.request.get(mei.url())).text()).not.toContain("9123 4567");

  // Once it asks for a phone, her form has hers.
  await host.page.goto(manage);
  await editSettings(host.page, async (sheet) => {
    await sheet.getByRole("group", { name: "Contact details" }).getByLabel("Phone number", { exact: true }).selectOption("optional");
  });
  await mei.reload();
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Your name")).toHaveValue("Mei Lin");
  await expect(mei.getByLabel("Phone number")).toHaveValue("+65 9123 4567");
  await mei.getByRole("button", { name: "Send RSVP" }).click();
  await expect(mei.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });

  await closeAll(host.page, mei);
});

test("an event with 500 invites offers no form and says why, the server refuses one more, and deleting one brings the form back", async ({
  browser,
  request,
}) => {
  test.setTimeout(300_000);
  const host = await createPublished(browser, request, "invites-full", SUPPER);
  await host.page.goto(`${host.page.url()}/invites`);

  // The first invite is made through the form, its request kept as it goes; the other 499 are that
  // request sent again from the host's browser, each with a name of its own, as the form would send
  // them one by one.
  let sent: { url: string; headers: Record<string, string>; body: Buffer } | undefined;
  await host.page.route("**/*", async (route) => {
    const made = route.request();
    if (made.method() === "POST" && made.headers()["next-action"]) sent ??= { url: made.url(), headers: made.headers(), body: made.postDataBuffer()! };
    await route.fallback();
  });
  await makeInvite(host.page, "Guest 001");
  await host.page.unrouteAll({ behavior: "ignoreErrors" });
  const make = async (name: string) => {
    const response = await host.page.request.post(sent!.url, {
      headers: Object.fromEntries(
        ["next-action", "next-router-state-tree", "content-type", "accept", "origin"].filter((header) => sent!.headers[header] !== undefined).map((header) => [header, sent!.headers[header]]),
      ),
      data: Buffer.from(sent!.body.toString("latin1").replace("Guest 001", name), "latin1"),
    });
    expect(response.ok()).toBe(true);
  };
  for (let from = 2; from <= 500; from += 10) {
    await Promise.all(Array.from({ length: Math.min(10, 501 - from) }, (_, at) => make(`Guest ${String(from + at).padStart(3, "0")}`)));
  }

  // At 500 the page says so in place of the form, and the server refuses another sent anyway.
  const full = "This event has 500 invites, the most it can have. Delete one to make another.";
  await host.page.reload();
  await expect(host.page.getByText(full)).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByRole("button", { name: "Make link" })).toHaveCount(0);
  await expect(host.page.getByRole("button", { name: /^Delete the invite for / })).toHaveCount(500);
  await make("Guest 501");
  await host.page.reload();
  await expect(host.page.getByRole("button", { name: /^Delete the invite for / })).toHaveCount(500);
  await expect(host.page.getByText("Guest 501", { exact: true })).toHaveCount(0);

  // One deleted, the form is back.
  await host.page.getByRole("button", { name: "Delete the invite for Guest 250" }).click();
  await host.page.getByRole("alertdialog").getByRole("button", { name: "Delete invite" }).click();
  await expect(host.page.getByText("Guest 250", { exact: true })).toHaveCount(0, { timeout: 15_000 });
  await expect(host.page.getByRole("button", { name: "Make link" })).toBeVisible();
  await expect(host.page.getByText(full)).toHaveCount(0);

  // At 499, a pasted list of two would pass 500 and makes nobody; a list of one fills the place.
  await host.page.getByLabel("Add several", { exact: true }).fill("Guest 501\nGuest 502");
  await host.page.getByRole("button", { name: "Make these links" }).click();
  await expect(host.page.getByText("That list would take this event past 500 invites, the most it can have. No links were made.")).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByText("Guest 501", { exact: true })).toHaveCount(0);
  await host.page.getByLabel("Add several", { exact: true }).fill("Guest 501");
  await host.page.getByRole("button", { name: "Make these links" }).click();
  await expect(host.page.getByText(full)).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByText("Guest 501", { exact: true })).toBeVisible();

  await closeAll(host.page);
});

// The newest email to this address, its subject and its text, once there are `count` of them. Line
// breaks are made plain, as the mail went over SMTP.
async function invitationTo(request: APIRequestContext, email: string, count: number) {
  await expect.poll(() => mailCountTo(request, email), { timeout: 30_000, message: `${count} emails to ${email}` }).toBe(count);
  const text = (await latestMailTo(request, email)).replace(/\r\n/g, "\n").trimEnd();
  const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  const { messages } = (await search.json()) as { messages: { Subject: string }[] };
  return { subject: messages[0].Subject, text };
}

const STOP_LINK = /https?:\/\/\S+\/m\/[A-Za-z0-9]{24}/;

test("the host emails an invitation with its letter and link, again with the same stop link, then everyone not yet sent; the stop link keeps the email and ends the sending", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-mail", SUPPER);
  const manage = host.page.url();
  await host.page.goto(`${manage}/invites`);
  const meiEmail = newHost("invites-mail-mei").email;
  const devEmail = newHost("invites-mail-dev").email;
  const raviEmail = newHost("invites-mail-ravi").email;

  // Letters on; Mei's invite has one, in Chinese, over three lines. Dev's has an email and no
  // letter, Asha's no email. Ravi, with an email, has replied through the link the host copied.
  await host.page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toBeVisible({ timeout: 15_000 });
  const letter = "亲爱的美玲：\n记得带上你的吉他。\n周六见！";
  await host.page.getByRole("textbox", { name: "Letter", exact: true }).fill(letter);
  const meiLink = await makeInvite(host.page, "Mei Lin", meiEmail);
  await makeInvite(host.page, "Dev Patel", devEmail);
  await makeInvite(host.page, "Asha Menon");
  const raviLink = await makeInvite(host.page, "Ravi Kumar", raviEmail);
  const ravi = await newGuest(browser);
  await ravi.goto(raviLink);
  await ravi.getByRole("button", { name: "Going", exact: true }).click();
  await expect(ravi.getByLabel("Email")).toHaveValue(raviEmail);
  await ravi.getByRole("button", { name: "Send RSVP" }).click();
  await expect(ravi.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await host.page.reload();
  await expect(inviteRow(host.page, "Ravi Kumar").getByText("Replied · Going", { exact: true })).toBeVisible();

  // Two await their invitation: not Asha, with no email, nor Ravi, who has replied, though his row
  // can still send him one.
  await expect(host.page.getByRole("button", { name: "Send to everyone not yet sent (2)" })).toBeEnabled();
  await expect(host.page.getByRole("button", { name: "Send the invitation to Ravi Kumar", exact: true })).toBeVisible();
  await expect(inviteRow(host.page, "Asha Menon").getByRole("button", { name: /^Send/ })).toHaveCount(0);
  await expect(inviteRow(host.page, "Mei Lin").getByText(/^Sent /)).toHaveCount(0);

  // Mei's Send: she has the invitation, in the event's language, with the letter as written and her
  // own link, and the row says when it went.
  await host.page.getByRole("button", { name: "Send the invitation to Mei Lin", exact: true }).click();
  await expect(inviteRow(host.page, "Mei Lin").getByRole("status")).toHaveText("Invitation sent to Mei Lin.", { timeout: 15_000 });
  const first = await invitationTo(request, meiEmail, 1);
  expect(first.subject).toBe(`${host.name} invited you to Ada’s supper club`);
  expect(first.text).toContain("Hi Mei Lin,");
  expect(first.text).toContain(`\n\n${letter}\n\n`);
  expect(first.text).toContain("When: Saturday, March 6, 2027");
  expect(first.text).toContain(`Open your invitation: ${meiLink}`);
  expect(first.text).not.toContain("code");
  expect(first.text).toMatch(/You’re getting this because the host of Ada’s supper club invited you at this address\. To stop emails about this event: https?:\/\/\S+\/m\/[A-Za-z0-9]{24}$/);
  const stopLink = first.text.match(STOP_LINK)![0];
  await expect(inviteRow(host.page, "Mei Lin").getByText(/^Sent /)).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Send to everyone not yet sent (1)" })).toBeVisible();

  // Letters off, then Send again: a second invitation, without the letter the event page no longer
  // shows, whose stop link is the first's.
  await host.page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(host.page.getByRole("textbox", { name: /^Letter/ })).toHaveCount(0, { timeout: 15_000 });
  await host.page.getByRole("button", { name: "Send the invitation to Mei Lin again" }).click();
  const second = await invitationTo(request, meiEmail, 2);
  expect(second.text.match(STOP_LINK)![0]).toBe(stopLink);
  expect(second.text).toContain("Hi Mei Lin,");
  expect(second.text).not.toContain("亲爱的美玲");

  // Everyone not yet sent is Dev alone; Mei has nothing more, Ravi nothing, and Asha nothing at all.
  await host.page.getByRole("button", { name: "Send to everyone not yet sent (1)" }).click();
  await expect(host.page.getByRole("status").filter({ hasText: /^Sent \d/ })).toHaveText("Sent 1 invitation.", { timeout: 15_000 });
  const dev = await invitationTo(request, devEmail, 1);
  expect(dev.subject).toBe(`${host.name} invited you to Ada’s supper club`);
  expect(dev.text).toContain("Hi Dev Patel,");
  expect(dev.text).not.toContain("亲爱的");
  await expect(host.page.getByRole("button", { name: "Send to everyone not yet sent (0)" })).toBeDisabled();
  await expect(inviteRow(host.page, "Dev Patel").getByText(/^Sent /)).toBeVisible();
  expect(await mailCountTo(request, meiEmail)).toBe(2);
  expect(await mailCountTo(request, raviEmail)).toBe(0);
  await expect(inviteRow(host.page, "Ravi Kumar").getByText(/^Sent /)).toHaveCount(0);

  // Mei opens the stop link: it shows her email, and Stop says it is done.
  const mei = await newGuest(browser);
  await mei.goto(stopLink);
  await expect(mei.getByRole("heading", { level: 1 })).toHaveText("Ada’s supper club");
  await expect(mei.getByText(`The email on file for this event is ${meiEmail}.`)).toBeVisible();
  await mei.getByRole("button", { name: "Stop emails about this event" }).click();
  await expect(mei.getByRole("status")).toHaveText("Done. You will get no more email about Ada’s supper club.", { timeout: 15_000 });
  // The link still leads to its page, which now says the mail is stopped, not that her email is gone.
  await mei.reload();
  await expect(mei.getByText("Emails about this event are stopped.", { exact: true })).toBeVisible();
  await expect(mei.getByText("No email is on file for this event.")).toHaveCount(0);
  await expect(mei.getByRole("button", { name: "Stop emails about this event" })).toHaveCount(0);

  // Her row keeps the email, says she stopped, and offers no Send; Dev's still does.
  await host.page.reload();
  const meiRow = inviteRow(host.page, "Mei Lin");
  await expect(meiRow.getByText(meiEmail, { exact: true })).toBeVisible();
  await expect(meiRow.getByText("Stopped email", { exact: true })).toBeVisible();
  await expect(meiRow.getByRole("button", { name: /^Send/ })).toHaveCount(0);
  await expect(host.page.getByRole("button", { name: "Send the invitation to Dev Patel again" })).toBeVisible();
  expect(await mailCountTo(request, meiEmail)).toBe(2);
  // Her invite link still opens the event, the email still filled in.
  await mei.goto(meiLink);
  await mei.getByRole("button", { name: "Going", exact: true }).click();
  await expect(mei.getByLabel("Email")).toHaveValue(meiEmail);

  await closeAll(host.page, mei, ravi);
});

// A guest replies Going on a device of their own, through their invite or, with a name and email,
// through the event link.
async function replyGoing(browser: Browser, link: string, who?: { name: string; email: string }): Promise<Page> {
  const guest = await newGuest(browser);
  await guest.goto(link);
  await guest.getByRole("button", { name: "Going", exact: true }).click();
  if (who) {
    await guest.getByLabel("Your name").fill(who.name);
    await guest.getByLabel("Email").fill(who.email);
  }
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  return guest;
}

// The host posts an announcement to the Going and Maybe guests, from the announcements page.
async function announce(hostPage: Page, manage: string, text: string) {
  await hostPage.goto(`${manage}/announcements`);
  const message = hostPage.getByLabel("Message");
  await message.fill(text);
  await hostPage.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("", { timeout: 15_000 });
}

test("a stop is for the whole event: a reply's stop link ends the invitations, and an invitation's ends the mail about the reply", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "invites-stop", SUPPER);
  const manage = host.page.url();
  const raviEmail = newHost("invites-stop-ravi").email;
  const meiEmail = newHost("invites-stop-mei").email;
  const asha = { name: "Asha Menon", email: newHost("invites-stop-asha").email };
  await host.page.goto(`${manage}/invites`);
  const raviLink = await makeInvite(host.page, "Ravi Kumar", raviEmail);
  const meiLink = await makeInvite(host.page, "Mei Lin", meiEmail);
  await host.page.getByRole("button", { name: "Send the invitation to Mei Lin", exact: true }).click();
  const invitationStop = (await invitationTo(request, meiEmail, 1)).text.match(STOP_LINK)![0];
  await host.page.getByRole("button", { name: "Send the invitation to Ravi Kumar", exact: true }).click();
  const raviInvitationStop = (await invitationTo(request, raviEmail, 1)).text.match(STOP_LINK)![0];

  // Ravi and Mei reply through their invites, Asha through the event link; an announcement
  // reaches all three.
  const ravi = await replyGoing(browser, raviLink);
  const mei = await replyGoing(browser, meiLink);
  const ashaPage = await replyGoing(browser, host.link, asha);
  await announce(host.page, manage, "Bring a dish to share.");
  const raviStop = (await invitationTo(request, raviEmail, 2)).text.match(STOP_LINK)![0];
  expect(raviStop).not.toBe(raviInvitationStop);
  await invitationTo(request, meiEmail, 2);
  await invitationTo(request, asha.email, 1);

  // Ravi stops mail with the link at the foot of the announcement, his reply's: his invitation's
  // stop link says the mail is stopped, his invite's row says so and offers no Send, and there is
  // nobody for "Send to everyone not yet sent".
  await ravi.goto(raviStop);
  await ravi.getByRole("button", { name: "Stop emails about this event" }).click();
  await expect(ravi.getByRole("status")).toHaveText("Done. You will get no more email about Ada’s supper club.", { timeout: 15_000 });
  await ravi.goto(raviInvitationStop);
  await expect(ravi.getByText("Emails about this event are stopped.", { exact: true })).toBeVisible();
  await expect(ravi.getByRole("button", { name: "Stop emails about this event" })).toHaveCount(0);
  await host.page.goto(`${manage}/invites`);
  const raviRow = inviteRow(host.page, "Ravi Kumar");
  await expect(raviRow.getByText("Stopped email", { exact: true })).toBeVisible();
  await expect(raviRow.getByRole("button", { name: /^Send/ })).toHaveCount(0);
  await expect(host.page.getByRole("button", { name: "Send to everyone not yet sent (0)" })).toBeDisabled();

  // Mei, who has replied, stops mail with her invitation's link: her row keeps her email, and the
  // next announcement reaches Asha alone.
  await mei.goto(invitationStop);
  await mei.getByRole("button", { name: "Stop emails about this event" }).click();
  await expect(mei.getByRole("status")).toHaveText("Done. You will get no more email about Ada’s supper club.", { timeout: 15_000 });
  await host.page.reload();
  const meiRow = inviteRow(host.page, "Mei Lin");
  await expect(meiRow.getByText("Stopped email", { exact: true })).toBeVisible();
  await expect(meiRow.getByText(meiEmail, { exact: true })).toBeVisible();
  await expect(meiRow.getByRole("button", { name: /^Send/ })).toHaveCount(0);
  await announce(host.page, manage, "See you at seven.");
  await invitationTo(request, asha.email, 2);
  expect(await mailCountTo(request, meiEmail)).toBe(2);
  expect(await mailCountTo(request, raviEmail)).toBe(2);

  await closeAll(host.page, ravi, mei, ashaPage);
});

test("a draft's invitations wait for it to be published; Share hands the link and the invitation's words to the device's share sheet", async ({ browser, request }) => {
  test.slow();
  const page = await (await browser.newContext()).newPage();
  const { name } = await signUpVerified(page, request, "invites-draft");
  await createDraft(page, SUPPER);
  const manage = page.url();
  // A share sheet that keeps what it was given, as a phone's would show it.
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: ShareData }).shared = data;
      },
    });
  });
  await page.goto(`${manage}/invites`);
  const meiLink = await makeInvite(page, "Mei Lin", newHost("invites-draft-mei").email);
  await expect(page.getByText("Invitations can be emailed while the event is published.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Send/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Share link for Mei Lin" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: ShareData }).shared)).toEqual({
    title: "Ada’s supper club",
    text: `${name} invited you to Ada’s supper club`,
    url: meiLink,
  });

  // Published, Send is there.
  await page.goto(manage);
  await publishInEditor(page);
  await page.goto(`${manage}/invites`);
  await expect(page.getByRole("button", { name: "Send the invitation to Mei Lin", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to everyone not yet sent (1)" })).toBeVisible();
  await expect(page.getByText("Invitations can be emailed while the event is published.")).toHaveCount(0);

  await closeAll(page);
});
