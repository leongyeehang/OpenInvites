import { chooseLayout, createPublished, type DraftFields } from "./events";
import { latestMailTo, mailCountTo, newHost } from "./hosts";
import { clientAddress, expect, expectNotFoundAsSent, test, type Browser, type Page } from "./test";

// Ticket 08 (M3): personal invite links. A host makes a link for a named guest; opening it fills in
// the guest's name and the email the host gave, which counts as proven; the reply is tied to the
// invite, approved whatever the approval setting, and the invite link becomes the guest's edit link
// on any device. The host sees who opened and who replied, and the guests invited who have not
// replied under Invited on the guest list; a deleted invite's link is not found, and its reply
// stays. Every guest is on a device of their own, reaching the instance from an address of their
// own. Each test runs at 390 pixels in the mobile project and at desktop width in the other.

const INVITE_LINK = /^https?:\/\/\S+\/i\/[A-Za-z0-9]{24}$/;

const SUPPER = { rsvpStyle: "Inline", title: "Ada’s supper club", start: "2027-03-06T19:00", plusOnes: "0", askEmail: true } satisfies DraftFields;

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
  await expect(hostPage.getByRole("status")).toHaveText(`Made a link for ${name}.`, { timeout: 15_000 });
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
  await host.page.getByLabel("Who can see the guest list").selectOption("always");
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText(/^Saved\./)).toBeVisible({ timeout: 15_000 });

  // The host makes two invites from the manage page's Invites; nobody has opened either.
  await host.page.goto(manage);
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
  await expect(meiPhone.getByText("You’re going!")).toBeVisible();
  await meiPhone.getByRole("button", { name: "Change my answer" }).click();
  await meiPhone.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(meiPhone.getByLabel("Your name")).toHaveValue("Mei Lin");
  await meiPhone.getByRole("button", { name: "Send RSVP" }).click();
  await expect(meiPhone.getByText("You’re a maybe.")).toBeVisible({ timeout: 15_000 });
  await mei.reload();
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
  await expect(tablet.getByText("You’re going!")).toBeVisible();
  await expect(tablet.getByText(meiLink, { exact: true })).toBeVisible();

  // The laptop's form, sent as a Maybe, changes that reply.
  await laptop.getByRole("button", { name: "Maybe", exact: true }).click();
  await laptop.getByRole("button", { name: "Send RSVP" }).click();
  await expect(laptop.getByText("You’re a maybe.")).toBeVisible({ timeout: 15_000 });
  await expect(laptop.getByText(meiLink, { exact: true })).toBeVisible();
  for (const device of [laptop, phone, tablet]) {
    await device.reload();
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

  await closeAll(host.page);
});
