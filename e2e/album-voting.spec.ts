import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings, openMore, openSettings, savedAfter } from "./events";
import { signUpVerified } from "./hosts";
import { exec } from "./instances";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "./test";

// M8 ticket 10: the album vote, a module of its own (src/voting). The host starts it, closes it,
// reopens it and turns it off from the Voting block in the editor's Settings, below the album's;
// turning it off is confirmed with the number of votes it deletes. It cannot start before the
// album opens, at the start of the event.
//
// M8 ticket 11: the host chooses whether guests see who added each item: always, after voting
// closes (the default) or never. A hidden name is left out on the server, so neither the page's
// HTML nor the payload a refresh fetches carries it.
//
// M8 ticket 12: guests and hosts vote in the album. While voting is open each item a person may
// vote for wears a star; a tap gives their vote in Favourite, a tap on another item moves it, a tap
// on theirs takes it back. Guests see no count until voting closes, hosts see them live and close
// or reopen voting from a box of their own; once closed, every item shows its count and the top
// three wear ribbons. One address per test: at most three upload asks and ten votes a minute.

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

const photo = async (name: string, background: string) => ({
  name,
  mimeType: "image/jpeg",
  buffer: await sharp({ create: { width: 1200, height: 900, channels: 3, background } }).jpeg().toBuffer(),
});

// A guest adds photos in one ask and waits for the album to show `tiles` items.
async function addPhotos(page: Page, files: Parameters<Locator["setInputFiles"]>[0], tiles: number) {
  await album(page).getByLabel(/^Add photos/).setInputFiles(files);
  await expect(album(page).locator("li[data-item]")).toHaveCount(tiles, { timeout: 20_000 });
}

// A guest adds one photo and waits for its tile.
async function addPhoto(page: Page, file?: string) {
  await addPhotos(page, file ?? [await photo("garden.jpg", "#2f6b3a")], 1);
  await expect(album(page).getByRole("button", { name: /^Photo 1 by / })).toBeVisible({ timeout: 15_000 });
}

// The page as its HTML is sent, and the payload the router fetches when the page is refreshed.
async function sent(page: Page, link: string): Promise<{ html: string; refreshed: string }> {
  const html = await (await page.request.get(link)).text();
  const response = await page.request.get(link, { headers: { RSC: "1" } });
  expect(response.headers()["content-type"]).toContain("text/x-component");
  return { html, refreshed: await response.text() };
}

// The uploader in the tests of names left out: a name no page carries otherwise, unlike the RSVP
// form's example name, "e.g. Priya Nair".
const UPLOADER = "Wren Abernethy-Quill";
// photo-exif.jpg's camera, as the item's details write it (album-details.spec.ts).
const EXIF_PHOTO = "e2e/fixtures/photo-exif.jpg";
const CAMERA = "iPhone 15 Pro";
const KEEP_CAMERA = "Keep the camera and its settings";

// The id of the reply a guest sent to the event at `link`, read from the database.
function rsvpIdOf(link: string, name: string): string {
  const slug = new URL(link, "http://localhost").pathname.split("/").pop()!;
  if (!/^[A-Za-z0-9]+$/.test(slug)) throw new Error(`not a slug: ${slug}`);
  const query = `select r.id from rsvp r join event e on e.id = r.event_id where e.slug = '${slug}' and r.name = '${name.replaceAll("'", "''")}'`;
  const id = exec("db", "psql", "-U", "openinvites", "-d", "openinvites", "-At", "-c", query).trim();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return id;
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
  // The album is the only place on the page a guest's name could be. The host keeps each item's
  // camera, which is left out with the name (M8 ticket 12).
  await editSettings(host.page, async (sheet) => {
    await sheet.getByLabel("Who can see the guest list").selectOption("hidden");
    await sheet.getByLabel("Comments", { exact: true }).uncheck();
    await sheet.getByRole("group", { name: "Album", exact: true }).getByLabel(KEEP_CAMERA).check();
  });

  const uploader = await guestGoing(browser, host.link, UPLOADER);
  await addPhoto(uploader, EXIF_PHOTO);
  const theirs = rsvpIdOf(host.link, UPLOADER);
  const block = votingBlock(await openSettings(host.page));
  await press(host.page, block, "Start voting", "open");

  // Ana sees the photo, and nothing of who added it: not on the tile, not in the viewer, not in
  // what the page sends; nor the camera that took it, while its exposure stays.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(album(ana).getByRole("button", { name: "Photo 1", exact: true })).toBeVisible();
  await album(ana).getByRole("button", { name: "Photo 1", exact: true }).click();
  const viewer = ana.getByRole("dialog", { name: "Photo 1 of 1" });
  await expect(viewer).toBeVisible();
  await expect(viewer).not.toContainText("Added by");
  await expect(viewer).toHaveAccessibleDescription("");
  await expect(viewer.locator('[data-slot="item-details"]')).toContainText("ISO 80");
  await expect(viewer.locator('[data-slot="item-details"]')).not.toContainText(CAMERA);
  await expectNoSeriousViolations(ana, "the viewer with the uploader's name left out");
  await ana.keyboard.press("Escape");
  const thumb = await album(ana).getByRole("button", { name: "Photo 1", exact: true }).locator("img").getAttribute("src");
  const anas = await sent(ana, host.link);
  expect(anas.html).toContain("Ana Ruiz");
  expect(anas.refreshed).toContain(thumb);
  for (const text of [anas.html, anas.refreshed]) {
    expect(text).not.toContain(UPLOADER);
    expect(text).not.toContain(theirs);
    expect(text).not.toContain(CAMERA);
  }

  // The uploader sees their own name, and so does the host, whose page carries it and the camera:
  // the checks above can fail.
  await uploader.reload();
  await expect(album(uploader).getByRole("button", { name: `Photo 1 by ${UPLOADER}`, exact: true })).toBeVisible();
  await host.page.goto(host.link);
  await expect(album(host.page).getByRole("button", { name: `Photo 1 by ${UPLOADER}`, exact: true })).toBeVisible();
  const hosts = await sent(host.page, host.link);
  for (const text of [hosts.html, hosts.refreshed]) {
    expect(text).toContain(UPLOADER);
    expect(text).toContain(CAMERA);
  }

  // Closed, the vote shows Ana the names again, and the camera with them.
  await host.page.goto(editor);
  await press(host.page, votingBlock(await openSettings(host.page)), "Close voting", "closed");
  await ana.reload();
  await expect(album(ana).getByRole("button", { name: `Photo 1 by ${UPLOADER}`, exact: true })).toBeVisible();
  expect((await sent(ana, host.link)).html).toContain(CAMERA);
  await Promise.all([host.context.close(), uploader.context().close(), ana.context().close()]);
});

test("Never keeps names from guests whatever the vote, and Always shows them while it is open", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-names-choice", PAST);
  // The album is the only place on the page a guest's name could be.
  await editSettings(host.page, async (sheet) => {
    await sheet.getByLabel("Who can see the guest list").selectOption("hidden");
    await sheet.getByLabel("Comments", { exact: true }).uncheck();
  });
  const uploader = await guestGoing(browser, host.link, UPLOADER);
  await addPhoto(uploader);
  const theirs = rsvpIdOf(host.link, UPLOADER);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(album(ana).getByRole("button", { name: `Photo 1 by ${UPLOADER}`, exact: true })).toBeVisible();

  // The choice is in the Voting block whatever the vote's state, with its hint.
  const names = votingBlock(await openSettings(host.page)).getByRole("group", { name: "Who added each item" });
  await expect(names).toHaveAccessibleDescription("Hosts and the person who added an item always see who did.");
  await expect(names.getByLabel("Shown after voting closes")).toBeChecked();
  await savedAfter(host.page, () => names.getByLabel("Never shown to guests").check());
  await ana.reload();
  await expect(album(ana).getByRole("button", { name: "Photo 1", exact: true })).toBeVisible();
  // Left out on the server, as while voting is open.
  const anas = await sent(ana, host.link);
  expect(anas.html).toContain("Ana Ruiz");
  for (const text of [anas.html, anas.refreshed]) {
    expect(text).not.toContain(UPLOADER);
    expect(text).not.toContain(theirs);
  }
  // The uploader's own photo keeps their name.
  await uploader.reload();
  await expect(album(uploader).getByRole("button", { name: `Photo 1 by ${UPLOADER}`, exact: true })).toBeVisible();

  // The choice is the event's: there after a reload.
  await host.page.reload();
  const again = votingBlock(await openSettings(host.page));
  await expect(again.getByLabel("Never shown to guests")).toBeChecked();
  await savedAfter(host.page, () => again.getByLabel("Always shown").check());
  await press(host.page, again, "Start voting", "open");
  await ana.reload();
  await expect(album(ana).getByRole("button", { name: `Photo 1 by ${UPLOADER}`, exact: true })).toBeVisible();
  await Promise.all([host.context.close(), uploader.context().close(), ana.context().close()]);
});

// M8 ticket 12: voting in the album.

const head = (page: Page) => album(page).locator('[data-slot="album-voting"]');
const hostsBox = (page: Page) => album(page).locator('[data-slot="voting-hosts"]');
const stars = (page: Page) => album(page).locator('[data-slot="vote-star"]');
const star = (page: Page, name: string) => album(page).getByRole("button", { name: `Vote for ${name}`, exact: true });
// An item's tile, by the start of its thumbnail's name ("Photo 3", "Photo 3 by Mei Tan").
const tile = (page: Page, name: string) => album(page).locator("li[data-item]").filter({ has: page.getByRole("button", { name: new RegExp(`^${name}( by |$)`) }) });
const count = (page: Page, name: string) => tile(page, name).locator('[data-slot="vote-count"]');

const TAP_TO_VOTE = "Tap a star to vote in Favourite.";
const YOUR_VOTE = "Your vote in Favourite is in. Tap another star to move it, or yours to take it back.";

// A press of a star, and the answer of its action, whose headers come once the vote is stored.
// The page it redraws streams after them, and the body's end is not waited for: Chromium does not
// always report it for a response read as a stream.
async function vote(page: Page, button: Locator) {
  const answered = page.waitForResponse((response) => response.request().method() === "POST" && response.request().headers()["next-action"] !== undefined);
  await button.click();
  await answered;
}

// The host starts voting from the editor's Settings, which stay open on the Voting block.
async function startVoting(page: Page): Promise<Locator> {
  const block = votingBlock(await openSettings(page));
  await press(page, block, "Start voting", "open");
  return block;
}

test("a guest votes, moves the vote and takes it back, and sees counts only once voting closes", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")], 2);
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  await addPhotos(mei, [await photo("lake.jpg", "#3a6bd0")], 3);
  await startVoting(host.page);

  // Ana, Going, is told what a star does, and every item has one.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(head(ana)).toContainText("Voting is open");
  await expect(head(ana)).toContainText("Counts stay hidden until voting closes.");
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);
  await expect(stars(ana)).toHaveCount(3);
  await expect(album(ana).locator('[data-slot="vote-count"]')).toHaveCount(0);
  await expectNoSeriousViolations(ana, "a guest's album while voting is open");

  await vote(ana, star(ana, "Photo 1"));
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "true");
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);
  // Another star moves the vote.
  await vote(ana, star(ana, "Photo 2"));
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");
  await expect(star(ana, "Photo 2")).toHaveAttribute("aria-pressed", "true");
  await ana.reload();
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");
  await expect(star(ana, "Photo 2")).toHaveAttribute("aria-pressed", "true");
  // The same star again takes it back.
  await vote(ana, star(ana, "Photo 2"));
  await expect(stars(ana).and(album(ana).locator('[aria-pressed="true"]'))).toHaveCount(0);
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);
  await vote(ana, star(ana, "Photo 3"));
  await expect(star(ana, "Photo 3")).toHaveAttribute("aria-pressed", "true");

  // Nobody votes for their own: Priya's page has one star, on Mei's photo.
  await priya.reload();
  await expect(stars(priya)).toHaveCount(1);
  await expect(star(priya, "Photo 3")).toBeVisible();

  // The counts are left out of a guest's page, and sent to the host's, who sees them live.
  expect(await (await ana.request.get(host.link)).text()).not.toContain("shownVotes");
  expect(await (await host.page.request.get(host.link)).text()).toContain("shownVotes");
  await host.page.goto(host.link);
  await expect(count(host.page, "Photo 3")).toHaveAccessibleName("1 vote");
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("0 votes");
  await expect(hostsBox(host.page)).toContainText("Hosts only");
  await expect(hostsBox(host.page)).toContainText("1 vote so far in Favourite");
  await expect(album(host.page).locator('[data-slot="vote-ribbon"]')).toHaveCount(0);
  await expectNoSeriousViolations(host.page, "the host's album while voting is open");

  await hostsBox(host.page).getByRole("button", { name: "Close voting" }).click();
  await expect(head(host.page)).toContainText("Voting closed");
  await expect(hostsBox(host.page).getByRole("button", { name: "Reopen voting" })).toBeVisible();

  // Closed: no star, every count, and the ribbon on the first.
  await ana.reload();
  await expect(head(ana)).toContainText("Voting closed");
  await expect(stars(ana)).toHaveCount(0);
  await expect(count(ana, "Photo 3")).toHaveAccessibleName("1 vote");
  await expect(count(ana, "Photo 1")).toHaveAccessibleName("0 votes");
  await expect(count(ana, "Photo 2")).toHaveAccessibleName("0 votes");
  await expect(tile(ana, "Photo 3").locator('[data-slot="vote-ribbon"]')).toHaveText("1st");
  await expect(album(ana).locator('[data-slot="vote-ribbon"]')).toHaveCount(1);
  await expectNoSeriousViolations(ana, "a guest's album once voting is closed");
  await Promise.all([host.context.close(), priya.context().close(), mei.context().close(), ana.context().close()]);
});

test("a pending item takes no vote, and a host votes but not for their own", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-pending", PAST);
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Approve photos before they’re shown").check());
  const editor = host.page.url();
  await host.page.goto(host.link);
  await addPhotos(host.page, [await photo("toast.jpg", "#e0b040")], 1);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a")], 2);
  await host.page.goto(editor);
  await startVoting(host.page);

  // The host's own photo and Priya's, waiting, have no star.
  await host.page.goto(host.link);
  await expect(head(host.page)).toContainText("Voting is open");
  await expect(stars(host.page)).toHaveCount(0);
  await expect(tile(host.page, "Photo 2")).toContainText("Awaiting approval");

  // Approved, it has one, and the host's vote shows to the host as a count of 1.
  await tile(host.page, "Photo 2").getByRole("button", { name: /^Approve photo 2 by Priya Nair/ }).click();
  await expect(star(host.page, "Photo 2 by Priya Nair")).toBeVisible();
  await expect(stars(host.page)).toHaveCount(1);
  await vote(host.page, star(host.page, "Photo 2 by Priya Nair"));
  await expect(star(host.page, "Photo 2 by Priya Nair")).toHaveAttribute("aria-pressed", "true");
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("1 vote");
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("0 votes");
  await Promise.all([host.context.close(), priya.context().close()]);
});

test("a vote from a page left open after the host closes voting is refused", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-late", PAST);
  const editor = host.page.url();
  await host.page.goto(host.link);
  await addPhotos(host.page, [await photo("toast.jpg", "#e0b040")], 1);
  await host.page.goto(editor);
  const block = await startVoting(host.page);

  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");
  await press(host.page, block, "Close voting", "closed");

  await vote(ana, star(ana, "Photo 1"));
  await expect(head(ana).getByRole("alert")).toHaveText("Voting has closed.");
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");
  await Promise.all([host.context.close(), ana.context().close()]);
});

test("turning voting off says how many votes go", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-off", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")], 2);
  await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, star(ana, "Photo 1"));
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  await vote(mei, star(mei, "Photo 2"));

  await host.page.reload();
  const block = votingBlock(await openSettings(host.page));
  await block.getByRole("button", { name: "Turn off voting" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Turn off voting?" });
  await expect(confirm).toContainText("Its 2 votes are deleted.");
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Turn it off" }).click());
  await expect(block).toHaveAttribute("data-state", "off");

  // Started again, every count is 0.
  await press(host.page, block, "Start voting", "open");
  await host.page.goto(host.link);
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("0 votes");
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("0 votes");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close(), mei.context().close()]);
});

// The owner's co-host link from the event's Hosts page (co-hosts.spec.ts), accepted by `coHost`.
async function addCoHost(owner: Page, editor: string, coHost: Page) {
  await owner.goto(editor);
  await openMore(owner);
  await owner.getByRole("link", { name: "Hosts", exact: true }).click();
  await owner.getByRole("button", { name: "Make a co-host link" }).click();
  const link = owner.getByRole("textbox", { name: "Co-host link" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await coHost.goto(await link.inputValue());
  await coHost.getByRole("button", { name: "Accept" }).click();
  await expect(coHost).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
}

async function signedUpHost(browser: Browser, request: APIRequestContext): Promise<{ page: Page; name: string }> {
  const page = await (await browser.newContext()).newPage();
  const { name } = await signUpVerified(page, request, "album-vote-co-host");
  return { page, name };
}

test("a co-host's vote is counted only while they host the event, and again once added back", async ({ browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "album-vote-owner", PAST);
  const editor = owner.page.url();
  const priya = await guestGoing(browser, owner.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a")], 1);
  await startVoting(owner.page);
  const coHost = await signedUpHost(browser, request);
  await addCoHost(owner.page, editor, coHost.page);

  await coHost.page.goto(owner.link);
  await vote(coHost.page, star(coHost.page, "Photo 1 by Priya Nair"));
  await owner.page.goto(owner.link);
  await expect(count(owner.page, "Photo 1")).toHaveAccessibleName("1 vote");

  // Removed, the co-host's vote is not counted; its row stays.
  await owner.page.goto(`${editor}/hosts`);
  await owner.page.getByRole("listitem").filter({ hasText: coHost.name }).getByRole("button", { name: "Remove" }).click();
  await owner.page.getByRole("alertdialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(owner.page.getByText(coHost.name)).toHaveCount(0);
  await owner.page.goto(owner.link);
  await expect(count(owner.page, "Photo 1")).toHaveAccessibleName("0 votes");

  // Added back, it counts again.
  await addCoHost(owner.page, editor, coHost.page);
  await owner.page.goto(owner.link);
  await expect(count(owner.page, "Photo 1")).toHaveAccessibleName("1 vote");
  await Promise.all([owner.context.close(), priya.context().close(), coHost.page.context().close()]);
});
