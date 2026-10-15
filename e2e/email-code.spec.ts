import type { APIRequestContext } from "@playwright/test";
import { createPublished, type DraftFields } from "./events";
import { latestMailTo, mailCountTo, newHost } from "./hosts";
import { clientAddress, expect, test } from "./test";

// Ticket 05 (M3): the email proven by a code. The host asks for an email and has it checked; a
// guest who gives one is sent a six-digit code, and their reply is saved only once they enter it.
// The guest drives the test's own page, so all of it runs at 390 pixels in the mobile project and
// at desktop width in the other. The test profile allows each address five replies and five
// emails a minute (RATE_LIMIT_RSVP, RATE_LIMIT_MAIL), and every test keeps within its own.

const PARTY = { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0", email: "optional", verifyEmail: true } satisfies DraftFields;

// What a guest is told when they ask for a code too soon after the last one.
const TOO_SOON = "We just sent you a code. Look for it in your email.";

// The code in the newest email to the address, which is the only thing on its line.
async function codeSentTo(request: APIRequestContext, email: string, after = 0): Promise<string> {
  const code = (await latestMailTo(request, email, after)).match(/^([0-9]{6})\r?$/m)?.[1];
  expect(code, `a code in the email to ${email}`).toBeDefined();
  return code!;
}

// A code that is not this one.
function otherThan(code: string): string {
  return String((Number(code) + 1) % 1_000_000).padStart(6, "0");
}

test("a guest proves their email with the code it was sent, keeps it proven while it stays, and is asked again once it changes", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "code-host", PARTY);
  const manage = host.page.url();
  const email = newHost("code-guest").email;
  const changed = newHost("code-changed").email;

  // The host's check waits while the form asks for no email.
  const contact = host.page.getByRole("group", { name: "Contact details" });
  const check = contact.getByLabel("Check the email with a code");
  await expect(check).toBeChecked();
  await contact.getByLabel("Email", { exact: true }).selectOption("none");
  await expect(check).toBeDisabled();
  await expect(check).not.toBeChecked();
  await contact.getByLabel("Email", { exact: true }).selectOption("optional");
  await expect(check).toBeEnabled();
  await expect(check).toBeChecked();

  // In the default Sheet style, the code step rises with the rest.
  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  const sheet = page.getByRole("dialog", { name: "Your RSVP" });
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await sheet.getByLabel("Email").fill(email);
  await sheet.getByRole("button", { name: "Send RSVP" }).click();

  await expect(sheet.getByText(`We sent a code to ${email}.`)).toBeVisible();
  const code = sheet.getByLabel("Code");
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute("inputmode", "numeric");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  // Not again so soon after one went.
  await expect(sheet.getByRole("button", { name: /^Send it again/ })).toBeDisabled();

  // The code arrives on its own line, with how long it lasts and why it came, and nothing to click.
  const mail = await latestMailTo(request, email);
  expect(mail).toContain("Your code for Ada’s birthday:");
  expect(mail).toContain("It lasts ten minutes.");
  expect(mail).toContain("You’re getting this because this address was entered on the RSVP form for Ada’s birthday. If it wasn’t you, ignore this email.");
  expect(mail).not.toMatch(/https?:\/\//);
  const sent = await codeSentTo(request, email);

  await code.fill(otherThan(sent));
  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("That code isn’t right. 4 tries left.");
  await code.fill(sent);
  await sheet.getByRole("button", { name: "Confirm" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible();
  await expect(sheet.getByText(`We’ll reach you at ${email}.`)).toBeVisible();

  // The host's list marks the address as proven.
  await host.page.goto(`${manage}/guests`);
  const going = host.page.getByRole("region", { name: /^Going/ });
  await expect(going.getByText(email, { exact: true })).toBeVisible();
  await expect(going.getByText("Email checked", { exact: true })).toHaveCount(1);

  // Changing something else keeps the proven email, and asks for no code.
  await sheet.getByRole("button", { name: "Edit details" }).click();
  await sheet.getByLabel("Your name").fill("Priya N.");
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible();
  await expect(sheet.getByText("Priya N., just you.")).toBeVisible();
  expect(await mailCountTo(request, email)).toBe(1);

  // A new email is proven again.
  await sheet.getByRole("button", { name: "Edit details" }).click();
  await sheet.getByLabel("Email").fill(changed);
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText(`We sent a code to ${changed}.`)).toBeVisible();
  await codeSentTo(request, changed);

  // Meanwhile the reply keeps the proven email. A host who changes it takes the mark away.
  await host.page.reload();
  await expect(going.getByText("Email checked", { exact: true })).toHaveCount(1);
  await going.getByRole("button", { name: "Edit" }).click();
  await going.getByLabel("Email").fill(newHost("code-host-given").email);
  await going.getByRole("button", { name: "Save" }).click();
  await expect(going.getByText("Saved.")).toBeVisible();
  await expect(going.getByText("Email checked", { exact: true })).toHaveCount(0);

  await host.context.close();
});

test("a guest at the mail limit who asks for another code is told so, and can still enter the last one", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "code-limit", { ...PARTY, rsvpStyle: "Inline" });
  const email = newHost("code-limit-guest").email;
  // The guest's address is their own, apart from the host's, whose sign-up email counted too.
  const guest = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  const page = await guest.newPage();

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByLabel("Email").fill(email);

  // Someone else at the guest's address (a household, an office) has just had four emails sent,
  // which leaves this minute's allowance one email, the guest's first code.
  for (let sent = 0; sent < 4; sent++) {
    const asked = await guest.request.post("/api/auth/send-verification-email", {
      data: { email: newHost("code-limit-other").email, callbackURL: "/verify-email" },
      headers: { origin: "http://localhost:3000" },
    });
    expect(asked.status()).not.toBe(429);
  }
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(`We sent a code to ${email}.`)).toBeVisible();

  // Thirty seconds on, the guest asks again, and the instance will send no more this minute.
  const again = page.getByRole("button", { name: /^Send it again/ });
  await expect(again).toBeDisabled();
  await expect(again).toHaveText("Send it again", { timeout: 40_000 });
  await again.click();
  await expect(page.getByText("We can’t send another code right now. Try again in a few minutes.")).toBeVisible();

  // The step is still there, and the code already sent still works.
  await page.getByLabel("Code").fill(await codeSentTo(request, email));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
  await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible();
  expect(await mailCountTo(request, email)).toBe(1);

  await guest.close();
  await host.context.close();
});

test("two asks for another code at the same moment send one, and the other is told one just went", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "code-twice", { ...PARTY, rsvpStyle: "Inline" });
  const email = newHost("code-twice-guest").email;

  // The guest has the invitation open in two tabs, and answers in both.
  const other = await page.context().newPage();
  for (const tab of [page, other]) {
    await tab.goto(host.link);
    await tab.getByRole("button", { name: "Going" }).click();
    await tab.getByLabel("Your name").fill("Priya Nair");
    await tab.getByLabel("Email").fill(email);
    await tab.getByRole("button", { name: "Send RSVP" }).click();
    await expect(tab.getByText(`We sent a code to ${email}.`)).toBeVisible();
  }
  // The second tab is told the first one's code is the one to enter.
  await expect(other.getByText(TOO_SOON)).toBeVisible();
  await expect.poll(() => mailCountTo(request, email), { timeout: 15_000 }).toBe(1);

  // Thirty seconds on, both ask again at once: one new code goes, and the other tab is told so.
  const again = [page, other].map((tab) => tab.getByRole("button", { name: /^Send it again/ }));
  for (const button of again) await expect(button).toHaveText("Send it again", { timeout: 40_000 });
  await Promise.all(again.map((button) => button.click()));
  await expect.poll(async () => (await page.getByText(TOO_SOON).count()) + (await other.getByText(TOO_SOON).count()), { timeout: 15_000 }).toBe(1);
  await expect.poll(() => mailCountTo(request, email), { timeout: 15_000 }).toBe(2);

  // The newest code is the one that works.
  await page.getByLabel("Code").fill(await codeSentTo(request, email, 1));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
  expect(await mailCountTo(request, email)).toBe(2);

  await host.context.close();
});

test("the Broadsheet's ballot asks for the code in its card, and takes it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "code-broadsheet", { ...PARTY, layout: "Broadsheet", title: "Supper at Mei’s" });
  const email = newHost("code-broadsheet-guest").email;

  await page.goto(host.link);
  await page.getByRole("radio", { name: "I’ll be there", exact: true }).check();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Post my reply" }).click();

  const ballot = page.locator('[data-slot="ballot"]');
  await expect(ballot.getByText(`We sent a code to ${email}.`)).toBeVisible();
  await expect(ballot.getByLabel("Code")).toBeFocused();
  await expect(ballot.getByLabel("Your name")).toBeHidden();
  await expect(ballot.getByRole("button", { name: /^Send it again/ })).toBeDisabled();

  // Back to the email and posted again unchanged: the code just sent is still the one to enter.
  await ballot.getByRole("button", { name: "Change email" }).click();
  await expect(ballot.getByLabel("Email")).toBeFocused();
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(ballot.getByLabel("Code")).toBeFocused();
  await expect(ballot.getByText(`We sent a code to ${email}.`)).toBeVisible();
  await expect(ballot.getByText(TOO_SOON)).toHaveCount(0);
  expect(await mailCountTo(request, email)).toBe(1);

  await ballot.getByLabel("Code").fill(await codeSentTo(request, email));
  await ballot.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("Received", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible();

  await host.context.close();
});

test("the Thread's host asks for the code in the conversation, and takes it from the composer", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "code-thread", { ...PARTY, layout: "Thread", title: "Ada’s party" });
  const email = newHost("code-thread-guest").email;
  const conversation = page.getByRole("log");
  const send = page.getByRole("button", { name: "Send", exact: true });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await send.click();
  await page.getByLabel("Email").fill(email);
  await send.click();

  await expect(conversation.getByText(`We sent a code to ${email}. Type it here.`, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^Send it again/ })).toBeDisabled();
  await page.getByLabel("Code").fill(await codeSentTo(request, email));
  await send.click();

  await expect(page.locator('[data-slot="done"]')).toContainText("You’re in, Priya!", { timeout: 15_000 });

  await host.context.close();
});
