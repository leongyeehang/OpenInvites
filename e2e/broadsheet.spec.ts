import { chooseLayout, createDraft, createPublished, type DraftFields } from "./events";
import { signUpVerified } from "./hosts";
import { expect, test, type APIRequestContext, type Browser, type Page } from "./test";

// Ticket 12: the Broadsheet layout, an editorial page with one ballot. The guest's flow keeps every
// rule it has on the Poster; here it is one form. The guest drives the test's own page, so all of
// it runs at 390 pixels in the mobile project and at desktop width in the other; the host watches
// from a context of their own.

const EDIT_LINK = /^https?:\/\/\S+\/r\/\S+$/;

const SUPPER = {
  layout: "Broadsheet",
  title: "Supper at Mei’s",
  start: "2027-03-06T19:00",
  location: "12 Orchard Road",
  description: "Six courses, one long table.",
  plusOnes: "2",
  requirePlusOneNames: true,
  questions: [
    { prompt: "Starter?", type: "choice", required: true, choices: "Soup, Salad" },
    { prompt: "Which nights?", type: "multiple", choices: "Friday, Saturday, Sunday" },
  ],
} satisfies DraftFields;

// An event that asks nothing but the name.
const SIMPLE = { layout: "Broadsheet", title: "Supper at Mei’s", start: "2027-03-06T19:00", plusOnes: "0" } satisfies DraftFields;

const guestList = (page: Page) => page.locator('[data-slot="guests"]');

// A guest answers on the ballot of an event that asks only their name.
async function reply(page: Page, link: string, name: string, status: "I’ll be there" | "Maybe" = "I’ll be there") {
  await page.goto(link);
  await page.getByRole("radio", { name: status, exact: true }).check();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(page.getByText("Received", { exact: true })).toBeVisible({ timeout: 15_000 });
}

// Somebody else who has replied, on a device of their own.
async function someoneElseReplies(browser: Browser, link: string, name: string, status?: "I’ll be there" | "Maybe") {
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

test("a guest replies on the ballot: Going, two named plus-ones and the host's questions, then a received stamp, the edit link and their line in the list", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "broadsheet-flow", SUPPER);

  await page.goto(host.link);
  await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", "broadsheet");
  // The masthead, the title, and the facts under it.
  await expect(page.getByText("Invitation", { exact: true })).toBeVisible();
  await expect(page.getByText(`Hosted by ${host.name}`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Supper at Mei’s" })).toBeVisible();
  for (const fact of ["When", "Where", "Host", "Countdown"]) await expect(page.getByText(fact, { exact: true })).toBeVisible();
  await expect(page.getByText(/^Saturday, March 6, 2027.*7:00\sPM GMT\+8$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Maps" })).toBeVisible();
  await expect(page.getByText("days to go")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The details" })).toBeVisible();
  await expect(page.getByText("Six courses, one long table.")).toBeVisible();
  // The list is a reward for replying, and it is the default.
  await expect(guestList(page).getByText("RSVP to see who’s coming")).toBeVisible();

  // Only the answer is asked until the guest gives one.
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await page.getByRole("radio", { name: "I’ll be there" }).check();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "One guest more" }).click();
  await page.getByRole("button", { name: "One guest more" }).click();
  await expect(page.getByText("You can bring up to 2 people.")).toBeVisible();
  await page.getByLabel("Guest 1").fill("Arjun");
  await page.getByLabel("Guest 2").fill("Mei");
  await page.getByRole("checkbox", { name: "Friday" }).check();
  await page.getByRole("checkbox", { name: "Sunday" }).check();

  // The starter is required, and the RSVP is refused until it is given.
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(page.getByText("The host would like an answer to this one.")).toBeVisible();
  await page.getByRole("radio", { name: "Salad" }).check();
  await page.getByRole("button", { name: "Post my reply" }).click();

  const stamp = page.getByText("Received", { exact: true });
  await expect(stamp).toBeVisible();
  await expect(stamp).toHaveCSS("rotate", "-8deg");
  await expect(page.getByRole("heading", { name: "You’re going!" })).toBeVisible();
  await expect(page.getByText("Priya Nair, plus 2 more.")).toBeVisible();
  await expect(page.getByText("Bringing Arjun and Mei.")).toBeVisible();
  await expect(page.getByText(EDIT_LINK)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add to calendar" })).toBeVisible();
  // The long edit link is cut short rather than making the page wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Replying opened the list: the guest is on it, numbered, with the two they bring, marked as them.
  await expect(guestList(page).getByText("RSVP to see who’s coming")).toHaveCount(0);
  const line = guestList(page).getByRole("listitem").filter({ hasText: "Priya Nair" });
  await expect(line).toContainText("01");
  await expect(line).toContainText("+2");
  await expect(line).toContainText("you");
  await expect(page.getByText("3 people expected")).toBeVisible();

  // The host reads the answers.
  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Salad", { exact: true })).toBeVisible();
  await expect(host.page.getByText("Friday and Sunday")).toBeVisible();

  // Can't go asks nothing more, and takes the guest off the list.
  await page.getByRole("button", { name: "Change answer" }).click();
  await expect(page.getByRole("radio", { name: "I’ll be there" })).toBeFocused();
  await page.getByRole("radio", { name: "Can’t make it" }).check();
  await expect(page.getByLabel("Your name")).toHaveValue("Priya Nair");
  await expect(page.getByRole("button", { name: "One guest more" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Friday" })).toHaveCount(0);
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(page.getByRole("heading", { name: "We’ll miss you." })).toBeVisible();
  await expect(page.getByText("Priya Nair, marked as can’t go.")).toBeVisible();
  await expect(guestList(page).getByText("Priya Nair")).toHaveCount(0);
  // She was the only one to reply, so the list says nobody is coming yet rather than nothing.
  await expect(guestList(page).getByText("No one yet")).toBeVisible();

  // Amending brings back what was said.
  await page.getByRole("button", { name: "Amend reply" }).click();
  await expect(page.getByRole("radio", { name: "Can’t make it" })).toBeChecked();
  await expect(page.getByLabel("Your name")).toHaveValue("Priya Nair");
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(page.getByRole("heading", { name: "We’ll miss you." })).toBeVisible();

  // Removing the RSVP forgets the guest, on this device too.
  await page.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(page.getByText("Received", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "I’ll be there" })).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: "I’ll be there" })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "I’ll be there" })).not.toBeChecked();
  await expect(guestList(page).getByText("RSVP to see who’s coming")).toBeVisible();

  await host.context.close();
});

test("the Broadsheet's guest list follows the host's visibility setting, with maybes on a line of their own", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "broadsheet-guests", SIMPLE);
  await someoneElseReplies(browser, host.link, "Mei Lin");
  await someoneElseReplies(browser, host.link, "Tom Ong", "Maybe");

  // After replying, the default: before it, nothing of the list reaches the browser, not even a count.
  await page.goto(host.link);
  await expect(guestList(page).getByText("RSVP to see who’s coming")).toBeVisible();
  expect(await page.content()).not.toContain("Mei Lin");
  await expect(page.getByText("1 person expected")).toHaveCount(0);

  await page.getByRole("radio", { name: "I’ll be there" }).check();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Post my reply" }).click();
  // Replying unlocks it on the spot.
  await expect(guestList(page).getByRole("listitem").filter({ hasText: "Mei Lin" })).toContainText("01");
  await expect(guestList(page).getByRole("listitem").filter({ hasText: "Priya Nair" })).toContainText("02");
  await expect(guestList(page).getByText("Maybe · Tom Ong")).toBeVisible();
  await expect(guestList(page).getByRole("listitem").filter({ hasText: "Tom Ong" })).toHaveCount(0);
  await expect(page.getByText("2 people expected")).toBeVisible();

  // Shown to everyone: a visitor who has not replied sees it.
  await setGuestListVisibility(host.page, "always");
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(host.link);
  await expect(guestList(visitorPage).getByText("Mei Lin")).toBeVisible();
  await expect(guestList(visitorPage).getByText("RSVP to see who’s coming")).toHaveCount(0);
  await visitor.close();

  // Hidden: nobody sees the list or the count, even a guest who has replied.
  await setGuestListVisibility(host.page, "hidden");
  await page.reload();
  await expect(page.getByRole("heading", { name: "You’re going!" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Guests" })).toHaveCount(0);
  await expect(page.getByText("2 people expected")).toHaveCount(0);
  expect(await page.content()).not.toContain("Mei Lin");

  await host.context.close();
});

test("the host's announcements and the comments show on the Broadsheet", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "broadsheet-social", SIMPLE);

  await host.page.getByRole("link", { name: "Announcements" }).click();
  await host.page.getByLabel("Message").fill("Doors open at 6.30.");
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(host.page.getByLabel("Message")).toHaveValue("", { timeout: 15_000 });
  await host.page.goto(host.link);
  await host.page.getByLabel("Add a comment").fill("Welcome, everyone!");
  await host.page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(host.page.getByLabel("Add a comment")).toHaveValue("", { timeout: 15_000 });

  // A guest who has not replied reads the announcement, and only how many comments there are.
  await page.goto(host.link);
  const announcements = page.locator('[data-slot="announcements"]');
  await expect(announcements.getByRole("heading", { name: "From the host" })).toBeVisible();
  await expect(announcements.getByText("Doors open at 6.30.")).toBeVisible();
  const comments = page.locator('[data-slot="comments"]');
  await expect(comments.getByRole("heading", { name: "Comments" })).toBeVisible();
  await expect(comments.getByText("1 comment", { exact: true })).toBeVisible();
  await expect(comments.getByText("Reply to join the conversation")).toBeVisible();
  expect(await page.content()).not.toContain("Welcome, everyone!");

  // Once they reply, they read the host's comment and add their own.
  await page.getByRole("radio", { name: "I’ll be there" }).check();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(comments.getByRole("listitem").filter({ hasText: "Welcome, everyone!" })).toContainText("Host");
  await page.getByLabel("Add a comment").fill("Can’t wait.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(comments.getByRole("listitem").filter({ hasText: "Can’t wait." })).toContainText("Priya Nair");

  await host.context.close();
});

// What a guest's browser is sent for the page, which is the saved theme.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

test("under the Confetti effect, confetti falls over the Broadsheet when an RSVP makes the guest Going, and not for a maybe", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "broadsheet-confetti", SIMPLE);
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const drawer = host.page.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("group", { name: "Effect" }).getByRole("radio", { name: "Confetti" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('effect\\":\\"confetti');

  // It would come with the receipt, in the same paint, so none now is none at all.
  const confetti = page.locator('[data-effect="confetti"]');
  await reply(page, host.link, "Priya Nair", "Maybe");
  expect(await confetti.count()).toBe(0);
  await page.getByRole("button", { name: "Change answer" }).click();
  await page.getByRole("radio", { name: "I’ll be there" }).check();
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(page.getByRole("heading", { name: "You’re going!" })).toBeVisible();
  await expect(confetti).toBeVisible();

  await host.context.close();
});

test("the ballot's Post button wears the theme's RSVP button style, and Supper club brings the Broadsheet with it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "broadsheet-buttons", { title: "Supper at Mei’s", start: "2027-03-06T19:00", plusOnes: "0" });
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const drawer = host.page.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("radio", { name: "Supper club" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('data-layout="broadsheet"');

  const post = page.getByRole("button", { name: "Post my reply" });
  const ballot = async () => {
    await page.goto(host.link);
    await page.getByRole("radio", { name: "I’ll be there" }).check();
  };
  // Supper club's buttons are solid: the accent, its gold.
  await ballot();
  await expect(post).toHaveCSS("background-color", "rgb(255, 195, 107)");

  await drawer.getByRole("button", { name: "Details" }).click();
  const buttons = drawer.getByRole("group", { name: "RSVP buttons" });
  await buttons.getByRole("radio", { name: "Outline" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('buttonStyle\\":\\"outline');
  await ballot();
  await expect(post).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(post).toHaveCSS("border-top-width", "2px");

  await buttons.getByRole("radio", { name: "Glass" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain('buttonStyle\\":\\"glass');
  await ballot();
  await expect(post).toHaveCSS("backdrop-filter", /blur/);
  await expect(post).not.toHaveCSS("background-color", "rgb(255, 195, 107)");
  await expect(post).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await host.context.close();
});

test("a draft shows its host the draft notice, and a cancelled event the notice and a ballot that takes no reply", async ({ page, browser, request }) => {
  test.slow();
  const context = await browser.newContext();
  const hostPage = await context.newPage();
  await signUpVerified(hostPage, request, "broadsheet-states");
  const link = await createDraft(hostPage, { title: "Supper at Mei’s", start: "2027-03-06T19:00", plusOnes: "0" });
  const manage = hostPage.url();
  await chooseLayout(hostPage, link, "Broadsheet");

  await hostPage.goto(link);
  await expect(hostPage.getByText("Draft. Only you can see this page until you publish it.")).toBeVisible();
  await expect(hostPage.getByRole("radio", { name: "I’ll be there" })).toBeDisabled();
  await expect(hostPage.getByText("This invitation is not taking RSVPs.")).toBeVisible();
  await expect(hostPage.getByRole("button", { name: "Design" })).toBeVisible();

  await hostPage.goto(manage);
  await hostPage.getByRole("button", { name: "Publish" }).click();
  await expect(hostPage.getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });
  await reply(page, link, "Priya Nair");

  await hostPage.getByRole("button", { name: "Cancel event" }).click();
  await hostPage.getByRole("button", { name: "Cancel the event" }).click();
  await expect(hostPage.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });

  // The guest who replied keeps their receipt, and can no longer change their RSVP.
  await page.reload();
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expect(page.getByRole("heading", { name: "You’re going!" })).toBeVisible();
  await page.getByRole("button", { name: "Change answer" }).click();
  for (const answer of ["I’ll be there", "Maybe", "Can’t make it"]) await expect(page.getByRole("radio", { name: answer, exact: true })).toBeDisabled();
  await expect(page.getByText("This invitation is not taking RSVPs.")).toBeVisible();

  // Nor can anyone else.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(link);
  await expect(visitorPage.getByText("This event is cancelled")).toBeVisible();
  await expect(visitorPage.getByRole("radio", { name: "I’ll be there" })).toBeDisabled();
  await visitor.close();

  await context.close();
});
