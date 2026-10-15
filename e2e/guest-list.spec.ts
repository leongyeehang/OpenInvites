import { expect, test, type Browser, type Page } from "./test";
import { createPublished } from "./events";

// The guest drives the test's own page; the host watches from a context of their own, so both
// sides of every change are seen at once.

// A guest answering an event that allows no plus-ones, which is one step and one button.
async function rsvp(page: Page, link: string, name: string) {
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
}

// Somebody else who has already replied, so the list has a name in it that is not the reader's.
async function someoneElseReplies(browser: Browser, link: string, name: string) {
  const context = await browser.newContext();
  await rsvp(await context.newPage(), link, name);
  await context.close();
}

test("a reply appears on the host's open guest list without them touching anything", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-live", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });

  await host.page.getByRole("link", { name: "Guest list" }).click();
  await expect(host.page.getByRole("heading", { name: "Guest list" })).toBeVisible();
  await expect(host.page.getByText("Nobody has replied yet.")).toBeVisible();

  await rsvp(page, host.link, "Priya Nair");

  // No reload here: the page refreshes itself while the host watches.
  await expect(host.page.getByText("Priya Nair")).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByText("1 person expected · 1 going · 0 maybe · 0 can’t go")).toBeVisible();
  await expect(host.page.getByRole("heading", { name: /^Going \(1\)/ })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: /^Maybe \(0\)/ })).toBeVisible();

  await host.context.close();
});

test("the host sees every guest's details, grouped by what they answered", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-details", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "2",
    askEmail: true,
  });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByLabel("Email").fill("priya@example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "+1" }).click();
  await page.getByLabel("Guest 1").fill("Arjun");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  const going = host.page.getByRole("region", { name: /^Going/ });
  await expect(going.getByText("Priya Nair")).toBeVisible();
  await expect(going.getByText("1 plus-one")).toBeVisible();
  await expect(going.getByText("Bringing Arjun.")).toBeVisible();
  await expect(going.getByText("priya@example.test")).toBeVisible();
  await expect(going.getByText(/^Replied /)).toBeVisible();
  await expect(host.page.getByText("2 people expected")).toBeVisible();

  await host.context.close();
});

test("a guest's edit token never travels to the host's browser", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-token", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });

  await rsvp(page, host.link, "Priya Nair");
  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Priya Nair")).toBeVisible();

  // The rows reach a client component, so every column selected for them is serialised into
  // this page. The guest's edit token is theirs alone and is never among them.
  const source = await host.page.content();
  // A column that is passed proves the serialisation is visible here at all, so the absence of
  // the token below means something.
  expect(source).toContain("plusOneNames");
  expect(source).not.toContain("editTokenHash");
  expect(source).not.toContain("edit_token_hash");

  await host.context.close();
});

test("the host changes a guest's answer, and that guest's edit link still works", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-edit", {
    // Inline, so the confirmation is in place of the buttons when the guest comes back.
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "2",
  });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Just me" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
  const editLink = (await page.getByText(/^https?:\/\/\S+\/r\/\S+$/).textContent())!.trim();

  await host.page.goto(`${host.page.url()}/guests`);
  await host.page.getByRole("button", { name: "Edit" }).click();

  // "Put me down for one more", said in person.
  await host.page.getByLabel("Plus-ones").selectOption("1");
  await host.page.getByLabel("Guest 1").fill("Arjun");
  await host.page.getByRole("button", { name: "Save" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();
  await expect(host.page.getByText("Bringing Arjun.")).toBeVisible();
  await expect(host.page.getByText("2 people expected")).toBeVisible();

  // The open form still holds what was stored, so a second save cannot post stale values.
  await expect(host.page.getByLabel("Plus-ones")).toHaveValue("1");
  await expect(host.page.getByLabel("Guest 1")).toHaveValue("Arjun");

  // And then they are only a maybe, so nobody is expected at all.
  await host.page.getByLabel("Status").selectOption("maybe");
  await host.page.getByRole("button", { name: "Save" }).click();
  await expect(host.page.getByRole("heading", { name: /^Maybe \(1\)/ })).toBeVisible();
  await expect(host.page.getByText("No one expected yet")).toBeVisible();
  await expect(host.page.getByText("Bringing Arjun.")).toBeVisible();

  // The guest sees the host's change, and the link they were given still opens their RSVP.
  await page.reload();
  await expect(page.getByText("You’re a maybe.")).toBeVisible();
  await expect(page.getByText("Bringing Arjun.")).toBeVisible();

  const elsewhere = await browser.newContext();
  const elsewherePage = await elsewhere.newPage();
  await elsewherePage.goto(editLink);
  await expect(elsewherePage.getByText("You’re a maybe.")).toBeVisible();
  await elsewhere.close();

  await host.context.close();
});

test("the host removes a guest and the guest's page forgets them", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-remove", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });

  await rsvp(page, host.link, "Priya Nair");

  await host.page.goto(`${host.page.url()}/guests`);
  await host.page.getByRole("button", { name: "Edit" }).click();
  await host.page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(host.page.getByText("Remove Priya Nair?")).toBeVisible();
  await host.page.getByRole("button", { name: "Remove guest" }).click();
  await expect(host.page.getByText("Nobody has replied yet.")).toBeVisible();
  // The Remove button went with the guest, so the focus is on the page's heading rather than lost.
  await expect(host.page.getByRole("heading", { level: 1, name: "Guest list" })).toBeFocused();

  await page.reload();
  await expect(page.getByText("You’re going!")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Going" })).toBeEnabled();

  await host.context.close();
});

test("the guest list is a reward for replying, which is the default", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-locked", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });
  await someoneElseReplies(browser, host.link, "Mei Lin");

  await page.goto(host.link);
  await expect(page.getByText("RSVP to see who’s coming")).toBeVisible();
  // Locked means locked: the names are not in the page at all, not merely blurred over.
  expect(await page.content()).not.toContain("Mei Lin");

  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Send RSVP" }).click();

  // Answering unlocks it on the spot, with no reload.
  await expect(page.getByText("Mei Lin")).toBeVisible();
  await expect(page.getByText("2 people expected")).toBeVisible();
  await expect(page.getByText("RSVP to see who’s coming")).toHaveCount(0);

  await host.context.close();
});

test("a host who shows the list to everyone shows it before anyone replies", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-always", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });
  await someoneElseReplies(browser, host.link, "Mei Lin");

  await host.page.getByLabel("Who can see the guest list").selectOption("always");
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();

  await page.goto(host.link);
  await expect(page.getByText("Mei Lin")).toBeVisible();
  await expect(page.getByText("1 person expected")).toBeVisible();
  await expect(page.getByText("RSVP to see who’s coming")).toHaveCount(0);

  await host.context.close();
});

test("a host who hides the list shows nothing, even to a guest who has replied", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "guests-hidden", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });
  await someoneElseReplies(browser, host.link, "Mei Lin");

  await host.page.getByLabel("Who can see the guest list").selectOption("hidden");
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();

  await rsvp(page, host.link, "Priya Nair");
  await expect(page.getByRole("heading", { name: "Guests" })).toHaveCount(0);
  await expect(page.getByText("RSVP to see who’s coming")).toHaveCount(0);
  expect(await page.content()).not.toContain("Mei Lin");

  // The host still sees everyone on their own list.
  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Mei Lin")).toBeVisible();
  await expect(host.page.getByText("Priya Nair")).toBeVisible();

  await host.context.close();
});
