import { chooseLayout, createDraft, createPublished, type DraftFields } from "./events";
import { signUpVerified } from "./hosts";
import { expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// Ticket 13: the Thread layout, the invitation as a scripted chat with the host. The guest's flow
// keeps every rule it has on the Poster; here the host asks one thing at a time and the guest
// answers with chips and a composer. The guest drives the test's own page, so all of it runs at
// 390 pixels in the mobile project and at desktop width in the other; the host works from a
// context of their own.

const EDIT_LINK = /^https?:\/\/\S+\/r\/\S+$/;

const PARTY = {
  layout: "Thread",
  title: "Ada’s party",
  start: "2027-03-06T15:00",
  location: "12 Orchard Road",
  description: "Cake, games and a bouncy castle.",
  plusOnes: "2",
  requirePlusOneNames: true,
  questions: [
    { prompt: "Any allergies?" },
    { prompt: "Which games?", type: "multiple", required: true, choices: "Tag, Treasure hunt, Piñata" },
  ],
} satisfies DraftFields;

// An event that asks nothing but the name.
const SIMPLE = { layout: "Thread", title: "Ada’s party", start: "2027-03-06T15:00", plusOnes: "0" } satisfies DraftFields;

// The conversation under the host's bubbles, which the guest's answers join.
const conversation = (page: Page) => page.getByRole("log");
const doneBubble = (page: Page) => page.locator('[data-slot="done"]');
const whoIsComing = (page: Page) => page.locator('[data-slot="guests"]');

// A guest answers an event that asks only their name.
async function reply(page: Page, link: string, name: string, status: "Going" | "Maybe" = "Going") {
  await page.goto(link);
  await page.getByRole("button", { name: status, exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(doneBubble(page)).toBeVisible({ timeout: 15_000 });
}

// Somebody else who has replied, on a device of their own.
async function someoneElseReplies(browser: Browser, link: string, name: string, status?: "Going" | "Maybe") {
  const context = await browser.newContext();
  await reply(await context.newPage(), link, name, status);
  await context.close();
}

// On the event's manage page, opened afresh so that "Saved." can only be this change's.
async function setGuestListVisibility(hostPage: Page, who: "always" | "afterReply" | "hidden") {
  await hostPage.reload();
  await hostPage.getByLabel("Who can see the guest list").selectOption(who);
  await hostPage.getByRole("button", { name: "Save changes" }).click();
  await expect(hostPage.getByText("Saved.")).toBeVisible();
}

// Notes whether the typing dots show, however briefly, before the host's next line.
async function watchForTyping(page: Page) {
  await page.evaluate(() => {
    const seen = window as unknown as { typedBefore: boolean };
    seen.typedBefore = false;
    const log = document.querySelector('[role="log"]')!;
    new MutationObserver((_, observer) => {
      if (!log.querySelector('[data-slot="typing"]')) return;
      seen.typedBefore = true;
      observer.disconnect();
    }).observe(log, { childList: true });
  });
}

// What a guest's browser is sent for the page, which is the saved theme.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

test("a guest replies in the conversation: Going with a named plus-one, a question skipped and two picks, then the done bubble by their first name and the edit link copied", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const host = await createPublished(browser, request, "thread-flow", PARTY);

  await page.goto(host.link);
  await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", "thread");
  // The header names the host. How many have replied is not given away before the guest replies.
  await expect(page.locator("header").getByText(host.name, { exact: true })).toBeVisible();
  await expect(page.locator("header").getByText("Invitation", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Invitation sent \w{3} \d{1,2}$/)).toBeVisible();
  // The host's bubbles: the card, the description, when, where, who's coming, and the ask.
  await expect(page.getByRole("heading", { level: 1, name: "Ada’s party" })).toBeVisible();
  await expect(page.getByText("You’re invited", { exact: true })).toBeVisible();
  await expect(page.getByText("Cake, games and a bouncy castle.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "When" })).toBeVisible();
  await expect(page.getByText(/^Starts in \d+ days$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Maps" })).toBeVisible();
  await expect(whoIsComing(page).getByText("Reply to see names")).toBeVisible();
  await expect(conversation(page).getByText("So, can you make it?", { exact: true })).toBeVisible();
  // The page opens at the invitation, not at the foot of the conversation.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Going: the guest's own words, then the host, seen typing first, asks their name.
  await watchForTyping(page);
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await expect(conversation(page).getByText("I’m in!", { exact: true })).toBeVisible();
  await expect(conversation(page).getByText("Yay! What should I call you?", { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="typing"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { typedBefore: boolean }).typedBefore)).toBe(true);
  const name = page.getByLabel("Your name");
  await expect(name).toBeFocused();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await name.fill("Priya Nair");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  // By her first name, up to as many as the host allows, and each one's name since the host asks.
  await expect(conversation(page).getByText("Priya Nair", { exact: true })).toBeVisible();
  await expect(conversation(page).getByText("Lovely, Priya. Bringing anyone? You can bring up to 2 people.", { exact: true })).toBeVisible();
  for (const chip of ["Just me", "+1", "+2"]) await expect(page.getByRole("button", { name: chip, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+1", exact: true }).click();
  await expect(conversation(page).getByText("I’ll bring 1", { exact: true })).toBeVisible();
  await expect(conversation(page).getByText("What’s your first guest’s name?", { exact: true })).toBeVisible();
  await page.getByLabel("Guest 1").fill("Arjun");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  // The optional question is skipped; the required one waits for a pick, and takes two.
  await expect(conversation(page).getByText("Any allergies? (skip if none)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(conversation(page).getByText("I’ll skip this one", { exact: true })).toBeVisible();
  await expect(conversation(page).getByText("Which games?", { exact: true })).toBeVisible();
  const done = page.getByRole("button", { name: "Done", exact: true });
  await expect(done).toBeDisabled();
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await page.getByRole("button", { name: "Piñata", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tag", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Treasure hunt", exact: true })).toHaveAttribute("aria-pressed", "false");
  await done.click();
  await expect(conversation(page).getByText("Tag and Piñata", { exact: true })).toBeVisible();

  // The done bubble, by her first name, with the calendar and the edit link, shown as text, since
  // a browser opened from a chat app may not copy it, and copied by its chip.
  await expect(doneBubble(page)).toContainText("You’re in, Priya! Can’t wait. Here’s your private link to change anything later. It’s saved in this browser too.", {
    timeout: 15_000,
  });
  await expect(doneBubble(page)).toBeInViewport();
  await expect(doneBubble(page).getByRole("link", { name: "Add to calendar" })).toBeVisible();
  const shownLink = doneBubble(page).getByText(EDIT_LINK);
  await expect(shownLink).toBeVisible();
  await doneBubble(page).getByRole("button", { name: "Copy edit link" }).click();
  await expect(doneBubble(page).getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe((await shownLink.textContent())!.trim());
  for (const action of ["Change my answer", "Edit my details", "Remove my RSVP"]) await expect(page.getByRole("button", { name: action })).toBeVisible();
  // Nothing on the page is wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Replying opened the list: she is on it, with the one she brings, marked as her.
  const line = whoIsComing(page).getByRole("listitem").filter({ hasText: "Priya Nair" });
  await expect(line).toContainText("(you)");
  await expect(line).toContainText("+1");
  await expect(line).toContainText("Going");
  await expect(page.locator("header").getByText("Invitation · 1 reply", { exact: true })).toBeVisible();

  // Coming back, the whole conversation is there at once.
  await page.reload();
  await expect(conversation(page).getByText("Tag and Piñata", { exact: true })).toBeVisible();
  await expect(doneBubble(page)).toContainText("You’re in, Priya!");
  await expect(page.locator('[data-slot="typing"]')).toHaveCount(0);

  // The host reads the answers.
  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Tag and Piñata")).toBeVisible();
  await expect(host.page.getByText("Arjun")).toBeVisible();

  await host.context.close();
});

test("a guest who can't go is asked only their name, then reads the done bubble", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "thread-cant", PARTY);
  await page.goto(host.link);
  await page.getByRole("button", { name: "Can’t go", exact: true }).click();
  await expect(conversation(page).getByText("Sadly I can’t make it", { exact: true })).toBeVisible();
  await expect(conversation(page).getByText("No worries at all. Who’s this, so I can note it?", { exact: true })).toBeVisible();
  // Enter sends the name.
  await page.getByLabel("Your name").fill("Mei Lin");
  await page.getByLabel("Your name").press("Enter");
  await expect(doneBubble(page)).toContainText("Sorry to miss you, Mei. If plans change, just reply again.", { timeout: 15_000 });
  await expect(conversation(page).getByText(/Bringing anyone/)).toHaveCount(0);
  await expect(conversation(page).getByText(/Any allergies/)).toHaveCount(0);
  // Nothing to put in a calendar for a guest who is not coming.
  await expect(doneBubble(page).getByRole("link", { name: "Add to calendar" })).toHaveCount(0);
  await host.context.close();
});

test("from the done bubble a guest changes their answer, edits their details, and removes their RSVP", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "thread-change", SIMPLE);
  await reply(page, host.link, "Priya Nair");
  await expect(doneBubble(page)).toContainText("You’re in, Priya!");

  // Changing the answer goes back to the ask, the focus on the answer given before.
  await page.getByRole("button", { name: "Change my answer" }).click();
  await expect(doneBubble(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Going", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(conversation(page).getByText("Maybe, let me check", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Priya Nair");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(doneBubble(page)).toContainText("Noted as a maybe, Priya. Come back here when you know.", { timeout: 15_000 });

  // Editing the details asks the name again, with the one given.
  await page.getByRole("button", { name: "Edit my details" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Priya Nair");
  await page.getByLabel("Your name").fill("Priya N.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(doneBubble(page)).toContainText("Noted as a maybe, Priya.", { timeout: 15_000 });
  await expect(whoIsComing(page).getByRole("listitem").filter({ hasText: "Priya N." })).toContainText("Maybe");

  // Removing the RSVP forgets the guest, on this device too, and the focus goes to the first answer.
  await page.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(doneBubble(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Going", exact: true })).toBeFocused();
  await page.reload();
  await expect(conversation(page).getByText("So, can you make it?", { exact: true })).toBeVisible();
  await expect(conversation(page).getByText("Maybe, let me check")).toHaveCount(0);
  await expect(whoIsComing(page).getByText("Reply to see names")).toBeVisible();

  await host.context.close();
});

test("who's coming follows the host's visibility setting: locked before replying, open after, and nowhere when hidden", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "thread-guests", SIMPLE);
  await someoneElseReplies(browser, host.link, "Mei Lin");
  await someoneElseReplies(browser, host.link, "Tom Ong", "Maybe");

  // After replying, the default: before it, neither the names nor how many reach the browser.
  await page.goto(host.link);
  await expect(whoIsComing(page).getByText("Reply to see names")).toBeVisible();
  expect(await page.content()).not.toContain("Mei Lin");
  await expect(page.locator("header").getByText("Invitation", { exact: true })).toBeVisible();
  await expect(page.getByText(/replies/)).toHaveCount(0);

  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // Replying opens it on the spot: names and what each said.
  await expect(whoIsComing(page).getByRole("listitem").filter({ hasText: "Mei Lin" })).toContainText("Going");
  await expect(whoIsComing(page).getByRole("listitem").filter({ hasText: "Tom Ong" })).toContainText("Maybe");
  await expect(whoIsComing(page).getByRole("listitem").filter({ hasText: "Priya Nair" })).toContainText("(you)");
  await expect(whoIsComing(page).getByText("2 people expected")).toBeVisible();
  await expect(page.locator("header").getByText("Invitation · 3 replies", { exact: true })).toBeVisible();

  // Shown to everyone: a visitor who has not replied sees it.
  await setGuestListVisibility(host.page, "always");
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(host.link);
  await expect(whoIsComing(visitorPage).getByText("Mei Lin")).toBeVisible();
  await expect(whoIsComing(visitorPage).getByText("Reply to see names")).toHaveCount(0);
  await visitor.close();

  // Hidden: no bubble and no count, even for a guest who has replied.
  await setGuestListVisibility(host.page, "hidden");
  await page.reload();
  await expect(doneBubble(page)).toBeVisible();
  await expect(whoIsComing(page)).toHaveCount(0);
  await expect(page.getByText("2 people expected")).toHaveCount(0);
  await expect(page.locator("header").getByText("Invitation", { exact: true })).toBeVisible();
  expect(await page.content()).not.toContain("Mei Lin");

  await host.context.close();
});

test("the host's announcements arrive as dated bubbles, and the comments as one bubble that opens once the guest replies", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "thread-social", SIMPLE);

  await host.page.getByRole("link", { name: "Announcements" }).click();
  await host.page.getByLabel("Message").fill("Doors open at 2.30.");
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(host.page.getByLabel("Message")).toHaveValue("", { timeout: 15_000 });
  await host.page.goto(host.link);
  await host.page.locator('[data-slot="comments"] summary').click();
  await host.page.getByLabel("Add a comment").fill("Welcome, everyone!");
  await host.page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(host.page.getByLabel("Add a comment")).toHaveValue("", { timeout: 15_000 });

  // A guest who has not replied reads the announcement, and only how many comments there are.
  await page.goto(host.link);
  const announcement = page.locator('[data-slot="announcement"]');
  await expect(announcement).toContainText("From the host");
  await expect(announcement.getByText("Doors open at 2.30.")).toBeVisible();
  const comments = page.locator('[data-slot="comments"]');
  await expect(comments.getByText("1 comment", { exact: true })).toBeVisible();
  await expect(comments.getByText("Reply to join the conversation")).toBeVisible();
  expect(await page.content()).not.toContain("Welcome, everyone!");

  // Once they reply, the bubble opens on the host's comment, and they add their own.
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(doneBubble(page)).toBeVisible({ timeout: 15_000 });
  await comments.getByText("1 comment", { exact: true }).click();
  await expect(comments.getByRole("listitem").filter({ hasText: "Welcome, everyone!" })).toContainText("Host");
  await page.getByLabel("Add a comment").fill("Can’t wait.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(comments.getByRole("listitem").filter({ hasText: "Can’t wait." })).toContainText("Priya Nair", { timeout: 15_000 });

  await host.context.close();
});

test("Kids' party brings the Thread with it, its chips wear the theme's button style, and confetti falls for a Going", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "thread-buttons", { title: "Ada’s party", start: "2027-03-06T15:00", plusOnes: "0" });
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const drawer = host.page.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("radio", { name: "Kids’ party" }).check();
  await expect(drawer.getByRole("group", { name: "Layout" }).getByRole("radio", { name: /^Thread/ })).toBeChecked();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-layout="thread"');

  // Kids' party's buttons are solid: the accent, its coral.
  const going = page.getByRole("button", { name: "Going", exact: true });
  await page.goto(host.link);
  await expect(going).toHaveCSS("background-color", "rgb(255, 122, 89)");

  // Its effect is confetti, which falls as the done bubble arrives.
  const confetti = page.locator('[data-effect="confetti"]');
  await going.click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(doneBubble(page)).toBeVisible({ timeout: 15_000 });
  await expect(confetti).toBeVisible();

  await drawer.getByRole("button", { name: "Details" }).click();
  const buttons = drawer.getByRole("group", { name: "RSVP buttons" });
  await buttons.getByRole("radio", { name: "Outline" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('buttonStyle\\":\\"outline');
  const change = page.getByRole("button", { name: "Change my answer" });
  await page.reload();
  await expect(change).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(change).toHaveCSS("border-top-width", "2px");

  await buttons.getByRole("radio", { name: "Glass" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('buttonStyle\\":\\"glass');
  await page.reload();
  await expect(change).toHaveCSS("backdrop-filter", /blur/);

  await host.context.close();
});

test("a draft shows its host the draft line, and a cancelled event says it is closed and offers no chips", async ({ page, browser, request }) => {
  test.slow();
  const context = await browser.newContext();
  const hostPage = await context.newPage();
  await signUpVerified(hostPage, request, "thread-states");
  const link = await createDraft(hostPage, { title: "Ada’s party", start: "2027-03-06T15:00", plusOnes: "0" });
  const manage = hostPage.url();
  await chooseLayout(hostPage, link, "Thread");

  await hostPage.goto(link);
  await expect(hostPage.getByText("Draft. Only the hosts can see this page until you publish it.")).toBeVisible();
  await expect(hostPage.getByRole("log").getByText("Publish the event to start collecting RSVPs.", { exact: true })).toBeVisible();
  await expect(hostPage.getByRole("button", { name: "Going", exact: true })).toHaveCount(0);
  await expect(hostPage.getByRole("button", { name: "Design" })).toBeVisible();

  await hostPage.goto(manage);
  await hostPage.getByRole("button", { name: "Publish" }).click();
  await expect(hostPage.getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });
  await reply(page, link, "Priya Nair");

  await hostPage.getByRole("button", { name: "Cancel event" }).click();
  await hostPage.getByRole("button", { name: "Cancel the event" }).click();
  await expect(hostPage.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });

  // The guest who replied keeps their conversation, and is told the event is closed after it;
  // what they can do from there is what the Poster offers them.
  await page.reload();
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expect(doneBubble(page)).toContainText("You’re in, Priya!");
  await expect(conversation(page).getByText("RSVPs are closed for this event.", { exact: true })).toBeVisible();
  for (const action of ["Change my answer", "Edit my details", "Remove my RSVP"]) await expect(page.getByRole("button", { name: action })).toBeVisible();
  await page.getByRole("button", { name: "Change my answer" }).click();
  await expect(conversation(page).getByText("RSVPs are closed for this event.", { exact: true })).toBeVisible();
  for (const status of ["Going", "Maybe", "Can’t go"]) await expect(page.getByRole("button", { name: status, exact: true })).toHaveCount(0);

  // Nor can anyone else reply.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(link);
  await expect(visitorPage.getByText("This event is cancelled")).toBeVisible();
  await expect(visitorPage.getByRole("log").getByText("RSVPs are closed for this event.", { exact: true })).toBeVisible();
  await expect(visitorPage.getByRole("button", { name: "Going", exact: true })).toHaveCount(0);
  await visitor.close();

  await context.close();
});
