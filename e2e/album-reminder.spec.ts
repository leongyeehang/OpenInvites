import sharp from "sharp";
import { createDraft, editSettings, openSettings, publishInEditor } from "./events";
import { dismissOperatorWelcome, MAILPIT, newHost, signUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";
import { expect, test, type APIRequestContext, type Page } from "./test";

// M7 ticket 09: the album's reminder and Empty the album. Runs against `app-fresh` (with mail) and
// `app-no-mail` after the retention spec (the `album-reminder-instance` project), and recreates
// both, so each starts empty. On each, the first host makes events dated 100 days ago with a photo
// in the album and asks to be reminded 90 days after; then the app containers are restarted, so the
// clock's first minute sweeps with the events there: the hosts are reminded, on their pages and,
// with mail, by email, and nothing is deleted until one of them says so. The scenarios run in order.
test.describe.configure({ mode: "serial" });

const DAY = 24 * 60 * 60 * 1000;
const NO_MAIL = "http://localhost:3003";
const PARTY = "Ada’s garden party";
const PICNIC = "Ada’s picnic";
const REMIND = "Remind me about the album";
const HEADING = "Albums to empty or keep";
const NOTICE = /^The album holds 1 photo and 0 videos \(.+\)\. Empty it or keep it\.$/;

let host: Page;
let hostEmail: string;
let party: string;
let picnic: string;
let picnicLink: string;
let noMailHost: Page;
let noMailParty: string;

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh", "db-no-mail", "app-no-mail");
});

test.afterAll(async () => {
  for (const page of [host, noMailHost]) await page?.context().close();
});

// A start `days` days before now at today's time of day, as typed into the event form for an event
// in Singapore.
function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

async function photo(name: string) {
  return { name, mimeType: "image/jpeg", buffer: await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#2f6b3a" } }).jpeg().toBuffer() };
}

const album = (page: Page) => page.locator('[data-slot="album"]');
const notice = (page: Page) => page.locator('[data-slot="album-reminder"]');

// A published event dated 100 days ago, to be reminded about 90 days after, with one photo its
// host adds from the event page (the album is open, the event being past).
async function oldEventWithPhoto(page: Page, title: string): Promise<{ manage: string; link: string }> {
  const link = await createDraft(page, { title, start: daysAgo(100) });
  const manage = page.url();
  await publishInEditor(page);
  await editSettings(page, async (sheet) => {
    await sheet.getByLabel(REMIND).selectOption("90");
  });
  await page.goto(link);
  await album(page).getByLabel(/^Add photos/).setInputFiles([await photo("garden.jpg")]);
  await expect(album(page).getByRole("button", { name: /^Photo 1 by/ })).toBeVisible({ timeout: 30_000 });
  return { manage, link };
}

// The reminder about this event that reached this address, found by its subject.
async function reminderTo(request: APIRequestContext, email: string, title: string): Promise<string> {
  let id = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
        const { messages } = (await response.json()) as { messages: { ID: string; Subject: string }[] };
        id = messages.find(({ Subject }) => Subject === `Empty or keep the album of ${title}?`)?.ID ?? "";
        return id;
      },
      { timeout: 15_000, message: `the reminder about ${title} to ${email}` },
    )
    .not.toBe("");
  return ((await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string }).Text;
}

test("the first host of each instance makes old events with a photo in the album, to be reminded about 90 days after", async ({ browser, request }) => {
  test.setTimeout(300_000);
  host = await (await browser.newContext()).newPage();
  const account = newHost("album-reminder");
  hostEmail = account.email;
  await signUp(host, account);
  await dismissOperatorWelcome(host);
  await verifyEmail(host, request, account.email);
  ({ manage: party } = await oldEventWithPhoto(host, PARTY));
  ({ manage: picnic, link: picnicLink } = await oldEventWithPhoto(host, PICNIC));
  // A new event starts with the site's default, 60 days, and the choice is kept across other saves.
  await host.goto(party);
  const sheet = await openSettings(host);
  await expect(sheet.getByLabel(REMIND)).toHaveValue("90");
  await host.keyboard.press("Escape");

  // Without mail no email is verified: the host makes the event at once.
  noMailHost = await (await browser.newContext({ baseURL: NO_MAIL })).newPage();
  await signUp(noMailHost, newHost("album-reminder-no-mail"));
  await dismissOperatorWelcome(noMailHost);
  ({ manage: noMailParty } = await oldEventWithPhoto(noMailHost, PARTY));
});

test("the first sweep after a restart reminds the hosts on the dashboard, the manage page and by email, and deletes nothing", async ({ request }) => {
  test.setTimeout(300_000);
  recreate("app-fresh", "app-no-mail");

  // The clock's first minute after the start: the dashboard is read until the reminders show.
  await expect(async () => {
    await host.goto("/dashboard");
    await expect(host.getByRole("heading", { name: HEADING })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 150_000, intervals: [5_000] });
  const reminders = host.getByRole("region", { name: HEADING });
  await expect(reminders.locator('[data-slot="album-reminder"]')).toHaveCount(2);
  await expect(reminders.getByText(PARTY)).toBeVisible();
  await expect(reminders.getByText(NOTICE).first()).toBeVisible();

  const text = await reminderTo(request, hostEmail, PARTY);
  expect(text).toContain("You asked to be reminded about the album 90 days after Ada’s garden party. It holds 1 photo and no videos (");
  expect(text).toContain("Nothing is deleted on its own");
  expect(text).toContain(party);
  expect(text).toContain("choose Never under “Remind me about the album”");

  // The manage page carries the notice; the photo is still there.
  await host.goto(party);
  await expect(notice(host).getByText(NOTICE)).toBeVisible();
});

test("Keep it takes the reminder down and sets it to Never, which another change to the settings leaves alone", async () => {
  await host.goto(party);
  await notice(host).getByRole("button", { name: "Keep it" }).click();
  await expect(notice(host)).toBeHidden();
  await host.reload();
  await expect(notice(host)).toBeHidden();
  const sheet = await openSettings(host);
  await expect(sheet.getByLabel(REMIND)).toHaveValue("never");
  await host.keyboard.press("Escape");
  // Review Focus 8: the sheet's form posts every field on every change, and not this one.
  await editSettings(host, async (sheet) => {
    await sheet.getByLabel("Plus-ones per guest").selectOption("2");
  });
  const again = await openSettings(host);
  await expect(again.getByLabel(REMIND)).toHaveValue("never");
  await host.keyboard.press("Escape");
  await host.goto("/dashboard");
  await expect(host.getByRole("region", { name: HEADING }).locator('[data-slot="album-reminder"]')).toHaveCount(1);
});

test("Empty the album from the reminder names what goes, and the album is empty afterwards", async () => {
  await host.goto(picnic);
  await notice(host).getByRole("button", { name: "Empty the album" }).click();
  const dialog = host.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: /^Delete 1 photo and 0 videos \(.+\)\?$/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete them" }).click();
  await expect(notice(host)).toBeHidden();
  await host.goto(picnicLink);
  await expect(album(host)).toBeVisible();
  await expect(album(host).getByRole("button", { name: /^Photo 1 by/ })).toHaveCount(0);
  await host.goto("/dashboard");
  await expect(host.getByRole("heading", { name: HEADING })).toHaveCount(0);
  // Emptied, there is nothing to empty from the settings either.
  await host.goto(picnic);
  const sheet = await openSettings(host);
  await expect(sheet.getByRole("button", { name: "Empty the album" })).toHaveCount(0);
  await host.keyboard.press("Escape");
});

test("without mail the reminder shows on the host's pages, and no email goes", async ({ request }) => {
  test.setTimeout(300_000);
  await expect(async () => {
    await noMailHost.goto(noMailParty);
    await expect(notice(noMailHost).getByText(NOTICE)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 150_000, intervals: [5_000] });
  const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `subject:"Empty or keep the album"` } });
  const { messages } = (await response.json()) as { messages: { To: { Address: string }[] }[] };
  expect(messages.filter((message) => message.To.some(({ Address }) => Address.endsWith("no-mail")))).toEqual([]);
});
