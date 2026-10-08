import { createPublished } from "./events";
import { MAILPIT, latestMailTo, mailCountTo } from "./hosts";
import { expect, test, type APIRequestContext, type Page } from "./test";

// Ticket 06: guests who have replied, and the hosts, comment on the event page; a guest who has not
// replied sees how many there are; a guest deletes their own and a host any; the hosts are emailed;
// the host can turn comments off; a cancelled event keeps them and takes no more; and posting too
// often is refused. Mail is read in Mailpit; each host has an address of their own.

const EVENT = {
  rsvpStyle: "Inline",
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  plusOnes: "0",
} as const;

// RATE_LIMIT_COMMENT, which the Compose dev and test profiles and .env.development leave at its
// default, 30 a ten minutes.
const COMMENT_LIMIT = 30;

// A guest answers Going on the page already open, which then shows them the comments.
async function reply(page: Page, link: string, name: string) {
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Add a comment")).toBeVisible();
}

// Posts a comment and waits until the box has emptied, which it does once the comment is posted.
async function comment(page: Page, text: string) {
  const box = page.getByLabel("Add a comment");
  await box.fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });
}

// One comment on the page, found by its first line.
function commentSaying(page: Page, text: string) {
  return page.getByRole("listitem").filter({ hasText: text });
}

// Once it has gone, with its Delete button, the focus is on the section's heading rather than lost
// to the document.
async function deleteComment(page: Page, text: string) {
  await commentSaying(page, text).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(commentSaying(page, text)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Comments" })).toBeFocused();
}

async function subjectOfLatestMailTo(request: APIRequestContext, email: string): Promise<string | undefined> {
  const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  const { messages } = (await search.json()) as { messages: { Subject: string }[] };
  return messages[0]?.Subject;
}

test("a guest who has not replied sees how many comments there are; once they reply they comment under their name, and the host is emailed", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "comments", EVENT);

  // The host comments first, from their own page, marked as the host.
  await host.page.goto(host.link);
  await comment(host.page, "Welcome, everyone!");
  const welcome = commentSaying(host.page, "Welcome, everyone!");
  await expect(welcome).toContainText(host.name);
  await expect(welcome.getByText("Host", { exact: true })).toBeVisible();

  // A guest who has not replied is told how many there are and that replying opens them, and is
  // sent none of them.
  await page.goto(host.link);
  await expect(page.getByRole("heading", { name: "Comments" })).toBeVisible();
  await expect(page.getByText("1 comment", { exact: true })).toBeVisible();
  await expect(page.getByText("Reply to join the conversation")).toBeVisible();
  expect(await page.content()).not.toContain("Welcome, everyone!");
  await expect(page.getByLabel("Add a comment")).toHaveCount(0);

  // Once they reply, they read the host's comment and post their own, under their RSVP's name and
  // with its line break.
  await reply(page, host.link, "Priya Nair");
  await expect(commentSaying(page, "Welcome, everyone!").getByText("Host", { exact: true })).toBeVisible();
  await comment(page, "I’ll bring the cake.\nAnd candles.");
  const cake = commentSaying(page, "I’ll bring the cake.");
  await expect(cake).toContainText("Priya Nair");
  await expect(cake.getByText("Host", { exact: true })).toHaveCount(0);
  expect(await cake.getByText("I’ll bring the cake.").innerText()).toBe("I’ll bring the cake.\nAnd candles.");
  // In the order they were posted.
  await expect(page.getByRole("listitem").filter({ hasText: /Welcome, everyone!|I’ll bring the cake\./ })).toHaveText([
    /Welcome, everyone!/,
    /I’ll bring the cake\./,
  ]);

  // The host is emailed about the guest's comment: who, what, and the event link. Their own comment
  // came first and queued nothing: mail goes out in the order it was queued, so an email about it
  // would be in the inbox before this one, beside the verification from signing up and the email
  // about Priya's reply.
  await expect
    .poll(() => subjectOfLatestMailTo(request, host.email), { timeout: 30_000, message: `an email to ${host.email} about Priya’s comment` })
    .toBe("Priya Nair commented on Ada’s birthday");
  expect(await mailCountTo(request, host.email)).toBe(3);
  const [said, words, where, footer, ...rest] = (await latestMailTo(request, host.email, 2)).replace(/\r\n/g, "\n").trimEnd().split("\n\n");
  expect(said).toBe("Priya Nair commented on Ada’s birthday:");
  expect(words).toBe("I’ll bring the cake.\nAnd candles.");
  expect(where).toBe(`The event page:\n${host.link}`);
  expect(footer).toBe("To stop these emails, untick “Email me when a guest comments” in the event’s settings.");
  expect(rest).toEqual([]);

  await host.context.close();
});

test("a guest deletes their own comment and cannot delete the host's; the host deletes the guest's", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "comments-delete", EVENT);
  await host.page.goto(host.link);
  await comment(host.page, "Doors open at seven.");

  await reply(page, host.link, "Priya Nair");
  await comment(page, "See you there!");
  await expect(commentSaying(page, "Doors open at seven.").getByRole("button", { name: "Delete" })).toHaveCount(0);

  // Their own goes once they confirm. Each Delete says whose comment it takes, and when it was
  // posted; kept, the focus goes back to it.
  const own = commentSaying(page, "See you there!").getByRole("button", { name: "Delete" });
  await expect(own).toHaveAccessibleName(/^Delete Priya Nair’s comment from \S.+$/);
  await own.click();
  await expect(page.getByRole("alertdialog")).toContainText("Delete this comment?");
  await page.getByRole("alertdialog").getByRole("button", { name: "Never mind" }).click();
  await expect(commentSaying(page, "See you there!")).toBeVisible();
  await expect(own).toBeFocused();
  await deleteComment(page, "See you there!");
  await page.reload();
  await expect(commentSaying(page, "Doors open at seven.")).toBeVisible();
  await expect(commentSaying(page, "See you there!")).toHaveCount(0);

  // The host takes down what the guest says next, and it is gone for the guest too.
  await comment(page, "Can I bring my dog?");
  await host.page.reload();
  await expect(commentSaying(host.page, "Doors open at seven.").getByRole("button", { name: "Delete" })).toBeVisible();
  await deleteComment(host.page, "Can I bring my dog?");
  await page.reload();
  await expect(commentSaying(page, "Doors open at seven.")).toBeVisible();
  await expect(commentSaying(page, "Can I bring my dog?")).toHaveCount(0);

  await host.context.close();
});

test("comments turned off take the section off the page, for guests and hosts alike", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "comments-off", EVENT);
  const manage = host.page.url();
  await page.goto(host.link);
  await expect(page.getByText("No comments yet", { exact: true })).toBeVisible();

  await host.page.getByLabel("Comments", { exact: true }).uncheck();
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comments" })).toHaveCount(0);
  await expect(page.getByText("No comments yet")).toHaveCount(0);
  await host.page.goto(host.link);
  await expect(host.page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: "Comments" })).toHaveCount(0);

  // The setting is kept as the host left it.
  await host.page.goto(manage);
  await expect(host.page.getByLabel("Comments", { exact: true })).not.toBeChecked();

  await host.context.close();
});

test("a cancelled event shows its comments and takes no more", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "comments-cancel", EVENT);
  const manage = host.page.url();
  await host.page.goto(host.link);
  await comment(host.page, "Doors open at seven.");
  await reply(page, host.link, "Priya Nair");
  await comment(page, "See you there!");

  await host.page.goto(manage);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expect(commentSaying(page, "Doors open at seven.")).toBeVisible();
  await expect(commentSaying(page, "See you there!")).toBeVisible();
  await expect(page.getByLabel("Add a comment")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Post", exact: true })).toHaveCount(0);
  await host.page.goto(host.link);
  await expect(commentSaying(host.page, "See you there!")).toBeVisible();
  await expect(host.page.getByLabel("Add a comment")).toHaveCount(0);

  await host.context.close();
});

test("the 31st comment in ten minutes from one address is refused as too fast", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "comments-rate", EVENT);
  await reply(page, host.link, "Priya Nair");
  for (let posted = 1; posted <= COMMENT_LIMIT; posted++) await comment(page, `Comment ${posted}`);
  await expect(commentSaying(page, `Comment ${COMMENT_LIMIT}`)).toBeVisible();

  // One more is one too many. The words stay, with the reason under them, and nothing is posted.
  const box = page.getByLabel("Add a comment");
  await box.fill("One more thing");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("You’re going too fast. Try again shortly.", { timeout: 15_000 });
  await expect(box).toHaveValue("One more thing");
  await page.reload();
  await expect(commentSaying(page, `Comment ${COMMENT_LIMIT}`)).toBeVisible();
  await expect(commentSaying(page, "One more thing")).toHaveCount(0);

  await host.context.close();
});
