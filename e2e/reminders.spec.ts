import { expect, test, type APIRequestContext, type Browser, type Page } from "./test";
import { createDraft, type DraftFields } from "./events";
import { MAILPIT, mailCountTo, newHost, signUpVerified } from "./hosts";

// Automatic reminders (ticket 04): guests who gave an email are reminded the day before if they
// said Going (and a week before if they said Maybe), queued by the app's own mail worker, which
// runs once a minute. A reminder falls due only for an event published before its time, so the
// event is published to start a little over a day away: its day reminder falls due two to three
// minutes later, once the guests have replied, and the test allows two minutes past that for the
// worker's next run to send it. Each guest has an address of their own, so no other test's mail
// is counted.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// createDraft puts every event in Asia/Singapore, which keeps one offset all year.
const SINGAPORE = 8 * 60 * MINUTE;

// A start the Starts field can take (it has no seconds), in Singapore, at an instant.
const startField = (start: Date) => new Date(start.getTime() + SINGAPORE).toISOString().slice(0, 16);

const REMINDERS = "Remind guests by email (a week before to Maybe, the day before to Going)";
const ASK_EMAIL_HINT = "Guests get email only if you ask for their email on the RSVP form.";

async function publish(page: Page, fields: DraftFields) {
  const link = await createDraft(page, fields);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  return link;
}

// A guest answers on a device of their own, giving their email, and bringing `plusOnes` when the
// event lets them bring anyone.
async function reply(browser: Browser, link: string, status: "Going" | "Maybe", name: string, plusOnes?: number) {
  const email = newHost("reminders-guest").email;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await page.getByRole("button", { name: status }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  if (plusOnes !== undefined) {
    await page.getByRole("button", { name: "Continue" }).click();
    if (plusOnes > 0) await page.getByRole("radio", { name: `+${plusOnes}` }).click();
  }
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible({ timeout: 15_000 });
  await context.close();
  return email;
}

async function onlyMailTo(request: APIRequestContext, email: string) {
  const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  const { messages } = (await search.json()) as { messages: { ID: string; Subject: string }[] };
  expect(messages).toHaveLength(1);
  const message = (await (await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
  return { subject: messages[0].Subject, text: message.Text.trimEnd() };
}

test("the guests who said Going are reminded the day before, and an event with reminders off reminds nobody", async ({
  browser,
  request,
}) => {
  test.setTimeout(8 * MINUTE);
  const context = await browser.newContext();
  const host = await context.newPage();
  await signUpVerified(host, request, "reminders");

  // Ada's birthday starts at the first whole minute more than a day and two minutes from now, so
  // its day reminder falls due two to three minutes after it is published.
  const start = new Date(Math.ceil((Date.now() + DAY + 2 * MINUTE) / MINUTE) * MINUTE);
  const dueAt = start.getTime() - DAY;
  const birthday = await publish(host, {
    title: "Ada’s birthday",
    start: startField(start),
    location: "Ah Ma’s house, 3rd floor",
    plusOnes: "2",
    askEmail: true,
  });
  // The fence: an event with reminders off, whose day reminder would fall due a minute sooner. Had
  // it been queued, it would be queued no later than Ada's, and sent first.
  const housewarming = await publish(host, {
    title: "Mei’s housewarming",
    start: startField(new Date(start.getTime() - MINUTE)),
    plusOnes: "0",
    askEmail: true,
    reminders: false,
  });

  // The Maybe guest replies before the Going guest: a reminder wrongly queued for them would be
  // queued first, and reach Mailpit first.
  const fenced = await reply(browser, housewarming, "Going", "Arjun Rao");
  const maybe = await reply(browser, birthday, "Maybe", "Mei Lin", 0);
  const going = await reply(browser, birthday, "Going", "Priya Nair", 2);
  expect(Date.now(), "every guest replied before the reminders fell due").toBeLessThan(dueAt - MINUTE);

  await expect
    .poll(() => mailCountTo(request, going), {
      timeout: dueAt + 2 * MINUTE - Date.now(),
      intervals: [2_000],
      message: "the day reminder, within two minutes of falling due",
    })
    .toBe(1);
  const reminder = await onlyMailTo(request, going);
  expect(reminder.subject).toBe("Ada’s birthday is tomorrow");
  expect(reminder.text).toContain("Ada’s birthday is tomorrow.");
  // When, in the event's zone, as the guest's own is unknown.
  expect(reminder.text).toMatch(/^When: .+ GMT\+8$/m);
  expect(reminder.text).toContain("Where: Ah Ma’s house, 3rd floor");
  expect(reminder.text).toContain("You said Going, with 2 plus-ones.");
  expect(reminder.text).toContain(birthday);
  expect(reminder.text).toMatch(
    /You are getting this because you gave your email when you replied to Ada’s birthday\. To stop emails about this event: https?:\/\/\S+\/m\/[A-Za-z0-9]{24}$/,
  );
  expect(await mailCountTo(request, maybe)).toBe(0);
  expect(await mailCountTo(request, fenced)).toBe(0);

  // The setting tells the host that guests get email only when they are asked for it.
  await host.goto("/events/new");
  await expect(host.getByLabel(REMINDERS)).toBeChecked();
  await expect(host.getByText(ASK_EMAIL_HINT)).toBeVisible();
  await host.getByLabel("Ask guests for an email address").check();
  await expect(host.getByText(ASK_EMAIL_HINT)).toBeHidden();

  await context.close();
});
