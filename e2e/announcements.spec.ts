import { createPublished } from "./events";
import { MAILPIT, latestMailTo, mailCountTo, newHost } from "./hosts";
import { expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// Ticket 03: the host posts an announcement, which shows on the event page for everyone and is
// emailed to the guests they pick by status; the announcements page lists and deletes them, and
// "Send a reminder now" drafts one. Mail is read in Mailpit; each guest has an address of their
// own, so no other test's mail is counted.

const EVENT = {
  rsvpStyle: "Inline",
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  location: "12 Orchard Road",
  plusOnes: "0",
  askEmail: true,
} as const;

const STOP_LINK = /https?:\/\/\S+\/m\/[A-Za-z0-9]{24}/;
const FOOTER = /^You are getting this because you gave your email when you replied to Ada’s birthday\. To stop emails about this event: https?:\/\/\S+\/m\/[A-Za-z0-9]{24}$/;

const STATUSES = ["Going", "Maybe", "Can’t go"] as const;
type Status = (typeof STATUSES)[number];

// A guest answers on a device of their own, giving their email.
async function reply(browser: Browser, link: string, status: Status, name: string) {
  const email = newHost("announce-guest").email;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await page.getByRole("button", { name: status }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible({ timeout: 15_000 });
  return { context, page, email };
}

// From the event's manage page, where the host is, to its announcements.
async function openAnnouncements(hostPage: Page) {
  await hostPage.getByRole("link", { name: "Announcements" }).click();
  await expect(hostPage.getByRole("heading", { name: "Announcements" })).toBeVisible();
}

// Posts an announcement, emailed to the statuses given, and waits until the form has emptied,
// which it does once the announcement is posted.
async function announce(hostPage: Page, text: string, audience: Status[]) {
  const message = hostPage.getByLabel("Message");
  await message.fill(text);
  for (const status of STATUSES) await hostPage.getByRole("checkbox", { name: status }).setChecked(audience.includes(status));
  await hostPage.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("", { timeout: 15_000 });
}

async function subjectOfLatestMailTo(request: APIRequestContext, email: string): Promise<string> {
  const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  const { messages } = (await search.json()) as { messages: { Subject: string }[] };
  return messages[0].Subject;
}

test("an announcement is emailed only to the statuses the host picked, shows on the page for everyone, and goes when deleted", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "announce", EVENT);
  // The guests it must not reach reply first. Mail is queued in reply order and sent in the order
  // it was queued, so an email wrongly queued for them would be in Mailpit before the Going guest's.
  const cant = await reply(browser, host.link, "Can’t go", "Arjun Rao");
  const maybe = await reply(browser, host.link, "Maybe", "Mei Lin");
  const going = await reply(browser, host.link, "Going", "Priya Nair");

  await openAnnouncements(host.page);
  await expect(
    host.page.getByText("Everyone who opens the event link can read announcements on the page. The email goes to the guests you pick who gave an email."),
  ).toBeVisible();
  // The email goes to Going and Maybe unless the host says otherwise.
  await expect(host.page.getByRole("checkbox", { name: "Going" })).toBeChecked();
  await expect(host.page.getByRole("checkbox", { name: "Maybe" })).toBeChecked();
  await expect(host.page.getByRole("checkbox", { name: "Can’t go" })).not.toBeChecked();

  await announce(host.page, "The gate code is 1234.\nRing twice.", ["Going"]);
  await expect(host.page.getByRole("status")).toHaveText("Posted to the event page and emailed to 1 guest.");
  await expect(host.page.getByText("Sent to Going")).toBeVisible();

  // The Going guest gets the host's words as written, then the footer with the stop link.
  await expect.poll(() => mailCountTo(request, going.email), { timeout: 30_000, message: `an email to ${going.email}` }).toBe(1);
  expect(await subjectOfLatestMailTo(request, going.email)).toBe("Ada’s birthday: a message from the host");
  const [message, footer, ...rest] = (await latestMailTo(request, going.email)).replace(/\r\n/g, "\n").trimEnd().split("\n\n");
  expect(message).toBe("The gate code is 1234.\nRing twice.");
  expect(footer).toMatch(FOOTER);
  expect(rest).toEqual([]);
  expect(await mailCountTo(request, maybe.email)).toBe(0);
  expect(await mailCountTo(request, cant.email)).toBe(0);

  // A guest who has not replied reads it on the page, with its line break.
  await page.goto(host.link);
  await expect(page.getByRole("heading", { name: "From the host" })).toBeVisible();
  expect(await page.getByText("The gate code is 1234.").innerText()).toBe("The gate code is 1234.\nRing twice.");

  // The host takes it down, and it is gone from both pages. Its Delete says which announcement it
  // takes, by when it was posted; once it has gone, the focus is on the page's heading.
  await host.page.getByRole("button", { name: /^Delete the announcement from \S/ }).click();
  await host.page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(host.page.getByText("Sent to Going")).toHaveCount(0, { timeout: 15_000 });
  await expect(host.page.getByRole("heading", { level: 1, name: "Announcements" })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From the host" })).toHaveCount(0);
  await expect(page.getByText("The gate code is 1234.")).toHaveCount(0);

  for (const context of [cant.context, maybe.context, going.context, host.context]) await context.close();
});

test("“Send a reminder now” drafts a reminder the host can change and send, and a cancelled event keeps it on the page", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "announce-remind", EVENT);
  await openAnnouncements(host.page);

  await host.page.getByRole("button", { name: "Send a reminder now" }).click();
  const message = host.page.getByLabel("Message");
  await expect(message).toHaveValue(/Ada’s birthday/);
  const draft = await message.inputValue();
  expect(draft).toContain("A reminder: Ada’s birthday is coming up.");
  // When, in the event's zone, and where.
  expect(draft).toMatch(/When: Saturday, March 6, 2027.*7:00\sPM/);
  expect(draft).toContain("Where: 12 Orchard Road");
  expect(draft).toContain(host.link);

  // The host adds a line, and sends it as any announcement.
  await message.fill(`${draft}\n\nSee you there!`);
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("", { timeout: 15_000 });
  await expect(host.page.getByRole("status")).toHaveText(
    "Posted to the event page. None of the guests you picked gave an email, so nobody was emailed.",
  );
  await expect(host.page.getByRole("listitem").getByText(/See you there!/)).toBeVisible();

  // Calling the event off leaves it on the page.
  await host.page.getByRole("link", { name: "Back to the event" }).click();
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.goto(host.link);
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expect(page.getByRole("heading", { name: "From the host" })).toBeVisible();
  await expect(page.getByText(/See you there!/)).toBeVisible();

  await host.context.close();
});

test("an event carries ten announcements, and the eleventh is refused", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "announce-ten", EVENT);
  await openAnnouncements(host.page);
  for (let number = 1; number <= 10; number++) await announce(host.page, `Note ${number}`, ["Going", "Maybe"]);

  const message = host.page.getByLabel("Message");
  await message.fill("Note 11");
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(host.page.locator("form").getByRole("alert")).toHaveText("Ten announcements is the most an event can carry. Delete one to post another.", {
    timeout: 15_000,
  });
  // The words are kept for when one has been deleted.
  await expect(message).toHaveValue("Note 11");
  await expect(host.page.getByRole("button", { name: /^Delete the announcement from \S/ })).toHaveCount(10);

  await host.context.close();
});

test("a guest who stopped email about the event gets no later announcement, while another guest does", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "announce-stop", EVENT);
  // The guest who stops replies first, so a later announcement wrongly queued for them would be in
  // Mailpit before the other guest's.
  const stopping = await reply(browser, host.link, "Going", "Priya Nair");
  const staying = await reply(browser, host.link, "Going", "Mei Lin");

  await openAnnouncements(host.page);
  await announce(host.page, "Doors open at seven.", ["Going", "Maybe"]);
  await expect(host.page.getByRole("status")).toHaveText("Posted to the event page and emailed to 2 guests.");
  await expect.poll(() => mailCountTo(request, stopping.email), { timeout: 30_000, message: `an email to ${stopping.email}` }).toBe(1);
  await expect.poll(() => mailCountTo(request, staying.email), { timeout: 30_000, message: `an email to ${staying.email}` }).toBe(1);

  // One tap on the link at the foot of that email stops the next.
  await stopping.page.goto((await latestMailTo(request, stopping.email)).match(STOP_LINK)![0]);
  await stopping.page.getByRole("button", { name: "Stop emails about this event" }).click();
  await expect(stopping.page.getByText("Done. You will get no more email about Ada’s birthday.")).toBeVisible({ timeout: 15_000 });

  await announce(host.page, "Bring a jacket.", ["Going", "Maybe"]);
  await expect(host.page.getByRole("status")).toHaveText("Posted to the event page and emailed to 1 guest.");
  await expect.poll(() => mailCountTo(request, staying.email), { timeout: 30_000, message: `a second email to ${staying.email}` }).toBe(2);
  expect(await latestMailTo(request, staying.email, 1)).toContain("Bring a jacket.");
  expect(await mailCountTo(request, stopping.email)).toBe(1);

  for (const context of [stopping.context, staying.context, host.context]) await context.close();
});
