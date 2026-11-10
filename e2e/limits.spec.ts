import sharp from "sharp";
import { expect, test, type Browser, type Page } from "./test";
import { APPROVAL, editSettings, eventLinkIn, openMore, publishInEditor, setWhen, typeTitle } from "./events";
import { dismissOperatorWelcome, mailCountTo, newHost, signUp, toSiteSettings, verifyEmail } from "./hosts";
import { recreate } from "./instances";
import { closeReply } from "./reply";

// Ticket 01: the operator's two limits. Runs against `app-fresh` after the fresh-instance specs
// (the `limits-instance` project), and recreates it first, so the first account here is the
// operator. The scenarios run in order, each leaving the instance as the next expects it.
test.describe.configure({ mode: "serial" });

const EVENTS_REFUSAL = "You have 2 events, the most this site allows. Delete an event you no longer need to make another.";
const REPLIES_REFUSAL = /This event can.t take more replies\./;

let operator: Page;
let eventLink: string;

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh");
});

test.afterAll(async () => {
  await operator?.context().close();
});

// New event, and in the editor it opens, a draft with what publishing needs. At the limit, New
// event is refused, and the page says so where it is.
async function fillDraft(page: Page, title: string) {
  await page.goto("/events/new");
  const editor = page.getByRole("textbox", { name: "Event title" });
  await expect(editor.or(page.getByText(EVENTS_REFUSAL))).toBeVisible({ timeout: 20_000 });
  if (!(await editor.isVisible())) return;
  await typeTitle(page, title);
  await setWhen(page, { start: "2027-03-06T19:00" });
  await editSettings(page, async (sheet) => {
    await sheet.getByLabel("Plus-ones per guest").selectOption("0");
  });
}

async function reply(browser: Browser, link: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  return page;
}

test("the operator sets the limits to two and sees them saved", async ({ browser, request }) => {
  test.slow();
  operator = await (await browser.newContext()).newPage();
  const host = newHost("limits");
  const mails = await mailCountTo(request, host.email);
  await signUp(operator, host);
  await dismissOperatorWelcome(operator);
  await verifyEmail(operator, request, host.email, mails);

  await operator.goto("/dashboard");
  await toSiteSettings(operator);
  await expect(operator.getByLabel("Events per host")).toHaveValue("50");
  await expect(operator.getByLabel("Replies per event")).toHaveValue("500");
  await expect(operator.getByText("Counts every event a host owns, drafts and past events included.")).toBeVisible();
  await expect(operator.getByText("Counts every reply to an event, whatever its answer.")).toBeVisible();

  await operator.getByLabel("Events per host").fill("2");
  await operator.getByLabel("Replies per event").fill("2");
  const limits = operator.locator("form").filter({ has: operator.getByLabel("Events per host") });
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();
  await operator.reload();
  await expect(operator.getByLabel("Events per host")).toHaveValue("2");
  await expect(operator.getByLabel("Replies per event")).toHaveValue("2");
});

// M7 ticket 01: the upload and storage limits and the album reminder's default, on the same card,
// in effect from the moment they are saved. The small values set here stay for the album rows below.
test("the upload and storage limits and the reminder default save, read back, and refuse what is out of range", async () => {
  await operator.goto("/instance");
  await expect(operator.getByLabel("Largest photo (MB)")).toHaveValue("40");
  await expect(operator.getByLabel("Largest video (MB)")).toHaveValue("750");
  await expect(operator.getByLabel("Longest video (min)")).toHaveValue("15");
  await expect(operator.getByLabel("Storage per event (GB)")).toHaveValue("50");
  await expect(operator.getByLabel("Storage for the site (GB)")).toHaveValue("50");
  await expect(operator.getByLabel("Remind hosts about albums after")).toHaveValue("60");
  const limits = operator.locator("form").filter({ has: operator.getByLabel("Events per host") });

  await operator.getByLabel("Largest photo (MB)").fill("1");
  await operator.getByLabel("Largest video (MB)").fill("2");
  await operator.getByLabel("Longest video (min)").fill("1");
  await operator.getByLabel("Storage per event (GB)").fill("0.01");
  await operator.getByLabel("Storage for the site (GB)").fill("0.02");
  await operator.getByLabel("Remind hosts about albums after").fill("7");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();
  await operator.reload();
  await expect(operator.getByLabel("Largest photo (MB)")).toHaveValue("1");
  await expect(operator.getByLabel("Largest video (MB)")).toHaveValue("2");
  await expect(operator.getByLabel("Longest video (min)")).toHaveValue("1");
  await expect(operator.getByLabel("Storage per event (GB)")).toHaveValue("0.01");
  await expect(operator.getByLabel("Storage for the site (GB)")).toHaveValue("0.02");
  await expect(operator.getByLabel("Remind hosts about albums after")).toHaveValue("7");

  // Out of range, past the browser's own check: the server names the field, and nothing is saved.
  await limits.evaluate((form) => form.setAttribute("novalidate", ""));
  await operator.getByLabel("Largest photo (MB)").fill("2000");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Enter a whole number from 1 to 1,000 MB for the largest photo.")).toBeVisible();
  await operator.getByLabel("Largest photo (MB)").fill("1");
  await operator.getByLabel("Storage per event (GB)").fill("0.001");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Enter a number from 0.01 to 100,000 GB for storage per event.")).toBeVisible();
  await operator.reload();
  await expect(operator.getByLabel("Largest photo (MB)")).toHaveValue("1");
  await expect(operator.getByLabel("Storage per event (GB)")).toHaveValue("0.01");

  // Never turns the reminder off, and the choice survives a reload.
  await operator.getByLabel("Never", { exact: true }).check();
  await expect(operator.getByLabel("Remind hosts about albums after")).toBeDisabled();
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();
  await operator.reload();
  await expect(operator.getByLabel("Never", { exact: true })).toBeChecked();
  await expect(operator.getByLabel("Remind hosts about albums after")).toBeDisabled();
});

test("a limit outside the range is refused", async () => {
  await operator.goto("/instance");
  const limits = operator.locator("form").filter({ has: operator.getByLabel("Events per host") });
  // The browser's own check would stop these; the server's answer is what is under test.
  await limits.evaluate((form) => form.setAttribute("novalidate", ""));
  await operator.getByLabel("Events per host").fill("0");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Enter a whole number from 1 to 100,000 for events per host.")).toBeVisible();
  await operator.reload();
  await expect(operator.getByLabel("Events per host")).toHaveValue("2");
});

test("a host at the events limit cannot create or duplicate an event", async () => {
  test.slow();
  await operator.goto("/account");
  await expect(operator.getByRole("banner").getByRole("link", { name: "New event" })).toBeVisible();
  await fillDraft(operator, "First party");
  await expect(operator).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await fillDraft(operator, "Second party");
  await expect(operator).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const second = operator.url();

  await fillDraft(operator, "Third party");
  await expect(operator.getByText(EVENTS_REFUSAL)).toBeVisible();
  await expect(operator).toHaveURL(/\/events\/new$/);

  await operator.goto("/dashboard");
  await expect(operator.getByText(EVENTS_REFUSAL)).toBeVisible();
  await expect(operator.getByRole("link", { name: "New event" })).toHaveCount(0);
  // The header's New event pill is on every host page, and gone from all of them at the limit.
  await operator.goto("/account");
  await expect(operator.getByRole("banner").getByRole("button", { name: "Account menu" })).toBeVisible();
  await expect(operator.getByRole("link", { name: "New event" })).toHaveCount(0);

  await operator.goto(second);
  await openMore(operator);
  await operator.getByRole("button", { name: "Duplicate" }).click();
  await expect(operator.getByText(EVENTS_REFUSAL)).toBeVisible();
  await expect(operator).toHaveURL(second);
});

test("a third guest is refused at the replies limit, a reply waiting for approval counted, while the first can still change their answer", async ({
  browser,
}) => {
  test.slow();
  await operator.goto("/dashboard");
  await operator.getByRole("link", { name: /First party/ }).click();
  await publishInEditor(operator);
  eventLink = await eventLinkIn(operator);

  const first = await reply(browser, eventLink, "Priya Nair");
  await expect(first.getByText("You’re going!")).toBeVisible();
  // The host now approves each reply, so the second waits; it counts against the limit all the same.
  await editSettings(operator, (sheet) => sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel(APPROVAL).check());
  const second = await reply(browser, eventLink, "Arjun Rao");
  await expect(second.getByText("Your reply is waiting for the host’s approval.")).toBeVisible();

  const third = await reply(browser, eventLink, "Meera Das");
  await expect(third.getByText(REPLIES_REFUSAL)).toBeVisible();
  await expect(third.getByText("You’re going!")).toHaveCount(0);

  await first.getByRole("button", { name: "Change my answer" }).click();
  await first.getByRole("button", { name: "Maybe" }).click();
  await first.getByRole("button", { name: "Send RSVP" }).click();
  await expect(first.getByText("You’re a maybe.")).toBeVisible();
  await expect(first.getByText(REPLIES_REFUSAL)).toHaveCount(0);

  for (const page of [first, second, third]) await page.context().close();
});

// M4 ticket 11: the operator's limit on photos per event, which the album's upload enforces.
test("an album at the operator's photos limit refuses more, saying how many it has room for", async () => {
  test.slow();
  await operator.goto("/instance");
  await expect(operator.getByLabel("Photos and videos per event")).toHaveValue("300");
  await operator.getByLabel("Photos and videos per event").fill("1");
  const limits = operator.locator("form").filter({ has: operator.getByLabel("Events per host") });
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByText("Saved.")).toBeVisible();

  // The second party, dated in the past and published, so its album is open to its host.
  await operator.goto("/dashboard");
  await operator.getByRole("link", { name: /Second party/ }).click();
  await setWhen(operator, { start: "2026-01-10T19:00" });
  await publishInEditor(operator);
  await operator.goto(await eventLinkIn(operator));
  const album = operator.locator('[data-slot="album"]');
  const add = album.getByLabel("Add photos");
  const photo = async (name: string) => ({ name, mimeType: "image/png", buffer: await sharp({ create: { width: 40, height: 30, channels: 3, background: "#406080" } }).png().toBuffer() });

  await add.setInputFiles([await photo("one.png"), await photo("two.png")]);
  await expect(album.getByRole("alert")).toHaveText("The album has room for 1 more photo.", { timeout: 15_000 });
  await add.setInputFiles([await photo("one.png")]);
  await expect(album.getByRole("status")).toHaveText("one.png: added", { timeout: 15_000 });
  await expect(album.getByRole("img")).toHaveCount(1);
  await add.setInputFiles([await photo("two.png")]);
  await expect(album.getByRole("alert")).toHaveText("The album is full.", { timeout: 15_000 });
});

// M6 ticket 03: a photo waiting for the host's approval takes its place under the limit, still 1.
test("with approval on, a guest's photo waiting for it takes the album's last place", async ({ browser }) => {
  test.slow();
  await operator.goto("/dashboard");
  await operator.getByRole("link", { name: /Second party/ }).click();
  await editSettings(operator, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Approve photos before they’re shown").check());
  const link = await eventLinkIn(operator);

  // The host's own photo goes, so the album has its one place again.
  await operator.goto(link);
  const album = operator.locator('[data-slot="album"]');
  await album.getByRole("button", { name: /^Photo 1 by / }).click();
  await operator.getByRole("dialog", { name: "Photo 1 of 1" }).getByRole("button", { name: "Delete" }).click();
  await operator.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(album).toContainText("No photos yet. Add the first.", { timeout: 15_000 });

  const guest = await reply(browser, link, "Priya Nair");
  await expect(guest.getByText("You’re going!")).toBeVisible();
  await closeReply(guest);
  const guestAlbum = guest.locator('[data-slot="album"]');
  const photo = async (name: string) => ({ name, mimeType: "image/png", buffer: await sharp({ create: { width: 40, height: 30, channels: 3, background: "#806040" } }).png().toBuffer() });
  await guestAlbum.getByLabel("Add photos").setInputFiles([await photo("one.png")]);
  await expect(guestAlbum.getByRole("status")).toHaveText("one.png: added, awaiting approval", { timeout: 15_000 });
  await guestAlbum.getByLabel("Add photos").setInputFiles([await photo("two.png")]);
  await expect(guestAlbum.getByRole("alert")).toHaveText("The album is full.", { timeout: 15_000 });

  // The host, whose photos need no approval, is refused the same.
  await operator.reload();
  await expect(album.getByText("Awaiting approval", { exact: true })).toBeVisible();
  await album.getByLabel("Add photos").setInputFiles([await photo("three.png")]);
  await expect(album.getByRole("alert")).toHaveText("The album is full.", { timeout: 15_000 });
  await guest.context().close();
});
