import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createPublished, editSettings, openMore, openSettings, savedAfter, saveStatus, setWhen, utcFromNow } from "./events";
import { signUpVerified } from "./hosts";
import { exec } from "./instances";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type Locator, type Page, type Route } from "./test";

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
//
// M8 ticket 13: the host names the awards in the Voting block, up to eight, each for photos,
// videos or both; guests pick an award above the album and have one vote in each. An award for
// photos only or videos only shows only those items.
//
// M8 ticket 14: the host says who may vote (everyone who sees the album, only guests who are
// going, or only guests invited personally) and may set a time at which voting closes by itself,
// with nothing running then: the pages and the vote read it closed once it has come. Starting a
// vote offers "Tell guests voting is open", the Announcements page with the message written.
//
// M8 ticket 15: once voting has closed, a first place shared can go to a tie-break among the tied
// items, started and closed by the hosts from their box above the album; guests vote again among
// those items only, with the counts hidden from them until it closes.
//
// M8 ticket 16: once voting closes, a Winners strip heads the album with the chosen award's top
// three, and the hosts may send the winners to guests with a message already written. While an
// award is voted in, each guest sees the album in an order of their own, stable across visits:
// their numbers follow it, so these tests find an item by its thumbnail's address where a guest
// votes in more than one item.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const AHEAD = { title: "Ada’s garden party", start: "2027-11-20T16:00", plusOnes: "0" };

const votingBlock = (sheet: Locator) => sheet.locator('[data-slot="voting-block"]');

// A guest of their own who answers, through the event link or their personal invite link, and
// comes back to the page.
async function guestAnswers(browser: Browser, link: string, name: string, status: "Going" | "Maybe"): Promise<Page> {
  const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await page.goto(link);
  await page.getByRole("button", { name: status, exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(status === "Going" ? "You’re going!" : "You’re a maybe.")).toBeVisible({ timeout: 15_000 });
  await closeReply(page);
  return page;
}

const guestGoing = (browser: Browser, link: string, name: string) => guestAnswers(browser, link, name, "Going");

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
  // About 20 s alone, so the default 30 s ran out once beside the other voting tests.
  test.slow();
  const host = await createPublished(browser, request, "album-voting", PAST);
  const sheet = await openSettings(host.page);
  const block = votingBlock(sheet);
  // Named "Album voting", so that it cannot be taken for the date poll's block (review fix).
  await expect(sheet.getByRole("group", { name: "Album voting", exact: true })).toHaveAttribute("data-slot", "voting-block");
  await expect(block).toHaveAttribute("data-state", "off");
  await expect(block).toContainText("Guests pick their favourite photos and videos. Each person has one vote in each award.");
  await expectNoSeriousViolations(host.page, "the Settings sheet with the vote off, its award rows shown");

  await press(host.page, block, "Start voting", "open");
  await expect(block).toContainText("Voting is open");
  await expectNoSeriousViolations(host.page, "the Settings sheet with the vote open");

  await press(host.page, block, "Close voting", "closed");
  await expect(block).toContainText("Voting closed");
  await expectNoSeriousViolations(host.page, "the Settings sheet with the vote closed");

  await press(host.page, block, "Reopen voting", "open");
  await expect(block).toContainText("Voting is open");

  // Turn off asks first, giving the number of votes it deletes; Never mind keeps the vote.
  await block.getByRole("button", { name: "Turn off voting" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Turn off voting?" });
  await expect(confirm).toContainText("Nobody has voted yet. The awards and settings stay.");
  await expectNoSeriousViolations(host.page, "the Turn off voting confirmation");
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
  // Left out on the server, as while voting is open; each text holds what the page shows, so the
  // checks cannot pass on an empty or redirected answer.
  const thumb = await album(ana).getByRole("button", { name: "Photo 1", exact: true }).locator("img").getAttribute("src");
  const anas = await sent(ana, host.link);
  expect(anas.html).toContain("Ana Ruiz");
  expect(anas.refreshed).toContain(thumb);
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
// The album's thumbnails' addresses in the order this page lists them, and an item's tile and star
// by its thumbnail's address: an item's own, whatever number a guest's order gives it (ticket 16).
const order = (page: Page) => album(page).locator("li[data-item] img").evaluateAll((pictures) => pictures.map((picture) => picture.getAttribute("src")!));
const tileOf = (page: Page, src: string) => album(page).locator("li[data-item]").filter({ has: page.locator(`img[src="${src}"]`) });
const starOf = (page: Page, src: string) => tileOf(page, src).locator('[data-slot="vote-star"]');

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
  // The items in the order added, which the album keeps before the vote and once it closes.
  const [first, second, third] = await order(mei);
  await startVoting(host.page);

  // Ana, Going, is told what a star does, and every item has one.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(head(ana)).toContainText("Voting is open");
  await expect(head(ana)).toContainText("Counts stay hidden until voting closes.");
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);
  await expect(stars(ana)).toHaveCount(3);
  await expect(album(ana).locator('[data-slot="vote-count"]')).toHaveCount(0);
  // One award, for everything, lists the whole album: no picker, and no Whole album to choose.
  await expect(head(ana).locator('[data-slot="award-picker"]')).toHaveCount(0);
  await expectNoSeriousViolations(ana, "a guest's album while voting is open");

  await vote(ana, starOf(ana, first));
  await expect(starOf(ana, first)).toHaveAttribute("aria-pressed", "true");
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);
  // Another star moves the vote.
  await vote(ana, starOf(ana, second));
  await expect(starOf(ana, first)).toHaveAttribute("aria-pressed", "false");
  await expect(starOf(ana, second)).toHaveAttribute("aria-pressed", "true");
  await ana.reload();
  await expect(starOf(ana, first)).toHaveAttribute("aria-pressed", "false");
  await expect(starOf(ana, second)).toHaveAttribute("aria-pressed", "true");
  // The same star again takes it back.
  await vote(ana, starOf(ana, second));
  await expect(stars(ana).and(album(ana).locator('[aria-pressed="true"]'))).toHaveCount(0);
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);
  await vote(ana, starOf(ana, third));
  await expect(starOf(ana, third)).toHaveAttribute("aria-pressed", "true");

  // Nobody votes for their own: Priya's page has one star, on Mei's photo.
  await priya.reload();
  await expect(stars(priya)).toHaveCount(1);
  await expect(starOf(priya, third)).toBeVisible();

  // The counts are left out of a guest's page, and sent to the host's, who sees them live. The
  // guest's page is checked to hold the head, so the check cannot pass on an empty answer.
  const anas = await (await ana.request.get(host.link)).text();
  expect(anas).toContain("Counts stay hidden until voting closes.");
  expect(anas).not.toContain("shownVotes");
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

// Review fix: a star shows the page's vote once the page is drawn again, so a vote the site no
// longer holds is never shown, though the guest pressed nothing since.
test("a vote taken away by the host is not shown once the guest's page is drawn again, without a reload", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-gone", PAST);
  const editor = host.page.url();
  await host.page.goto(host.link);
  await addPhotos(host.page, [await photo("toast.jpg", "#e0b040")], 1);
  await host.page.goto(editor);
  const block = await startVoting(host.page);

  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, star(ana, "Photo 1"));
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);

  // The host turns voting off, which deletes the vote, and starts it again.
  await block.getByRole("button", { name: "Turn off voting" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Turn off voting?" });
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Turn it off" }).click());
  await expect(block).toHaveAttribute("data-state", "off");
  await press(host.page, block, "Start voting", "open");

  // Ana's page is drawn again by her comment, and shows no vote.
  const box = ana.getByLabel("Add a comment");
  await box.fill("Lovely toast!");
  await ana.getByRole("button", { name: "Post", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });
  await expect(ana.getByRole("listitem").filter({ hasText: "Lovely toast!" })).toBeVisible();
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);
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
  const confirm = host.page.getByRole("alertdialog", { name: "Turn off voting?" });
  const turnItOff = confirm.getByRole("button", { name: "Turn it off" });

  // Review fix (ticket 14): while the count is being read, the confirmation gives no figure and
  // cannot be confirmed; it can once the count is in.
  let answer = () => {};
  const held = new Promise<void>((resolve) => (answer = resolve));
  await host.page.route("**/*", async (route) => {
    if (isAction(route)) await held;
    await route.fallback();
  });
  await block.getByRole("button", { name: "Turn off voting" }).click();
  await expect(confirm).toContainText("Counting the votes…");
  await expect(turnItOff).toBeDisabled();
  answer();
  await expect(turnItOff).toBeEnabled();
  await expect(confirm).toContainText("Its 2 votes are deleted.");
  await confirm.getByRole("button", { name: "Never mind" }).click();
  await host.page.unrouteAll({ behavior: "wait" });

  // A count that cannot be read is said so, and leaves only Never mind.
  await host.page.route("**/*", (route) => (isAction(route) ? route.abort() : route.fallback()));
  await block.getByRole("button", { name: "Turn off voting" }).click();
  await expect(confirm).toContainText("The votes couldn’t be counted. Close this and try again.");
  await expect(turnItOff).toBeDisabled();
  await confirm.getByRole("button", { name: "Never mind" }).click();
  await expect(confirm).toBeHidden();
  await host.page.unrouteAll({ behavior: "wait" });

  await block.getByRole("button", { name: "Turn off voting" }).click();
  await expect(turnItOff).toBeEnabled();
  await expect(confirm).toContainText("Its 2 votes are deleted.");
  await savedAfter(host.page, () => turnItOff.click());
  await expect(block).toHaveAttribute("data-state", "off");

  // Started again, every count is 0.
  await press(host.page, block, "Start voting", "open");
  await host.page.goto(host.link);
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("0 votes");
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("0 votes");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close(), mei.context().close()]);
});

// A request to a server action, as a press in the editor sends one.
const isAction = (route: Route) => route.request().method() === "POST" && route.request().headers()["next-action"] !== undefined;

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

// M8 ticket 13: the host names the awards, each for photos, videos or both, and guests vote in
// each; an award for photos only or videos only shows only those items.

const awardsBlock = (sheet: Locator) => votingBlock(sheet).getByRole("group", { name: "Awards", exact: true });
// The awards' names in the block, in their order.
const awardNames = (awards: Locator) => () => awards.getByRole("textbox", { name: /^Name of / }).evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
const picker = (page: Page) => head(page).getByRole("group", { name: "Awards", exact: true });
const pill = (page: Page, name: string) => picker(page).getByRole("button", { name, exact: true });
const items = (page: Page) => album(page).locator("li[data-item]");
const H264 = "e2e/fixtures/clip-h264.mp4";

// The host renames an award in the block, finished with Enter.
async function renameAward(page: Page, awards: Locator, from: string, to: string) {
  await savedAfter(page, async () => {
    const field = awards.getByLabel(`Name of ${from}`, { exact: true });
    await field.fill(to);
    await field.press("Enter");
  });
  await expect(awards.getByLabel(`Name of ${to}`, { exact: true })).toHaveValue(to);
}

// Priya, Going, adds a photo and then a video, and waits for the video to be ready (as
// album-video.spec.ts does).
async function photoAndVideo(browser: Browser, link: string): Promise<Page> {
  const priya = await guestGoing(browser, link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a")], 1);
  await album(priya).getByLabel(/^Add photos/).setInputFiles(H264);
  await expect(album(priya).locator('li[data-item="video"][data-state="ready"]')).toBeVisible({ timeout: 60_000 });
  return priya;
}

test("the host adds, renames, orders and removes awards in Settings", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-awards", AHEAD);
  const sheet = await openSettings(host.page);
  const awards = awardsBlock(sheet);
  await expect(awards).toHaveAccessibleDescription("Each person gets one vote in every award.");
  await expect.poll(awardNames(awards)).toEqual(["Favourite"]);
  await expect(awards.getByLabel("What Favourite is for")).toHaveValue("all");

  // A suggestion adds itself with what it is for, and its chip goes.
  await savedAfter(host.page, () => awards.getByRole("button", { name: "Best photo", exact: true }).click());
  await expect.poll(awardNames(awards)).toEqual(["Favourite", "Best photo"]);
  await expect(awards.getByLabel("What Best photo is for")).toHaveValue("photos");
  await expect(awards.getByRole("button", { name: "Best photo", exact: true })).toHaveCount(0);

  await awards.getByLabel("Your own award").fill("Best dressed");
  await savedAfter(host.page, () => awards.getByRole("button", { name: "Add", exact: true }).click());
  await expect.poll(awardNames(awards)).toEqual(["Favourite", "Best photo", "Best dressed"]);
  await expect(awards.getByLabel("Your own award")).toHaveValue("");
  await expect(awards.getByLabel("What Best dressed is for")).toHaveValue("all");

  await renameAward(host.page, awards, "Favourite", "Crowd favourite");

  // Moving says where the award is now, and keeps the focus on its button.
  await expect(awards.getByRole("button", { name: "Move Crowd favourite up" })).toBeDisabled();
  await expect(awards.getByRole("button", { name: "Move Best dressed down" })).toBeDisabled();
  await savedAfter(host.page, () => awards.getByRole("button", { name: "Move Best dressed up" }).click());
  await expect(awards.getByRole("status")).toHaveText("Best dressed is now 2 of 3.");
  await expect.poll(awardNames(awards)).toEqual(["Crowd favourite", "Best dressed", "Best photo"]);
  await expect(awards.getByRole("button", { name: "Move Best dressed up" })).toBeFocused();

  // Removing asks first, with what goes with it.
  await awards.getByRole("button", { name: "Remove Best photo" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Remove Best photo?" });
  await expect(confirm).toContainText("Nobody has voted in it yet.");
  await expectNoSeriousViolations(host.page, "the Voting block with an award's removal to confirm");
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Remove it" }).click());
  await expect(confirm).toBeHidden();
  await expect.poll(awardNames(awards)).toEqual(["Crowd favourite", "Best dressed"]);
  await expect(awards.getByRole("button", { name: "Best photo", exact: true })).toBeVisible();

  // The awards are the event's: there after a reload. The last one cannot be removed.
  await host.page.reload();
  const again = awardsBlock(await openSettings(host.page));
  await expect.poll(awardNames(again)).toEqual(["Crowd favourite", "Best dressed"]);
  await again.getByRole("button", { name: "Remove Best dressed" }).click();
  await savedAfter(host.page, () => host.page.getByRole("alertdialog", { name: "Remove Best dressed?" }).getByRole("button", { name: "Remove it" }).click());
  await expect.poll(awardNames(again)).toEqual(["Crowd favourite"]);
  await expect(again.getByRole("button", { name: "Remove Crowd favourite" })).toBeDisabled();
  await host.context.close();
});

test("a guest votes once in each award, and an award for videos only shows only the videos", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "album-awards-vote", PAST);
  const priya = await photoAndVideo(browser, host.link);
  const sheet = await openSettings(host.page);
  const awards = awardsBlock(sheet);
  await renameAward(host.page, awards, "Favourite", "Crowd favourite");
  await savedAfter(host.page, () => awards.getByRole("button", { name: "Best video", exact: true }).click());
  await press(host.page, votingBlock(sheet), "Start voting", "open");

  // Ana sees the first award chosen, with both items.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(pill(ana, "Crowd favourite")).toHaveAttribute("aria-pressed", "true");
  await expect(pill(ana, "Best video")).toHaveAttribute("aria-pressed", "false");
  await expect(items(ana)).toHaveCount(2);
  await expect(head(ana)).not.toContainText("This award is for");
  await expectNoSeriousViolations(ana, "the album with the award picker");

  // Best video: the album shows the video alone, numbered in its own list, and says why.
  await pill(ana, "Best video").click();
  await expect(ana).toHaveURL(/[?&]award=[0-9a-f-]{36}/);
  await expect(items(ana)).toHaveCount(1);
  await expect(star(ana, "Video 1")).toBeVisible();
  await expect(head(ana)).toContainText("This award is for videos only.");
  await expect(head(ana).getByRole("status")).toHaveText("Tap a star to vote in Best video.");
  await vote(ana, star(ana, "Video 1"));
  await expect(star(ana, "Video 1")).toHaveAttribute("aria-pressed", "true");
  await expect(pill(ana, "Best video, voted")).toHaveAttribute("aria-pressed", "true");
  // The viewer's star on the video (a guest's video has no captions track: M7 ticket 11).
  await album(ana).getByRole("button", { name: /^Video 1 \d/ }).click();
  const viewer = ana.getByRole("dialog", { name: "Video 1 of 1" });
  await expect(viewer.getByRole("button", { name: "Vote for this video" })).toHaveAttribute("aria-pressed", "true");
  await expectNoSeriousViolations(ana, "the viewer with a video's star", { except: ["video-caption"] });
  await ana.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // Back on the first award: both items, nothing voted yet, and a vote there too.
  await pill(ana, "Crowd favourite").click();
  await expect(items(ana)).toHaveCount(2);
  await expect(stars(ana).and(album(ana).locator('[aria-pressed="true"]'))).toHaveCount(0);
  const photoStar = album(ana).locator('li[data-item="photo"] [data-slot="vote-star"]');
  await vote(ana, photoStar);
  await expect(photoStar).toHaveAttribute("aria-pressed", "true");
  await expect(pill(ana, "Crowd favourite, voted")).toHaveAttribute("aria-pressed", "true");
  await expect(pill(ana, "Best video, voted")).toHaveAttribute("aria-pressed", "false");

  // A reload keeps the award the URL names, and both votes.
  await pill(ana, "Best video, voted").click();
  await expect(items(ana)).toHaveCount(1);
  await ana.reload();
  await expect(pill(ana, "Best video, voted")).toHaveAttribute("aria-pressed", "true");
  await expect(items(ana)).toHaveCount(1);
  await expect(star(ana, "Video 1")).toHaveAttribute("aria-pressed", "true");
  await expect(pill(ana, "Crowd favourite, voted")).toBeVisible();

  // A query naming no award shows the first award, pressed, with its list (review fix, ticket 14).
  await ana.goto(`${host.link}?award=nonsense`);
  await expect(pill(ana, "Crowd favourite, voted")).toHaveAttribute("aria-pressed", "true");
  await expect(pill(ana, "Best video, voted")).toHaveAttribute("aria-pressed", "false");
  await expect(items(ana)).toHaveCount(2);

  // The host's total names the chosen award.
  await host.page.goto(host.link);
  await expect(hostsBox(host.page)).toContainText("1 vote so far in Crowd favourite");
  await pill(host.page, "Best video").click();
  await expect(hostsBox(host.page)).toContainText("1 vote so far in Best video");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

test("an award's scope changed keeps the votes for what it still shows", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const host = await createPublished(browser, request, "album-awards-scope", PAST);
  const editor = host.page.url();
  const priya = await photoAndVideo(browser, host.link);
  await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  const videoStar = album(ana).locator('li[data-item="video"] [data-slot="vote-star"]');
  await vote(ana, videoStar);
  await expect(videoStar).toHaveAttribute("aria-pressed", "true");

  // For photos only, the award shows the photo alone, and Ana's vote is not hers there.
  await host.page.goto(editor);
  const awards = awardsBlock(await openSettings(host.page));
  await savedAfter(host.page, async () => {
    await awards.getByLabel("What Favourite is for").selectOption("photos");
  });
  await host.page.goto(host.link);
  await expect(items(host.page)).toHaveCount(1);
  await expect(album(host.page).locator('li[data-item="photo"]')).toHaveCount(1);
  await expect(hostsBox(host.page)).toContainText("0 votes so far in Favourite");
  await pill(host.page, "Whole album").click();
  await expect(items(host.page)).toHaveCount(2);
  await expect(hostsBox(host.page)).not.toContainText("so far");
  await pill(host.page, "Favourite").click();
  await ana.reload();
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);

  // Review fix (finding 2): the one award no longer covers the album, so the picker is drawn with
  // it, says what the award is for, and offers Whole album, where Ana reaches the video, with no
  // star, count or ribbon.
  await expect(head(ana)).toContainText("This award is for photos only.");
  await expect(pill(ana, "Favourite")).toHaveAttribute("aria-pressed", "true");
  await pill(ana, "Whole album").click();
  await expect(ana).toHaveURL(/[?&]award=all(&|$)/);
  await expect(items(ana)).toHaveCount(2);
  await expect(album(ana).locator('li[data-item="video"]')).toHaveCount(1);
  await expect(album(ana).locator('[data-slot="vote-star"], [data-slot="vote-count"], [data-slot="vote-ribbon"]')).toHaveCount(0);
  await expect(head(ana)).not.toContainText("This award is for");
  await expect(head(ana)).toContainText("Voting is open");
  await pill(ana, "Favourite").click();
  await expect(items(ana)).toHaveCount(1);

  // Photos and videos again: the vote is back.
  await host.page.goto(editor);
  const again = awardsBlock(await openSettings(host.page));
  await expect(again.getByLabel("What Favourite is for")).toHaveValue("photos");
  await savedAfter(host.page, async () => {
    await again.getByLabel("What Favourite is for").selectOption("all");
  });
  await host.page.goto(host.link);
  await expect(items(host.page)).toHaveCount(2);
  await expect(album(host.page).locator('li[data-item="video"] [data-slot="vote-count"]')).toHaveAccessibleName("1 vote");
  // Favourite covers the whole album again: no picker.
  await expect(head(host.page).locator('[data-slot="award-picker"]')).toHaveCount(0);
  await ana.reload();
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);

  // Narrowed again, the vote for the video is not Ana's in Favourite: no star of hers is pressed,
  // she votes again, and the new vote is the one counted (review fix, ticket 14).
  await host.page.goto(editor);
  const third = awardsBlock(await openSettings(host.page));
  await savedAfter(host.page, async () => {
    await third.getByLabel("What Favourite is for").selectOption("photos");
  });
  await ana.reload();
  const photoStar = album(ana).locator('li[data-item="photo"] [data-slot="vote-star"]');
  await expect(photoStar).toHaveAttribute("aria-pressed", "false");
  await expect(stars(ana).and(album(ana).locator('[aria-pressed="true"]'))).toHaveCount(0);
  await vote(ana, photoStar);
  await expect(photoStar).toHaveAttribute("aria-pressed", "true");
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);
  await host.page.goto(host.link);
  await expect(hostsBox(host.page)).toContainText("1 vote so far in Favourite");
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("1 vote");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

test("removing an award with votes says how many go, and turning voting off counts a vote given since the editor opened", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-awards-remove", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a")], 1);
  const sheet = await openSettings(host.page);
  const awards = awardsBlock(sheet);
  await savedAfter(host.page, () => awards.getByRole("button", { name: "Best photo", exact: true }).click());
  await press(host.page, votingBlock(sheet), "Start voting", "open");

  // Ana votes in both awards while the host's editor stays open.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, star(ana, "Photo 1"));
  await pill(ana, "Best photo").click();
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");
  await vote(ana, star(ana, "Photo 1"));
  await expect(pill(ana, "Best photo, voted")).toBeVisible();

  // Review fix: the counts are read as each confirmation opens.
  await votingBlock(sheet).getByRole("button", { name: "Turn off voting" }).click();
  const turnOff = host.page.getByRole("alertdialog", { name: "Turn off voting?" });
  await expect(turnOff).toContainText("Its 2 votes are deleted.");
  await turnOff.getByRole("button", { name: "Never mind" }).click();
  await expect(turnOff).toBeHidden();

  await awards.getByRole("button", { name: "Remove Best photo" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Remove Best photo?" });
  await expect(confirm).toContainText("Its 1 vote is deleted.");
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Remove it" }).click());
  await expect.poll(awardNames(awards)).toEqual(["Favourite"]);

  // Its vote went with it; the other award's stays.
  await votingBlock(sheet).getByRole("button", { name: "Turn off voting" }).click();
  await expect(turnOff).toContainText("Its 1 vote is deleted.");
  await turnOff.getByRole("button", { name: "Never mind" }).click();
  await ana.reload();
  await expect(picker(ana)).toHaveCount(0);
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

// Review fix: reopening needs the album open, as starting does, and a refused press says so.
test("Reopen voting is refused once the album is shut again, and says so", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-reopen", PAST);
  const block = await startVoting(host.page);
  await press(host.page, block, "Close voting", "closed");
  await host.page.keyboard.press("Escape");
  await setWhen(host.page, { start: AHEAD.start });

  const again = votingBlock(await openSettings(host.page));
  await again.getByRole("button", { name: "Reopen voting" }).click();
  await expect(saveStatus(host.page)).toHaveAttribute("data-status", "failed");
  await expect(host.page.getByRole("alert").filter({ hasText: "Voting can start once the album opens, at the start of the event." })).toBeVisible();
  await expect(again).toHaveAttribute("data-state", "closed");
  await host.context.close();
});

// M8 ticket 14: who may vote, the closing time, and the "Voting is open" draft.

const whoMayVote = (block: Locator) => block.getByLabel("Who may vote", { exact: true });
const TELL_GUESTS = "Tell guests voting is open";

// The host makes an invite on the Invites page, which is open, and reads its link from its row
// (invites.spec.ts).
async function makeInvite(hostPage: Page, name: string): Promise<string> {
  await hostPage.getByLabel("Name", { exact: true }).fill(name);
  await hostPage.getByRole("button", { name: "Make link" }).click();
  await expect(hostPage.getByRole("status").filter({ hasText: /^Made a link for / })).toHaveText(`Made a link for ${name}.`, { timeout: 15_000 });
  const row = hostPage.getByRole("listitem").filter({ has: hostPage.getByText(name, { exact: true }) });
  return (await row.getByText(/^https?:\/\/\S+\/i\/[A-Za-z0-9]{24}$/).textContent())!.trim();
}

test("only guests who are going vote when the host says so", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-going", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a")], 1);
  const block = votingBlock(await openSettings(host.page));
  await expect(whoMayVote(block)).toHaveValue("album");
  await expect(whoMayVote(block)).toHaveAccessibleDescription("Hosts can always vote. Votes already given stay counted when you change this.");
  await savedAfter(host.page, async () => {
    await whoMayVote(block).selectOption("Only guests who are going");
  });
  await press(host.page, block, "Start voting", "open");

  // Ana, Going, has a star.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(stars(ana)).toHaveCount(1);
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);

  // Ben, Maybe, sees the album and is told why he has no star.
  const ben = await guestAnswers(browser, host.link, "Ben Okafor", "Maybe");
  await expect(items(ben)).toHaveCount(1);
  await expect(head(ben)).toContainText("Voting is open");
  await expect(head(ben)).toContainText("Only guests who are going can vote.");
  await expect(head(ben).getByRole("status")).toHaveCount(0);
  await expect(stars(ben)).toHaveCount(0);

  // The host still votes.
  await host.page.goto(host.link);
  await expect(head(host.page)).not.toContainText("Only guests");
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await expect(star(host.page, "Photo 1 by Priya Nair")).toHaveAttribute("aria-pressed", "true");
  await expect(hostsBox(host.page)).toContainText("1 vote so far in Favourite");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close(), ben.context().close()]);
});

test("only guests invited personally vote when the host says so", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-invited", PAST);
  const editor = host.page.url();
  await host.page.goto(host.link);
  await addPhotos(host.page, [await photo("toast.jpg", "#e0b040")], 1);
  await host.page.goto(`${editor}/invites`);
  const caraLink = await makeInvite(host.page, "Cara Diaz");
  await host.page.goto(editor);
  const block = votingBlock(await openSettings(host.page));
  await savedAfter(host.page, async () => {
    await whoMayVote(block).selectOption("Only guests invited personally");
  });
  // An invite is no status to tick, so the block says who the announcement goes to (review fix).
  await expect(block).toContainText("“Tell guests voting is open” emails guests by their reply, not their invite: untick anyone who shouldn’t get it.");
  await press(host.page, block, "Start voting", "open");

  // Cara replies through her link, and has a star.
  const cara = await guestAnswers(browser, caraLink, "Cara Diaz", "Going");
  await expect(stars(cara)).toHaveCount(1);
  await expect(head(cara).getByRole("status")).toHaveText(TAP_TO_VOTE);

  // Ana replied through the event link: she sees the album, and no star.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(items(ana)).toHaveCount(1);
  await expect(head(ana)).toContainText("Only guests the hosts invited personally can vote.");
  await expect(stars(ana)).toHaveCount(0);
  await Promise.all([host.context.close(), cara.context().close(), ana.context().close()]);
});

// The wall time `offset` from now in `timeZone`, to the minute, as a datetime-local field takes it,
// and the instant it names: a time zone west of UTC tests the conversion both ways (the review's
// test gap 2).
function wallFromNow(offset: number, timeZone: string): { wall: string; at: Date } {
  const at = new Date(Math.floor((Date.now() + offset) / 60_000) * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return { wall: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`, at };
}

test("voting closes by itself at the time the host set, in the event's zone, which guests are told", async ({ browser, request }) => {
  // It waits up to two minutes for the time to come, which test.slow()'s 90 s cannot hold.
  test.setTimeout(300_000);
  const ZONE = "America/New_York";
  const host = await createPublished(browser, request, "album-vote-closes", { ...PAST, timeZone: ZONE });
  const editor = host.page.url();
  await host.page.goto(host.link);
  await addPhotos(host.page, [await photo("toast.jpg", "#e0b040")], 1);
  await host.page.goto(editor);
  const block = await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, star(ana, "Photo 1"));
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "true");

  const closes = block.getByLabel("Close by itself at", { exact: true });
  await expect(closes).toHaveAccessibleDescription(`Guests see this time. Times are in ${ZONE}.`);
  await expect(block.getByRole("button", { name: "No closing time" })).toBeDisabled();

  // A time that has passed is refused, and said so under the field.
  await closes.fill(wallFromNow(-60 * 60_000, ZONE).wall);
  await closes.press("Enter");
  await expect(block.getByRole("alert")).toHaveText("Choose a time that hasn’t passed.");
  await expect(saveStatus(host.page)).toHaveAttribute("data-status", "failed");

  // A time at least a minute ahead (the field takes whole minutes), typed in the event's zone.
  const { wall, at } = wallFromNow(119_000, ZONE);
  await savedAfter(host.page, async () => {
    await closes.fill(wall);
    await closes.press("Enter");
  });
  await expect(block.getByRole("alert")).toHaveCount(0);
  const moment = { timeZone: ZONE, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" } as const;
  const time = new Intl.DateTimeFormat("en", moment).format(at);
  await expect(block).toContainText(`Voting is open · closes ${time}`);
  await expect(closes).toHaveValue(wall);

  // Ana sees when it closes, with the zone named (review fix: she may be elsewhere by then), and
  // leaves a second page open.
  const zoned = new Intl.DateTimeFormat("en", { ...moment, timeZoneName: "short" }).format(at);
  expect(zoned).toMatch(/ E[SD]T$/);
  await ana.reload();
  await expect(head(ana)).toContainText(`Voting is open · closes ${zoned}`);
  const left = await ana.context().newPage();
  await left.goto(host.link);
  await expect(star(left, "Photo 1")).toHaveAttribute("aria-pressed", "true");

  // Nothing runs at that time: a page drawn after it reads closed, with the counts and no star,
  // and not before the instant typed.
  await expect(async () => {
    await ana.reload();
    await expect(head(ana)).toContainText("Voting closed", { timeout: 2_000 });
  }).toPass({ intervals: [5_000], timeout: 120_000 });
  expect(Date.now()).toBeGreaterThanOrEqual(at.getTime());
  await expect(stars(ana)).toHaveCount(0);
  await expect(count(ana, "Photo 1")).toHaveAccessibleName("1 vote");
  await expect(head(ana)).not.toContainText("closes");

  // The page left open refuses a vote.
  await vote(left, star(left, "Photo 1"));
  await expect(head(left).getByRole("alert")).toHaveText("Voting has closed.");

  await host.page.reload();
  const again = votingBlock(await openSettings(host.page));
  await expect(again).toHaveAttribute("data-state", "closed");
  await expect(again).toContainText("Voting closed");
  await expect(again.getByRole("button", { name: "Reopen voting" })).toBeVisible();
  await Promise.all([host.context.close(), ana.context().close()]);
});

test("the host tells guests voting is open with a message already written", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-announce", PAST);
  const sheet = await openSettings(host.page);
  const block = votingBlock(sheet);
  await savedAfter(host.page, () => awardsBlock(sheet).getByRole("button", { name: "Best photo", exact: true }).click());
  await savedAfter(host.page, async () => {
    await whoMayVote(block).selectOption("Only guests who are going");
  });
  // Before the vote starts there is nothing to tell.
  await expect(block.getByRole("link", { name: TELL_GUESTS })).toHaveCount(0);
  await press(host.page, block, "Start voting", "open");

  await block.getByRole("link", { name: TELL_GUESTS }).click();
  await expect(host.page).toHaveURL(/\/events\/[0-9a-f-]{36}\/announcements\?draft=voting$/);
  const message = host.page.getByLabel("Message");
  await expect(message).toHaveValue(/^Voting is open in the album for Ada’s garden party\./);
  const draft = await message.inputValue();
  expect(draft).toContain("You have one vote in each award: Favourite and Best photo.");
  expect(draft).toContain(host.link);
  // Only guests who are going may vote, so Going alone is ticked.
  const audience = (name: string) => host.page.getByRole("checkbox", { name, exact: true });
  await expect(audience("Going")).toBeChecked();
  for (const other of ["Maybe", "Can’t go", "Waitlist"]) await expect(audience(other)).not.toBeChecked();

  // Nothing went by itself; Send posts it, and the form starts again as it always does.
  await expect(host.page.getByRole("button", { name: /^Delete the announcement from / })).toHaveCount(0);
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("", { timeout: 15_000 });
  await expect(audience("Maybe")).toBeChecked();
  await expect(host.page.getByRole("listitem").getByText(/^Voting is open in the album for/)).toBeVisible();
  // The address no longer names the draft, so a reload does not write it into the form again
  // (review fix).
  await expect(host.page).toHaveURL(/\/events\/[0-9a-f-]{36}\/announcements$/);
  await host.page.reload();
  await expect(message).toHaveValue("");
  await expect(host.page.getByRole("listitem").getByText(/^Voting is open in the album for/)).toBeVisible();

  // The event page shows it, and the hosts' box above the album offers the same.
  await host.page.goto(host.link);
  await expect(host.page.getByText(/^Voting is open in the album for Ada’s garden party\./)).toBeVisible();
  await expect(hostsBox(host.page).getByRole("link", { name: TELL_GUESTS })).toHaveAttribute("href", /^\/events\/[0-9a-f-]{36}\/announcements\?draft=voting$/);
  await host.context.close();
});

// Review fixes (ticket 15): the closing time field keeps a saved time that a partly erased value
// would have cleared (a date and time with a part erased reads empty), and saves a time typed whole
// when the sheet closes with the field still focused.
test("a partly erased closing time keeps the saved one, and a time typed whole is saved when the sheet closes", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-closing-field", { ...AHEAD, timeZone: "UTC" });
  const closesIn = (sheet: Locator) => votingBlock(sheet).getByLabel("Close by itself at", { exact: true });
  const sheet = await openSettings(host.page);
  const closes = closesIn(sheet);
  const saved = utcFromNow(2 * 24 * 60 * 60_000);
  await savedAfter(host.page, async () => {
    await closes.fill(saved);
    await closes.press("Enter");
  });
  await expect(closes).toHaveValue(saved);

  // A part erased: the field reads empty, and leaving it keeps the saved time and shows it again.
  await closes.focus();
  await closes.press("Backspace");
  await expect(closes).toHaveValue("");
  await whoMayVote(votingBlock(sheet)).focus();
  await expect(closes).toHaveValue(saved);
  await host.page.reload();
  const again = await openSettings(host.page);
  await expect(closesIn(again)).toHaveValue(saved);

  // A time typed whole, and the sheet closed with Escape while the field has the focus.
  const typed = utcFromNow(3 * 24 * 60 * 60_000);
  await savedAfter(host.page, async () => {
    await closesIn(again).fill(typed);
    await expect(closesIn(again)).toBeFocused();
    await host.page.keyboard.press("Escape");
    await expect(again).toBeHidden();
  });
  await host.page.reload();
  await expect(closesIn(await openSettings(host.page))).toHaveValue(typed);
  await host.context.close();
});

// M8 ticket 15: a tie for first place can go to a tie-break among the tied items. The hosts start
// it from their box above the album, guests vote again among the tied items only, with the counts
// hidden, and closing it puts those items in order in the places they shared.

const ribbonOf = (page: Page, name: string) => tile(page, name).locator('[data-slot="vote-ribbon"]');
const pressed = (page: Page) => stars(page).and(album(page).locator('[aria-pressed="true"]'));

// A press in the hosts' box, and the box drawn again with what it changed.
async function hostsPress(page: Page, name: string, then: string) {
  await hostsBox(page).getByRole("button", { name, exact: true }).click();
  await expect(head(page)).toContainText(then);
}

test("a tie for first goes to a tie-break among the tied items, which puts them in order", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const host = await createPublished(browser, request, "album-tiebreak", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")], 2);
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  await addPhotos(mei, [await photo("lake.jpg", "#3a6bd0")], 3);
  const [first, second, third] = await order(mei);
  await startVoting(host.page);

  // Ana and the host vote for Photo 1, Ben and Mei for Photo 2, Priya for Photo 3.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, first));
  await expect(starOf(ana, first)).toHaveAttribute("aria-pressed", "true");
  const ben = await guestGoing(browser, host.link, "Ben Okafor");
  await vote(ben, starOf(ben, second));
  await mei.reload();
  await vote(mei, starOf(mei, second));
  await priya.reload();
  await vote(priya, starOf(priya, third));
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("2 votes");
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("2 votes");

  // Closed: Photos 1 and 2 share first, and the hosts are offered a tie-break.
  await hostsPress(host.page, "Close voting", "Voting closed");
  await expect(ribbonOf(host.page, "Photo 1")).toHaveText("1st");
  await expect(ribbonOf(host.page, "Photo 2")).toHaveText("1st");
  await expect(ribbonOf(host.page, "Photo 3")).toHaveText("3rd");
  await expect(hostsBox(host.page)).toContainText("2 items share first place in Favourite.");
  await expect(hostsBox(host.page).getByRole("button", { name: "Keep the shared first place" })).toBeVisible();
  await expectNoSeriousViolations(host.page, "the hosts' box offering a tie-break");
  await hostsPress(host.page, "Start a tie-break", "Tie-break · Favourite");
  await expect(hostsBox(host.page).getByRole("button", { name: "Close the tie-break" })).toBeVisible();
  await expect(hostsBox(host.page).getByRole("button", { name: "Start a tie-break" })).toHaveCount(0);

  // Ana's page, drawn again by her comment without a reload, shows the two finalists alone, with
  // no star pressed: her vote in the first round is not her vote in the tie-break.
  const box = ana.getByLabel("Add a comment");
  await box.fill("So close!");
  await ana.getByRole("button", { name: "Post", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });
  await expect(head(ana)).toContainText("Tie-break · Favourite");
  await expect(items(ana)).toHaveCount(2);
  await expect(stars(ana)).toHaveCount(2);
  await expect(pressed(ana)).toHaveCount(0);
  await expect(head(ana).getByRole("status")).toHaveText("These 2 shared first place. Vote again for one of them.");
  await expect(head(ana)).toContainText("Counts stay hidden until the tie-break closes.");
  await expect(album(ana).locator('[data-slot="vote-count"]')).toHaveCount(0);
  // The rest of the album is a choice away (review fix, finding 2), and under "Shown after voting
  // closes" a guest sees who added each finalist during the tie-break, voting having closed
  // (ticket 16's review).
  await expect(head(ana)).toContainText("To see the rest of the album, choose Whole album.");
  await expect(tileOf(ana, first).getByRole("button", { name: /^Photo [12] by Priya Nair$/ })).toBeVisible();
  await expect(tileOf(ana, second).getByRole("button", { name: /^Photo [12] by Priya Nair$/ })).toBeVisible();
  // Checked to hold the banner, so the check cannot pass on an empty or redirected answer.
  const anas = await (await ana.request.get(host.link)).text();
  expect(anas).toContain("Tie-break · Favourite");
  expect(anas).not.toContain("shownVotes");
  await expectNoSeriousViolations(ana, "a guest's album during a tie-break");

  // Ana and Ben vote for Photo 2, the host for Photo 1; the host sees the counts as they come.
  await vote(ana, starOf(ana, second));
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);
  await ben.reload();
  await vote(ben, starOf(ben, second));
  await host.page.reload();
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("2 votes");
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("1 vote");
  await expect(hostsBox(host.page)).toContainText("3 votes so far in Favourite");

  // Closed, the tie-break puts Photo 2 first and Photo 1 second; Photo 3 keeps its place.
  await hostsPress(host.page, "Close the tie-break", "Voting closed");
  await expect(ribbonOf(host.page, "Photo 2")).toHaveText("1st");
  await expect(ribbonOf(host.page, "Photo 1")).toHaveText("2nd");
  await expect(ribbonOf(host.page, "Photo 3")).toHaveText("3rd");
  await expect(hostsBox(host.page)).not.toContainText("share first place");
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("2 votes, 2 votes in the tie-break");
  await expect(count(host.page, "Photo 3")).toHaveAccessibleName("1 vote");
  await ana.reload();
  await expect(ribbonOf(ana, "Photo 2")).toHaveText("1st");
  await expect(ribbonOf(ana, "Photo 1")).toHaveText("2nd");
  // The strip says the tie-break decided it, beside the first round's votes (review fix).
  await expect(strip(ana).locator("figcaption")).toHaveText(["2 votes, 2 votes in the tie-break", "2 votes, 1 vote in the tie-break", "1 vote"]);
  await album(ana).getByRole("button", { name: "Photo 2 by Priya Nair", exact: true }).click();
  await expect(ana.getByRole("dialog").locator('[data-slot="vote-tiebreak"]')).toHaveText("2 votes in the tie-break");
  await Promise.all([host.context.close(), priya.context().close(), mei.context().close(), ana.context().close(), ben.context().close()]);
});

test("still level, the host chooses another round or a shared first place", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "album-tiebreak-level", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")], 2);
  const [, second] = await order(priya);
  await startVoting(host.page);

  // One vote each.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, second));
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await hostsPress(host.page, "Close voting", "Voting closed");
  await expect(hostsBox(host.page)).toContainText("2 items share first place in Favourite.");

  // A tie-break of one vote each again.
  await hostsPress(host.page, "Start a tie-break", "Tie-break · Favourite");
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await ana.reload();
  await vote(ana, starOf(ana, second));
  await hostsPress(host.page, "Close the tie-break", "Voting closed");
  await expect(ribbonOf(host.page, "Photo 1")).toHaveText("1st");
  await expect(ribbonOf(host.page, "Photo 2")).toHaveText("1st");
  await expect(hostsBox(host.page)).toContainText("2 items still share first place in Favourite after the tie-break.");
  await expect(hostsBox(host.page).getByRole("button", { name: "Start a tie-break" })).toHaveCount(0);
  await expect(hostsBox(host.page).getByRole("button", { name: "Keep the shared first place" })).toBeVisible();

  // Another round says which it is, and closed with no vote it is level again.
  await hostsPress(host.page, "Start another round", "Tie-break · Favourite · round 3");
  await ana.reload();
  await expect(head(ana)).toContainText("Tie-break · Favourite · round 3");
  await expect(pressed(ana)).toHaveCount(0);
  await hostsPress(host.page, "Close the tie-break", "Voting closed");
  await expect(hostsBox(host.page)).toContainText("2 items still share first place in Favourite after the tie-break.");

  // Kept shared: both first, and nothing more offered.
  await hostsBox(host.page).getByRole("button", { name: "Keep the shared first place" }).click();
  await expect(hostsBox(host.page)).not.toContainText("share first place");
  await expect(hostsBox(host.page).getByRole("button", { name: "Start another round" })).toHaveCount(0);
  await expect(hostsBox(host.page).getByRole("button", { name: "Keep the shared first place" })).toHaveCount(0);
  await expect(ribbonOf(host.page, "Photo 1")).toHaveText("1st");
  await expect(ribbonOf(host.page, "Photo 2")).toHaveText("1st");
  await ana.reload();
  await expect(ribbonOf(ana, "Photo 1")).toHaveText("1st");
  await expect(ribbonOf(ana, "Photo 2")).toHaveText("1st");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

test("reopening the vote ends a tie-break", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "album-tiebreak-reopen", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a"), await photo("lake.jpg", "#3a6bd0")], 3);
  const [first, second] = await order(priya);
  await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, second));
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await hostsPress(host.page, "Close voting", "Voting closed");
  await hostsPress(host.page, "Start a tie-break", "Tie-break · Favourite");
  await ana.reload();
  await expect(items(ana)).toHaveCount(2);
  await vote(ana, starOf(ana, first));

  // Review fix (finding 1): Reopen voting asks first, since it ends the tie-break and deletes its
  // votes, counted as the confirmation opens: Ana's vote came after the host's page was drawn.
  await hostsBox(host.page).getByRole("button", { name: "Reopen voting", exact: true }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Reopen voting?" });
  await expect(confirm).toContainText("The tie-break ends, and its 1 vote is deleted. Votes from before the tie-break stay.");
  await expectNoSeriousViolations(host.page, "the Reopen voting confirmation during a tie-break");
  // Never mind keeps the tie-break.
  await confirm.getByRole("button", { name: "Never mind" }).click();
  await expect(confirm).toBeHidden();
  await expect(head(host.page)).toContainText("Tie-break · Favourite");
  await hostsBox(host.page).getByRole("button", { name: "Reopen voting", exact: true }).click();
  await expect(confirm).toContainText("its 1 vote is deleted");
  await confirm.getByRole("button", { name: "Reopen it" }).click();
  await expect(confirm).toBeHidden();

  // Reopened: the whole album with its stars, no tie-break, and the first round's votes kept.
  await expect(head(host.page)).toContainText("Voting is open");
  await expect(hostsBox(host.page).getByRole("button", { name: "Close the tie-break" })).toHaveCount(0);
  await ana.reload();
  await expect(items(ana)).toHaveCount(3);
  await expect(stars(ana)).toHaveCount(3);
  await expect(head(ana)).not.toContainText("Tie-break");
  await expect(starOf(ana, second)).toHaveAttribute("aria-pressed", "true");
  await expect(head(ana).getByRole("status")).toHaveText(YOUR_VOTE);
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("1 vote");
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("1 vote");
  await expect(hostsBox(host.page)).toContainText("2 votes so far in Favourite");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

// Review fix (finding 1): a Settings sheet opened before a tie-break began offers Reopen voting as
// one press; the site refuses it, since the host was not told what it deletes, and the sheet, drawn
// again, asks.
test("Reopen voting from a sheet opened before a tie-break began does nothing until the host is asked", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "album-tiebreak-stale-reopen", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")], 2);
  const [, second] = await order(priya);
  const block = await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, second));
  const albumTab = await host.context.newPage();
  await albumTab.goto(host.link);
  await vote(albumTab, star(albumTab, "Photo 1 by Priya Nair"));
  await press(host.page, block, "Close voting", "closed");

  // The tie-break starts from the album, in another tab; the sheet still shows the vote closed.
  await albumTab.reload();
  await hostsPress(albumTab, "Start a tie-break", "Tie-break · Favourite");
  await block.getByRole("button", { name: "Reopen voting" }).click();
  await expect(saveStatus(host.page)).toHaveAttribute("data-status", "failed");
  await expect(host.page.getByRole("alert").filter({ hasText: "Since this page opened, a tie-break has started. Press Reopen voting again to see what it deletes." })).toBeVisible();
  await expect(block).toHaveAttribute("data-state", "closed");
  await albumTab.reload();
  await expect(head(albumTab)).toContainText("Tie-break · Favourite");

  // Drawn again, the sheet asks.
  await block.getByRole("button", { name: "Reopen voting" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Reopen voting?" });
  await expect(confirm).toContainText("The tie-break ends. Nobody has voted in it yet. Votes from before the tie-break stay.");
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Reopen it" }).click());
  await expect(block).toHaveAttribute("data-state", "open");
  await albumTab.reload();
  await expect(head(albumTab)).not.toContainText("Tie-break");
  await expect(hostsBox(albumTab)).toContainText("2 votes so far in Favourite");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

// Review fix (finding 5): a press says which round its page was drawn in, and is refused in any
// other, so a page left open across a round change never gives a vote the guest did not choose.
test("a press from a page left open across a change of round is refused, and the page shows the round open now", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "album-vote-round", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")], 2);
  const [first, second] = await order(priya);
  await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, first));
  await expect(starOf(ana, first)).toHaveAttribute("aria-pressed", "true");
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 2 by Priya Nair"));
  await hostsPress(host.page, "Close voting", "Voting closed");
  await hostsPress(host.page, "Start a tie-break", "Tie-break · Favourite");

  // Ana's page, drawn in the first round, presses a finalist: no tie-break vote is stored, and her
  // page shows the tie-break.
  await vote(ana, starOf(ana, second));
  await expect(head(ana)).toContainText("Tie-break · Favourite");
  await expect(pressed(ana)).toHaveCount(0);
  await host.page.reload();
  await expect(hostsBox(host.page)).toContainText("0 votes so far in Favourite");

  // Her tie-break page, left open while the host reopens voting, presses again: her first-round
  // vote is not replaced, and her page shows it.
  await hostsBox(host.page).getByRole("button", { name: "Reopen voting", exact: true }).click();
  await host.page.getByRole("alertdialog", { name: "Reopen voting?" }).getByRole("button", { name: "Reopen it" }).click();
  await expect(head(host.page)).toContainText("Voting is open");
  await vote(ana, starOf(ana, second));
  await expect(head(ana)).not.toContainText("Tie-break");
  await expect(starOf(ana, first)).toHaveAttribute("aria-pressed", "true");
  await expect(starOf(ana, second)).toHaveAttribute("aria-pressed", "false");
  await host.page.reload();
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("1 vote");
  await expect(count(host.page, "Photo 2")).toHaveAccessibleName("1 vote");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

// Review fix (finding 2, and test gap 3): while the only award is in a tie-break its list is the
// finalists, and the rest of the album is under Whole album, with no star, count or ribbon: there a
// guest finds what they added during the tie-break, and the hosts approve and delete.
test("during a tie-break in the only award, Whole album holds the rest, where hosts approve and delete and a guest finds what they added", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const host = await createPublished(browser, request, "album-whole", PAST);
  const editor = host.page.url();
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Approve photos before they’re shown").check());
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a"), await photo("lake.jpg", "#3a6bd0")], 3);
  const [first] = await order(priya);
  await host.page.goto(host.link);
  const approveButtons = album(host.page).getByRole("button", { name: /^Approve photo / });
  for (const left of [2, 1, 0]) {
    await approveButtons.first().click();
    await expect(approveButtons).toHaveCount(left);
  }
  await host.page.goto(editor);
  await startVoting(host.page);

  // Photo 1 and Photo 2 share first; Photo 3 has no vote.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, first));
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 2 by Priya Nair"));
  await hostsPress(host.page, "Close voting", "Voting closed");
  await hostsPress(host.page, "Start a tie-break", "Tie-break · Favourite");

  // Priya sees the finalists, the picker with Whole album, and the line saying where the rest is.
  await priya.reload();
  await expect(items(priya)).toHaveCount(2);
  await expect(head(priya)).toContainText("To see the rest of the album, choose Whole album.");
  await expect(pill(priya, "Favourite")).toHaveAttribute("aria-pressed", "true");
  await pill(priya, "Whole album").click();
  await expect(items(priya)).toHaveCount(3);
  await expect(head(priya)).not.toContainText("To see the rest");
  // She adds two photos during the tie-break; they wait for approval, and she finds them here.
  await addPhotos(priya, [await photo("toast.jpg", "#e0b040"), await photo("dance.jpg", "#8a4fd0")], 5);
  await expect(album(priya).getByText("Awaiting approval", { exact: true })).toHaveCount(2);
  await expect(album(priya).locator('[data-slot="vote-star"], [data-slot="vote-count"], [data-slot="vote-ribbon"]')).toHaveCount(0);

  // The host's Whole album: every item, no star, count or ribbon, and the hosts' box with what
  // concerns the whole vote alone.
  await host.page.reload();
  await expect(items(host.page)).toHaveCount(2);
  await pill(host.page, "Whole album").click();
  await expect(host.page).toHaveURL(/[?&]award=all(&|$)/);
  await expect(items(host.page)).toHaveCount(5);
  await expect(album(host.page).locator('[data-slot="vote-star"], [data-slot="vote-count"], [data-slot="vote-ribbon"]')).toHaveCount(0);
  await expect(head(host.page)).toContainText("Voting closed");
  await expect(head(host.page)).not.toContainText("Tie-break");
  await expect(hostsBox(host.page).getByRole("button", { name: "Reopen voting" })).toBeVisible();
  await expect(hostsBox(host.page).getByRole("button", { name: "Close the tie-break" })).toHaveCount(0);
  await expect(hostsBox(host.page)).not.toContainText("so far");
  await expectNoSeriousViolations(host.page, "the host's Whole album during a tie-break");

  // The host approves Photo 4 and deletes Photo 5.
  await tile(host.page, "Photo 4").getByRole("button", { name: /^Approve photo 4 by Priya Nair/ }).click();
  await expect(tile(host.page, "Photo 4")).not.toContainText("Awaiting approval");
  await tile(host.page, "Photo 5").getByRole("button", { name: /^Delete photo 5 by Priya Nair/ }).click();
  await host.page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(items(host.page)).toHaveCount(4, { timeout: 15_000 });
  await expect(album(host.page).getByText("Awaiting approval", { exact: true })).toHaveCount(0);

  // The award's own list is as it was: the finalists, with their stars and counts.
  await pill(host.page, "Favourite").click();
  await expect(items(host.page)).toHaveCount(2);
  await expect(hostsBox(host.page).getByRole("button", { name: "Close the tie-break" })).toBeVisible();
  await ana.reload();
  await pill(ana, "Whole album").click();
  await expect(items(ana)).toHaveCount(4);
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

// The review's test gap 1: a vote belongs to a reply, so removing the reply removes its votes (the
// host's remedy for a reply made to vote again), and the person replying again votes afresh.
test("removing a guest removes their votes, and replying again they vote afresh", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-removed", PAST);
  const editor = host.page.url();
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a")], 1);
  await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, star(ana, "Photo 1"));
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "true");
  await host.page.goto(host.link);
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("1 vote");

  // The host removes Ana from the guest list: her vote goes with her reply.
  await host.page.goto(`${editor}/guests`);
  await host.page.getByRole("listitem").filter({ hasText: "Ana Ruiz" }).getByRole("button", { name: "Edit" }).click();
  await host.page.getByRole("button", { name: "Remove", exact: true }).click();
  await host.page.getByRole("button", { name: "Remove guest" }).click();
  await expect(host.page.getByRole("listitem").filter({ hasText: "Ana Ruiz" })).toHaveCount(0);
  await host.page.goto(host.link);
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("0 votes");
  await expect(hostsBox(host.page)).toContainText("0 votes so far in Favourite");

  // Ana replies again, a new reply, with no vote, and votes.
  await ana.reload();
  await ana.getByRole("button", { name: "Going", exact: true }).click();
  await ana.getByLabel("Your name").fill("Ana Ruiz");
  await ana.getByRole("button", { name: "Send RSVP" }).click();
  await expect(ana.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await closeReply(ana);
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");
  await expect(head(ana).getByRole("status")).toHaveText(TAP_TO_VOTE);
  await vote(ana, star(ana, "Photo 1"));
  await host.page.reload();
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("1 vote");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

// Review fix (ticket 14), in ticket 16: a guest who may no longer vote is refused by the vote
// itself, not only shown no star once their page is drawn again.
test("a guest the host no longer lets vote is refused by the vote itself, from a page left open", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-stale", PAST);
  const editor = host.page.url();
  await host.page.goto(host.link);
  await addPhotos(host.page, [await photo("toast.jpg", "#e0b040")], 1);
  await host.page.goto(editor);
  const block = await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");

  // Only guests invited personally may vote now; Ana replied through the event link. Her page, left
  // open, still has its star, and its press is refused.
  await savedAfter(host.page, async () => {
    await whoMayVote(block).selectOption("Only guests invited personally");
  });
  await vote(ana, star(ana, "Photo 1"));
  await expect(head(ana).getByRole("alert")).toHaveText("You can’t vote for this one.");
  await expect(star(ana, "Photo 1")).toHaveAttribute("aria-pressed", "false");
  await expectNoSeriousViolations(ana, "a guest's album with a refusal shown");

  // Nothing was stored: the host's count is unchanged.
  await host.page.goto(host.link);
  await expect(count(host.page, "Photo 1")).toHaveAccessibleName("0 votes");
  await expect(hostsBox(host.page)).toContainText("0 votes so far in Favourite");
  await Promise.all([host.context.close(), ana.context().close()]);
});

// M8 ticket 16: the Winners strip, the winners announcement, and each guest's own order.

const strip = (page: Page) => album(page).locator('[data-slot="winners-strip"]');
const SEND_WINNERS = "Send the winners to guests";

// A guest's page as its HTML is sent, without the RSVP form's example name ("e.g. Priya Nair"),
// which every page carries.
const htmlWithoutExample = async (page: Page, link: string) => (await (await page.request.get(link)).text()).replaceAll("e.g. Priya Nair", "");

test("once voting closes, a Winners strip heads the album with each award's top three", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "album-winners", PAST);
  const editor = host.page.url();
  // The album is the only place on the page an uploader's name could be.
  await editSettings(host.page, async (sheet) => {
    await sheet.getByLabel("Who can see the guest list").selectOption("hidden");
    await sheet.getByLabel("Comments", { exact: true }).uncheck();
  });
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a")], 2);
  const [first, second] = await order(priya);
  const sheet = await openSettings(host.page);
  await savedAfter(host.page, () => awardsBlock(sheet).getByRole("button", { name: "Best video", exact: true }).click());
  await press(host.page, votingBlock(sheet), "Start voting", "open");

  // Photo 1 has two votes, Ana's and the host's, and Photo 2 one, Ben's. No strip while voting.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, first));
  await expect(strip(ana)).toHaveCount(0);
  const ben = await guestGoing(browser, host.link, "Ben Okafor");
  await vote(ben, starOf(ben, second));
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await hostsPress(host.page, "Close voting", "Voting closed");

  // Closed: the strip heads Ana's album, first place first, each with its picture and votes.
  await ana.reload();
  await expect(strip(ana).getByRole("heading", { name: "Winners · Favourite" })).toBeVisible();
  await expect(strip(ana)).toHaveText(/1st.*2 votes.*2nd.*1 vote/);
  await expect(strip(ana).getByRole("img", { name: "1st: Photo 1 by Priya Nair", exact: true })).toHaveAttribute("src", first);
  await expect(strip(ana).getByRole("img", { name: "2nd: Photo 2 by Priya Nair", exact: true })).toHaveAttribute("src", second);
  // Not interactive: the grid's tiles open the viewer.
  await expect(strip(ana).getByRole("button")).toHaveCount(0);
  await expectNoSeriousViolations(ana, "a guest's closed album with the Winners strip");

  // The second award, which nobody voted in.
  await pill(ana, "Best video").click();
  await expect(strip(ana).getByRole("heading", { name: "Winners · Best video" })).toBeVisible();
  await expect(strip(ana)).toContainText("Nobody voted in Best video.");
  await expect(strip(ana).getByRole("img")).toHaveCount(0);

  // Under Never shown to guests, the strip names nobody, and the page carries no name.
  await host.page.goto(editor);
  const names = votingBlock(await openSettings(host.page)).getByRole("group", { name: "Who added each item" });
  await savedAfter(host.page, () => names.getByLabel("Never shown to guests").check());
  await ana.goto(host.link);
  await expect(strip(ana).getByRole("img", { name: "1st: Photo 1", exact: true })).toHaveAttribute("src", first);
  const anas = await htmlWithoutExample(ana, host.link);
  expect(anas).toContain("Winners · Favourite");
  expect(anas).not.toContain("Priya Nair");
  // The host's page still names her, so the check above can fail.
  expect(await htmlWithoutExample(host.page, host.link)).toContain("Priya Nair");
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close(), ben.context().close()]);
});

test("the host sends the winners with a message already written", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-winners-send", PAST);
  const editor = host.page.url();
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a")], 1);
  await startVoting(host.page);
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, star(ana, "Photo 1"));
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  // While voting is open there are no winners to send.
  await expect(hostsBox(host.page).getByRole("link", { name: SEND_WINNERS })).toHaveCount(0);
  await hostsPress(host.page, "Close voting", "Voting closed");

  await hostsBox(host.page).getByRole("link", { name: SEND_WINNERS }).click();
  await expect(host.page).toHaveURL(/\/events\/[0-9a-f-]{36}\/announcements\?draft=winners$/);
  const message = host.page.getByLabel("Message");
  await expect(message).toHaveValue(/^The votes are in for Ada’s garden party\./);
  const draft = await message.inputValue();
  expect(draft).toContain("Favourite: a photo by Priya Nair, 2 votes.");
  expect(draft).toContain(host.link);
  // Emailed to the form's usual audience.
  const audience = (name: string) => host.page.getByRole("checkbox", { name, exact: true });
  await expect(audience("Going")).toBeChecked();
  await expect(audience("Maybe")).toBeChecked();
  await expectNoSeriousViolations(host.page, "the Announcements page with the winners draft");

  // Nothing went by itself; Send posts it.
  await expect(host.page.getByRole("button", { name: /^Delete the announcement from / })).toHaveCount(0);
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("", { timeout: 15_000 });
  await expect(host.page.getByRole("listitem").getByText(/^The votes are in for/)).toBeVisible();

  // Under Never shown to guests the draft names nobody, though the host sees every name.
  await host.page.goto(editor);
  const names = votingBlock(await openSettings(host.page)).getByRole("group", { name: "Who added each item" });
  await savedAfter(host.page, () => names.getByLabel("Never shown to guests").check());
  await host.page.goto(`${editor}/announcements?draft=winners`);
  await expect(message).toHaveValue(/Favourite: a photo, 2 votes\./);
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close()]);
});

test("a guest votes in an order of their own that holds across visits, and hosts keep the usual order", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "album-vote-order", PAST);
  const editor = host.page.url();
  await host.page.goto(host.link);
  const colours = ["#e0b040", "#c0506a", "#3a6bd0", "#2f6b3a", "#8a4fd0", "#d07a3a"];
  await addPhotos(host.page, await Promise.all(colours.map((colour, at) => photo(`photo-${at + 1}.jpg`, colour))), colours.length);
  const added = await order(host.page);
  await host.page.goto(editor);
  await startVoting(host.page);

  // The host's thumbnails are in the order added.
  await host.page.goto(host.link);
  await expect(head(host.page)).toContainText("Voting is open");
  expect(await order(host.page)).toEqual(added);

  // Ana's are in an order of her own, the same after a reload, and her numbers follow it.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await expect(stars(ana)).toHaveCount(colours.length);
  const anas = await order(ana);
  expect([...anas].sort()).toEqual([...added].sort());
  await expect(tileOf(ana, anas[0]).getByRole("button", { name: "Photo 1", exact: true })).toBeVisible();
  await expect(tileOf(ana, anas[5]).getByRole("button", { name: "Photo 6", exact: true })).toBeVisible();
  await ana.reload();
  await expect(stars(ana)).toHaveCount(colours.length);
  expect(await order(ana)).toEqual(anas);

  // After voting, and opened again: the same.
  await vote(ana, starOf(ana, anas[2]));
  await ana.goto(host.link);
  await expect(starOf(ana, anas[2])).toHaveAttribute("aria-pressed", "true");
  expect(await order(ana)).toEqual(anas);

  // Closed, Ana's album is in the host's order; reopened, in hers again.
  await hostsPress(host.page, "Close voting", "Voting closed");
  await ana.reload();
  await expect(head(ana)).toContainText("Voting closed");
  expect(await order(ana)).toEqual(added);
  await hostsPress(host.page, "Reopen voting", "Voting is open");
  await ana.reload();
  await expect(starOf(ana, anas[2])).toHaveAttribute("aria-pressed", "true");
  expect(await order(ana)).toEqual(anas);
  await Promise.all([host.context.close(), ana.context().close()]);
});

// Review Focus 8: a winner deleted after voting closes. The places are those of the items still
// here (ticket 15), so the strip and the ribbons follow, and no other count changes.
test("a winner deleted after voting closes", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "album-winner-deleted", PAST);
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  await addPhotos(priya, [await photo("garden.jpg", "#2f6b3a"), await photo("cake.jpg", "#c0506a"), await photo("lake.jpg", "#3a6bd0")], 3);
  const [first, second, third] = await order(priya);
  await startVoting(host.page);

  // Photo 1 has two votes, Ana's and the host's; Photo 2 one, Ben's; Photo 3 none.
  const ana = await guestGoing(browser, host.link, "Ana Ruiz");
  await vote(ana, starOf(ana, first));
  const ben = await guestGoing(browser, host.link, "Ben Okafor");
  await vote(ben, starOf(ben, second));
  await host.page.goto(host.link);
  await vote(host.page, star(host.page, "Photo 1 by Priya Nair"));
  await hostsPress(host.page, "Close voting", "Voting closed");
  await expect(strip(host.page).getByRole("img", { name: "1st: Photo 1 by Priya Nair", exact: true })).toHaveAttribute("src", first);
  await expect(strip(host.page).getByRole("img", { name: "2nd: Photo 2 by Priya Nair", exact: true })).toHaveAttribute("src", second);

  // The host deletes the item in first place, from the viewer.
  await album(host.page).getByRole("button", { name: "Photo 1 by Priya Nair", exact: true }).click();
  await host.page.getByRole("dialog", { name: "Photo 1 of 3" }).getByRole("button", { name: "Delete" }).click();
  await host.page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(items(host.page)).toHaveCount(2, { timeout: 15_000 });

  // The former second is first, in the strip and on its tile; the counts are as they were.
  for (const page of [host.page, ana]) {
    if (page === ana) await ana.reload();
    await expect(strip(page).getByRole("img")).toHaveCount(1);
    await expect(strip(page).getByRole("img", { name: "1st: Photo 1 by Priya Nair", exact: true })).toHaveAttribute("src", second);
    await expect(strip(page)).toHaveText(/1st.*1 vote/);
    await expect(tileOf(page, second).locator('[data-slot="vote-ribbon"]')).toHaveText("1st");
    await expect(album(page).locator('[data-slot="vote-ribbon"]')).toHaveCount(1);
    await expect(tileOf(page, second).locator('[data-slot="vote-count"]')).toHaveAccessibleName("1 vote");
    await expect(tileOf(page, third).locator('[data-slot="vote-count"]')).toHaveAccessibleName("0 votes");
  }
  await Promise.all([host.context.close(), priya.context().close(), ana.context().close(), ben.context().close()]);
});
