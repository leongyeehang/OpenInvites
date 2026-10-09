import { expect, test, type Browser, type Page } from "./test";
import { mailCountTo, newHost, signUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";

// Ticket 01: the operator's two limits. Runs against `app-fresh` after the fresh-instance specs
// (the `limits-instance` project), and recreates it first, so the first account here is the
// operator. The scenarios run in order, each leaving the instance as the next expects it.
test.describe.configure({ mode: "serial" });

const EVENTS_REFUSAL = "You have 2 events, the most this instance allows. Delete an event you no longer need to make another.";
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

// A draft with only what the form requires.
async function fillDraft(page: Page, title: string) {
  await page.goto("/events/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Starts").fill("2027-03-06T19:00");
  await page.getByLabel("Time zone").selectOption("Asia/Singapore");
  await page.getByLabel("Plus-ones per guest").selectOption("0");
  await page.getByRole("button", { name: "Save draft" }).click();
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
  await verifyEmail(operator, request, host.email, mails);

  await operator.goto("/dashboard");
  await operator.getByRole("link", { name: "Instance settings" }).click();
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

test("a limit outside the range is refused where it is typed", async () => {
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

  await operator.goto(second);
  await operator.getByRole("button", { name: "Duplicate" }).click();
  await expect(operator.getByText(EVENTS_REFUSAL)).toBeVisible();
  await expect(operator).toHaveURL(second);
});

test("a third guest is refused at the replies limit, while the first can still change their answer", async ({ browser }) => {
  test.slow();
  await operator.goto("/dashboard");
  await operator.getByRole("link", { name: /First party/ }).click();
  await operator.getByRole("button", { name: "Publish" }).click();
  await expect(operator.getByText("Published", { exact: true })).toBeVisible();
  eventLink = (await operator.getByText(/^https?:\/\/\S+\/e\/[A-Za-z0-9-]+$/).textContent())!.trim();

  const first = await reply(browser, eventLink, "Priya Nair");
  await expect(first.getByText("You’re going!")).toBeVisible();
  const second = await reply(browser, eventLink, "Arjun Rao");
  await expect(second.getByText("You’re going!")).toBeVisible();

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
