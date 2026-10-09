import { expect, test, type Page } from "./test";
import { createPublished } from "./events";

// The guest drives the test's own page; the host watches from a context of their own.

const STARTER = { prompt: "Starter?", type: "choice", required: true, choices: "Soup, Salad" } as const;
const NEEDS = { prompt: "Any dietary needs?", type: "text" } as const;

async function answerName(page: Page, link: string, name: string, status = "Going") {
  await page.goto(link);
  await page.getByRole("button", { name: status }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: status === "Can’t go" ? "Send RSVP" : "Continue" }).click();
}

test("a guest answers the host's questions, and only the host reads them", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-answer", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [STARTER, NEEDS],
  });

  await answerName(page, host.link, "Priya Nair");
  await expect(page.getByText("A couple of questions")).toBeVisible();
  // The host's order is the guest's order, and the required one is marked.
  await expect(page.locator('[data-slot="questions"] > li').first()).toContainText("Starter?");
  await expect(page.getByText("Any dietary needs? · Optional")).toBeVisible();

  // A required question blocks the send until it is answered.
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("The host would like an answer to this one.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Soup" })).toBeVisible();

  await page.getByRole("radio", { name: "Soup" }).click();
  await page.getByLabel("Any dietary needs?").fill("No nuts");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  // Answers belong to the host alone: they are not on the page the guest is looking at.
  const guestPage = await page.content();
  expect(guestPage).not.toContain("No nuts");

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Soup")).toBeVisible();
  await expect(host.page.getByText("No nuts")).toBeVisible();

  await host.context.close();
});

test("a guest who can’t go is never asked the questions", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-cant", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [STARTER],
  });

  await answerName(page, host.link, "Mei Lin", "Can’t go");
  await expect(page.getByText("We’ll miss you.")).toBeVisible();
  await expect(page.getByText("A couple of questions")).toHaveCount(0);

  await host.context.close();
});

test("coming back to change an answer brings back what was said before", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-edit", {
    // Inline, so the confirmation is in place of the buttons when the guest comes back.
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [NEEDS],
  });

  await answerName(page, host.link, "Priya Nair");
  await page.getByLabel("Any dietary needs?").fill("No nuts");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Any dietary needs?")).toHaveValue("No nuts");

  await host.context.close();
});

test("reordering the host's questions reorders them for the guest", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-order", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [NEEDS, { prompt: "Song request?", type: "text" }],
  });

  await answerName(page, host.link, "Priya Nair");
  await expect(page.locator('[data-slot="questions"] > li').first()).toContainText("Any dietary needs?");

  await host.page.locator("form ol > li").nth(1).getByRole("button", { name: "Move up" }).click();
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await answerName(page, host.link, "Priya Nair");
  await expect(page.locator('[data-slot="questions"] > li').first()).toContainText("Song request?");

  await host.context.close();
});

test("a guest is not locked out when the host rewrites a question they answered", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-rewrite", {
    // Inline, so the confirmation is in place of the buttons when the guest comes back.
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [{ prompt: "Starter?", type: "choice", choices: "Soup, Salad" }],
  });

  await answerName(page, host.link, "Priya Nair");
  await page.getByRole("radio", { name: "Soup" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.getByLabel("Question 1 choices").fill("Bread, Rice");
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();

  // The answer nobody offers any more is forgotten rather than carried into every save.
  await page.reload();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("radio", { name: "Soup" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Bread" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.context.close();
});

test("removing a question that guests have answered says what it costs", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-remove", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [NEEDS],
  });

  await answerName(page, host.link, "Priya Nair");
  await page.getByLabel("Any dietary needs?").fill("No nuts");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.reload();
  await host.page.getByRole("button", { name: "Remove question" }).click();
  await expect(host.page.getByText("Remove “Any dietary needs?”?")).toBeVisible();
  await expect(host.page.getByText("One guest has answered it, and that answer goes too.")).toBeVisible();
  await host.page.getByRole("button", { name: "Remove question" }).last().click();
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Priya Nair")).toBeVisible();
  await expect(host.page.getByText("No nuts")).toHaveCount(0);

  await host.context.close();
});

test("a host can add a question while creating the event", async ({ page, request, browser }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-create", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [{ prompt: "Staying over?", type: "yesNo" }],
  });

  await answerName(page, host.link, "Priya Nair");
  await page.getByRole("radio", { name: "Yes" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Staying over?")).toBeVisible();
  await expect(host.page.getByText("yes", { exact: true })).toBeVisible();

  await host.context.close();
});

test("a required multiple-choice question wants one pick, and two picks read joined in the guest list", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-multiple", {
    title: "Ada’s conference",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [{ prompt: "Which sessions?", type: "multiple", required: true, choices: "Keynote, Workshop, Panel" }],
  });

  await answerName(page, host.link, "Priya Nair");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("The host would like an answer to this one.")).toBeVisible();

  // A pick can be taken back by tapping it again, and a required question is blocked again.
  await page.getByRole("checkbox", { name: "Workshop" }).check();
  await page.getByRole("checkbox", { name: "Workshop" }).uncheck();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("The host would like an answer to this one.")).toBeVisible();

  await page.getByRole("checkbox", { name: "Keynote" }).check();
  await page.getByRole("checkbox", { name: "Panel" }).check();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Keynote and Panel")).toBeVisible();

  await host.context.close();
});

test("when the host removes an option, a guest's other pick is kept and their next edit completes", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "questions-multiple-rewrite", {
    // Inline, so the confirmation is in place of the buttons when the guest comes back.
    rsvpStyle: "Inline",
    title: "Ada’s conference",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [{ prompt: "Which sessions?", type: "multiple", required: true, choices: "Keynote, Workshop, Panel" }],
  });

  await answerName(page, host.link, "Priya Nair");
  await page.getByRole("checkbox", { name: "Keynote" }).check();
  await page.getByRole("checkbox", { name: "Workshop" }).check();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.getByLabel("Question 1 choices").fill("Keynote, Panel");
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();

  // The removed option is forgotten, the other pick comes back prefilled, and saving works.
  await page.reload();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("checkbox", { name: "Workshop" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Keynote" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Panel" })).not.toBeChecked();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Keynote", { exact: true })).toBeVisible();

  await host.context.close();
});
