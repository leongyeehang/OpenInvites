import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings, openSettings, savedAfter } from "./events";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type Browser, type Locator, type Page } from "./test";

// M8 ticket 10: the album vote, a module of its own (src/voting). The host starts it, closes it,
// reopens it and turns it off from the Voting block in the editor's Settings, below the album's;
// turning it off is confirmed with the number of votes it deletes. It cannot start before the
// album opens, at the start of the event.
//
// M8 ticket 11: the host chooses whether guests see who added each item: always, after voting
// closes (the default) or never. A hidden name is left out on the server, so neither the page's
// HTML nor the payload a refresh fetches carries it.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const AHEAD = { title: "Ada’s garden party", start: "2027-11-20T16:00", plusOnes: "0" };

const votingBlock = (sheet: Locator) => sheet.locator('[data-slot="voting-block"]');

// A guest of their own who answers Going and comes back to the page.
async function guestGoing(browser: Browser, link: string, name: string): Promise<Page> {
  const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await closeReply(page);
  return page;
}

const album = (page: Page) => page.locator('[data-slot="album"]');

// A guest adds one photo and waits for its tile.
async function addPhoto(page: Page) {
  const buffer = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#2f6b3a" } }).jpeg().toBuffer();
  await album(page).getByLabel(/^Add photos/).setInputFiles([{ name: "garden.jpg", mimeType: "image/jpeg", buffer }]);
  await expect(album(page).getByRole("status")).toContainText("garden.jpg: added", { timeout: 20_000 });
  await expect(album(page).getByRole("button", { name: /^Photo 1 by / })).toBeVisible({ timeout: 15_000 });
}

// The page as its HTML is sent, and the payload the router fetches when the page is refreshed,
// each without the RSVP form's example name ("e.g. Priya Nair"), which every page carries.
async function sent(page: Page, link: string): Promise<{ html: string; refreshed: string }> {
  const html = await (await page.request.get(link)).text();
  const response = await page.request.get(link, { headers: { RSC: "1" } });
  expect(response.headers()["content-type"]).toContain("text/x-component");
  const withoutExample = (text: string) => text.replaceAll("e.g. Priya Nair", "");
  return { html: withoutExample(html), refreshed: withoutExample(await response.text()) };
}

// A press in the block, saved through the editor's save status, and the state it leaves.
async function press(page: Page, block: Locator, name: string, state: "off" | "open" | "closed") {
  await savedAfter(page, () => block.getByRole("button", { name, exact: true }).click());
  await expect(block).toHaveAttribute("data-state", state);
}

test("the host starts, closes, reopens and turns off the album vote from Settings", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-voting", PAST);
  const sheet = await openSettings(host.page);
  const block = votingBlock(sheet);
  await expect(sheet.getByRole("group", { name: "Voting", exact: true })).toHaveAttribute("data-slot", "voting-block");
  await expect(block).toHaveAttribute("data-state", "off");
  await expect(block).toContainText("Guests pick their favourite photos and videos. Each person has one vote in each award.");

  await press(host.page, block, "Start voting", "open");
  await expect(block).toContainText("Voting is open");
  await expectNoSeriousViolations(host.page, "the Settings sheet with the vote open");

  await press(host.page, block, "Close voting", "closed");
  await expect(block).toContainText("Voting closed");

  await press(host.page, block, "Reopen voting", "open");
  await expect(block).toContainText("Voting is open");

  // Turn off asks first, giving the number of votes it deletes; Never mind keeps the vote.
  await block.getByRole("button", { name: "Turn off voting" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Turn off voting?" });
  await expect(confirm).toContainText("Nobody has voted yet. The awards and settings stay.");
  await confirm.getByRole("button", { name: "Never mind" }).click();
  await expect(confirm).toBeHidden();
  await expect(block).toHaveAttribute("data-state", "open");

  await block.getByRole("button", { name: "Turn off voting" }).click();
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Turn it off" }).click());
  await expect(confirm).toBeHidden();
  await expect(block).toHaveAttribute("data-state", "off");
  await expect(block.getByRole("button", { name: "Start voting" })).toBeEnabled();

  // The vote's state is the event's, not the sheet's: it is there after a reload.
  await press(host.page, block, "Start voting", "open");
  await host.page.reload();
  await expect(votingBlock(await openSettings(host.page))).toHaveAttribute("data-state", "open");
  await host.context.close();
});

test("voting cannot start before the album opens", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-voting-ahead", AHEAD);
  const block = votingBlock(await openSettings(host.page));
  await expect(block).toHaveAttribute("data-state", "off");
  const start = block.getByRole("button", { name: "Start voting" });
  await expect(start).toBeDisabled();
  await expect(start).toHaveAccessibleDescription("Voting can start once the album opens, at the start of the event.");
  await host.context.close();
});

test("while voting is open a guest's page leaves out who added each item, and the names come back when it closes", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-names", PAST);
  const editor = host.page.url();
  // The album is the only place on the page a guest's name could be.
  await editSettings(host.page, async (sheet) => {
    await sheet.getByLabel("Who can see the guest list").selectOption("hidden");
    await sheet.getByLabel("Comments", { exact: true }).uncheck();
  });

  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhoto(priya);
  const block = votingBlock(await openSettings(host.page));
  await press(host.page, block, "Start voting", "open");

  // Ana sees the photo, and nothing of who added it: not on the tile, not in the viewer, not in
  // what the page sends.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(album(ana).getByRole("button", { name: "Photo 1", exact: true })).toBeVisible();
  await album(ana).getByRole("button", { name: "Photo 1", exact: true }).click();
  const viewer = ana.getByRole("dialog", { name: "Photo 1 of 1" });
  await expect(viewer).toBeVisible();
  await expect(viewer).not.toContainText("Added by");
  await expect(viewer).toHaveAccessibleDescription("");
  await expectNoSeriousViolations(ana, "the viewer with the uploader's name left out");
  await ana.keyboard.press("Escape");
  const thumb = await album(ana).getByRole("button", { name: "Photo 1", exact: true }).locator("img").getAttribute("src");
  const anas = await sent(ana, host.link);
  expect(anas.html).toContain("Ana Ruiz");
  expect(anas.refreshed).toContain(thumb);
  expect(anas.html).not.toContain("Priya Nair");
  expect(anas.refreshed).not.toContain("Priya Nair");

  // Priya sees her own name, and so does the host, whose page carries it: the check above can fail.
  await priya.reload();
  await expect(album(priya).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true })).toBeVisible();
  await host.page.goto(host.link);
  await expect(album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true })).toBeVisible();
  const hosts = await sent(host.page, host.link);
  expect(hosts.html).toContain("Priya Nair");
  expect(hosts.refreshed).toContain("Priya Nair");

  // Closed, the vote shows Ana the names again.
  await host.page.goto(editor);
  await press(host.page, votingBlock(await openSettings(host.page)), "Close voting", "closed");
  await ana.reload();
  await expect(album(ana).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true })).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

test("Never keeps names from guests whatever the vote, and Always shows them while it is open", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-names-choice", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhoto(priya);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(album(ana).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true })).toBeVisible();

  // The choice is in the Voting block whatever the vote's state, with its hint.
  const names = votingBlock(await openSettings(host.page)).getByRole("group", { name: "Who added each item" });
  await expect(names).toHaveAccessibleDescription("Hosts and the person who added an item always see who did.");
  await expect(names.getByLabel("Shown after voting closes")).toBeChecked();
  await savedAfter(host.page, () => names.getByLabel("Never shown to guests").check());
  await ana.reload();
  await expect(album(ana).getByRole("button", { name: "Photo 1", exact: true })).toBeVisible();
  // Priya's own photo keeps her name.
  await priya.reload();
  await expect(album(priya).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true })).toBeVisible();

  // The choice is the event's: there after a reload.
  await host.page.reload();
  const again = votingBlock(await openSettings(host.page));
  await expect(again.getByLabel("Never shown to guests")).toBeChecked();
  await savedAfter(host.page, () => again.getByLabel("Always shown").check());
  await press(host.page, again, "Start voting", "open");
  await ana.reload();
  await expect(album(ana).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true })).toBeVisible();
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});
